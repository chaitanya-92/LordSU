import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {Queue} from "bullmq";
import IORedis from "ioredis";

const app=express();
const port=Number(process.env.PORT||4000);
const redis=new IORedis(process.env.REDIS_URL||"redis://127.0.0.1:6379",{maxRetriesPerRequest:null});
const queue=new Queue("lordsu-builds",{connection:redis});
const storage=process.env.ARTIFACT_DIR||"/storage";
const uploadDir=process.env.UPLOAD_DIR||"/uploads";
const corsOrigin=process.env.CORS_ORIGIN||"http://localhost:3000";
const maxQueuedBuilds=Number(process.env.MAX_QUEUED_BUILDS||3);
const rateWindowSeconds=60;
const buildRateLimit=Number(process.env.BUILD_RATE_LIMIT||5);
const statusRateLimit=Number(process.env.STATUS_RATE_LIMIT||120);

await fsp.mkdir(uploadDir,{recursive:true});
await fsp.mkdir(storage,{recursive:true});

app.disable("x-powered-by");
app.set("trust proxy",process.env.TRUST_PROXY==="1"?1:false);
app.use(cors({origin:corsOrigin==="*"?"*":corsOrigin,methods:["GET","POST","OPTIONS"],maxAge:86400}));
app.use((req,res,next)=>{
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("X-Frame-Options","DENY");
 res.setHeader("Referrer-Policy","no-referrer");
 res.setHeader("Permissions-Policy","camera=(),microphone=(),geolocation=()");
 if(process.env.NODE_ENV==="production")res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");
 next();
});
app.use(express.json({limit:"32kb"}));

const upload=multer({
 dest:uploadDir,
 limits:{fileSize:10*1024*1024,files:1,fields:8,fieldNameSize:64,fieldSize:4096,parts:9,fieldNestingDepth:3}
});

const schema=z.object({
 name:z.string().trim().min(1).max(64),
 packageName:z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/).max(128),
 backend:z.enum(["kernelsu","kernelsu-next"]),
 version:z.string().max(64).default("stable")
});

async function saveJob(job){await redis.set(`lordsu:build:${job.id}`,JSON.stringify(job),"EX",86400)}
async function readJob(id){const value=await redis.get(`lordsu:build:${id}`);return value?JSON.parse(value):null}

async function rateLimit(req,key,limit){
 const bucket=Math.floor(Date.now()/1000/rateWindowSeconds);
 const redisKey=`lordsu:rate:${key}:${bucket}`;
 const count=await redis.incr(redisKey);
 if(count===1)await redis.expire(redisKey,rateWindowSeconds+2);
 return {allowed:count<=limit,remaining:Math.max(0,limit-count)};
}

async function queueDepth(){
 const counts=await queue.getJobCounts("waiting","active","delayed");
 return (counts.waiting||0)+(counts.active||0)+(counts.delayed||0);
}

async function cleanupUpload(file){
 const filePath=typeof file==="string"?file:file?.path;
 if(filePath)await fsp.rm(filePath,{force:true}).catch(()=>{});
}

function validImageMagic(file){
 if(!file)return true;
 const b=fs.readFileSync(file.path);
 const png=b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=b.length>=12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP";
 return png||webp;
}

function apiError(error,res){
 if(error instanceof multer.MulterError){
  if(error.code==="LIMIT_FILE_SIZE")return res.status(413).json({error:"Icon is too large. Maximum size is 10 MB."});
  return res.status(400).json({error:`Upload error: ${error.message}`});
 }
 console.error(error);
 return res.status(500).json({error:"The build service encountered an unexpected error."});
}

app.get("/health",async(_req,res)=>{
 try{const started=Date.now();await redis.ping();res.json({ok:true,service:"lordsu-api",redis:"ok",queue:"ok",latencyMs:Date.now()-started})}
 catch{res.status(503).json({ok:false,service:"lordsu-api",redis:"unavailable"})}
});
app.get("/ready",async(_req,res)=>{try{await redis.ping();res.json({ready:true})}catch{res.status(503).json({ready:false})}});

