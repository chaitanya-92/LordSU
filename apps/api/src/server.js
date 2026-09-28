import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {z} from "zod";
import {Queue} from "bullmq";
import IORedis from "ioredis";

const app=express(),upload=multer({dest:"/tmp/lordsu-uploads",limits:{fileSize:10*1024*1024}});
const port=Number(process.env.PORT||4000);
const redis=new IORedis(process.env.REDIS_URL||"redis://127.0.0.1:6379",{maxRetriesPerRequest:null});
const queue=new Queue("lordsu-builds",{connection:redis});
const storage=process.env.ARTIFACT_DIR||"/storage";

app.use(cors());app.use(express.json());

function apiError(error,res){
 if(error instanceof multer.MulterError){
  if(error.code==="LIMIT_FILE_SIZE") return res.status(413).json({error:"Icon is too large. Maximum size is 10 MB."});
  return res.status(400).json({error:`Upload error: ${error.message}`});
 }
 console.error(error);
 return res.status(500).json({error:"The build service encountered an unexpected error."});
}

const schema=z.object({
 name:z.string().trim().min(1).max(64),
 packageName:z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/).max(128),
 backend:z.enum(["kernelsu","kernelsu-next"]),
 version:z.string().max(64).default("stable")
});

async function saveJob(job){await redis.set(`lordsu:build:${job.id}`,JSON.stringify(job),"EX",86400)}
async function readJob(id){const value=await redis.get(`lordsu:build:${id}`);return value?JSON.parse(value):null}

app.get("/health",(_q,s)=>s.json({ok:true,service:"lordsu-api"}));

app.post("/api/builds",upload.single("icon"),async(req,res)=>{
 try{
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0].message});
  const id=crypto.randomUUID();
  const job={id,status:"queued",createdAt:new Date().toISOString(),config:parsed.data,iconPath:req.file?.path||null};
  await saveJob(job);
  await queue.add("build",{id,config:parsed.data,iconPath:job.iconPath},{jobId:id,removeOnComplete:100,removeOnFail:100});
  res.status(202).json({id,status:"queued"});
 }catch(error){
  apiError(error,res);
 }
});

app.get("/api/builds/:id",async(req,res)=>{
 const job=await readJob(req.params.id);
 if(!job)return res.status(404).json({error:"Build not found"});
 res.json({...job,downloadUrl:job.status==="ready"?`/api/builds/${job.id}/download`:null});
});

app.get("/api/builds/:id/download",async(req,res)=>{
 const job=await readJob(req.params.id);
 if(!job||job.status!=="ready"||!job.artifact)return res.status(404).json({error:"APK is not ready"});
 const file=path.resolve(storage,job.artifact);
 if(!file.startsWith(path.resolve(storage)+path.sep)||!fs.existsSync(file))return res.status(404).json({error:"Artifact expired"});
 res.download(file,job.fileName||"manager.apk");
});

app.use((error,_req,res,_next)=>apiError(error,res));
app.listen(port,()=>console.log(`LordSU API listening on :${port}`));