app.post("/api/builds",upload.single("icon"),async(req,res)=>{
 try{
  const ip=req.ip||req.socket.remoteAddress||"unknown";
  const rate=await rateLimit(req,`build:${ip}`,buildRateLimit);
  res.setHeader("X-RateLimit-Limit",buildRateLimit);
  res.setHeader("X-RateLimit-Remaining",rate.remaining);
  if(!rate.allowed)return res.status(429).json({error:"Build rate limit reached. Please try again later."});
  const parsed=schema.safeParse(req.body);
  if(!parsed.success){await cleanupUpload(req.file);return res.status(400).json({error:parsed.error.issues[0].message})}
  if(!validImageMagic(req.file)){await cleanupUpload(req.file);return res.status(400).json({error:"Icon must be a valid PNG or WebP image."})}
  const depth=await queueDepth();
  if(depth>=maxQueuedBuilds){await cleanupUpload(req.file);return res.status(429).json({error:"Build queue is currently full. Please try again shortly."})}
  const id=crypto.randomUUID();
  const job={id,status:"queued",stage:"preparing",progress:0,message:"Waiting for worker",createdAt:new Date().toISOString(),config:parsed.data,iconPath:req.file?.path||null};
  await saveJob(job);
  try{
   await queue.add("build",{id,config:parsed.data,iconPath:job.iconPath},{jobId:id,removeOnComplete:100,removeOnFail:100,attempts:1});
  }catch(error){await cleanupUpload(req.file);await redis.del(`lordsu:build:${id}`);throw error}
  res.status(202).json({id,status:"queued",stage:"preparing",progress:0,message:"Waiting for worker"});
 }catch(error){apiError(error,res)}
});

app.get("/api/builds/:id",async(req,res)=>{
 try{
  const ip=req.ip||req.socket.remoteAddress||"unknown";
  const rate=await rateLimit(req,`status:${ip}`,statusRateLimit);
  if(!rate.allowed)return res.status(429).json({error:"Too many status requests. Please slow down."});
  const job=await readJob(req.params.id);
  if(!job)return res.status(404).json({error:"Build not found"});
  res.setHeader("Cache-Control","no-store");
  res.json({...job,downloadUrl:job.status==="ready"?`/api/builds/${job.id}/download`:null});
 }catch(error){apiError(error,res)}
});

app.post("/api/builds/:id/cancel",async(req,res)=>{
 try{
  const job=await readJob(req.params.id);
  if(!job)return res.status(404).json({error:"Build not found"});
  if(["ready","failed","cancelled"].includes(job.status))return res.status(409).json({error:`Build is already ${job.status}.`});
  const updated={...job,cancelRequested:true,status:"cancelling",message:"Cancelling build…"};
  await saveJob(updated);
  const queuedJob=await queue.getJob(job.id);
  if(queuedJob){
   try{
    const state=await queuedJob.getState();
    if(state==="waiting"||state==="delayed"){
     await queuedJob.remove();
     const cancelled={...updated,status:"cancelled",stage:"cancelled",progress:0,message:"Build cancelled",completedAt:new Date().toISOString(),cancelRequested:false};
     await saveJob(cancelled);
     await cleanupUpload(job.iconPath);
     return res.json({id:job.id,status:"cancelled",stage:"cancelled",progress:0,message:"Build cancelled"});
    }
   }catch{}
  }
  res.status(202).json({id:job.id,status:"cancelling",message:"Cancelling build…"});
 }catch(error){apiError(error,res)}
});

app.get("/api/builds/:id/download",async(req,res)=>{
 try{
  const job=await readJob(req.params.id);
  if(!job||job.status!=="ready"||!job.artifact)return res.status(404).json({error:"APK is not ready"});
  const root=path.resolve(storage);
  const file=path.resolve(root,job.artifact);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.status(404).json({error:"Artifact expired"});
  res.setHeader("Cache-Control","private, no-store");
  res.download(file,job.fileName||"manager.apk");
 }catch(error){apiError(error,res)}
});

app.use((req,res)=>res.status(404).json({error:"Not found"}));
app.use((error,_req,res,_next)=>apiError(error,res));

const server=app.listen(port,()=>console.log(`LordSU API listening on :${port}`));
async function shutdown(signal){
 console.log(`Received ${signal}; shutting down`);
 server.close(async()=>{await queue.close().catch(()=>{});await redis.quit().catch(()=>{});process.exit(0)});
 setTimeout(()=>process.exit(1),10000).unref();
}
process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));
