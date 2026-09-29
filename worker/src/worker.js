import {Worker} from "bullmq";
import IORedis from "ioredis";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {spawn} from "node:child_process";
import crypto from "node:crypto";

const redis=new IORedis(process.env.REDIS_URL||"redis://127.0.0.1:6379",{maxRetriesPerRequest:null});
const storage=process.env.ARTIFACT_DIR||"/storage";
const uploadDir=process.env.UPLOAD_DIR||"/uploads";
const builder=process.env.BUILDER_SCRIPT||"/app/builder/src/build.js";
const artifactTtlMs=Number(process.env.ARTIFACT_TTL_MS||86400000);
const cleanupIntervalMs=Number(process.env.CLEANUP_INTERVAL_MS||3600000);

async function save(id,patch){
 const current=await redis.get(`lordsu:build:${id}`);
 const job=current?JSON.parse(current):{id};
 const next={...job,...patch};
 await redis.set(`lordsu:build:${id}`,JSON.stringify(next),"EX",86400);
 return next;
}

async function cleanupExpiredArtifacts(){
 try{
  const entries=await fs.readdir(storage,{withFileTypes:true});
  const cutoff=Date.now()-artifactTtlMs;
  for(const entry of entries){
   if(!entry.isDirectory())continue;
   const dir=path.join(storage,entry.name);
   const stat=await fs.stat(dir).catch(()=>null);
   if(stat&&stat.mtimeMs<cutoff)await fs.rm(dir,{recursive:true,force:true});
  }
 }catch(error){console.error("Artifact cleanup failed:",error.message)}
}

async function cleanupExpiredUploads(){
 try{
  const entries=await fs.readdir(uploadDir,{withFileTypes:true});
  const cutoff=Date.now()-artifactTtlMs;
  for(const entry of entries){
   if(!entry.isFile())continue;
   const file=path.join(uploadDir,entry.name);
   const stat=await fs.stat(file).catch(()=>null);
   if(stat&&stat.mtimeMs<cutoff)await fs.rm(file,{force:true});
  }
 }catch(error){console.error("Upload cleanup failed:",error.message)}
}

function runBuilder(args,cwd,env,id){
 return new Promise((resolve,reject)=>{
  const child=spawn("node",args,{cwd,env:{...process.env,...env},detached:true,stdio:["ignore","ignore","pipe"]});
  let stderr="";
  let stopping=false;
  const cancelPoll=setInterval(async()=>{
   try{
    const raw=await redis.get(`lordsu:build:${id}`);
    const state=raw?JSON.parse(raw):null;
    if(state?.cancelRequested&&!stopping){
     stopping=true;
     clearInterval(cancelPoll);
     try{process.kill(-child.pid,"SIGTERM")}catch{}
     setTimeout(()=>{try{process.kill(-child.pid,"SIGKILL")}catch{}},2000);
    }
   }catch{}
  },500);
  child.stderr.on("data",chunk=>{stderr+=chunk.toString();if(stderr.length>12000)stderr=stderr.slice(-12000)});
  child.on("error",error=>{clearInterval(cancelPoll);reject(error)});
  child.on("close",code=>{
   clearInterval(cancelPoll);
   if(stopping)return reject(new Error("__CANCELLED__"));
   if(code===0)return resolve();
   reject(new Error(stderr.trim()||`Android builder exited with code ${code}`));
  });
 });
}

const worker=new Worker("lordsu-builds",async job=>{
 const {id,config,iconPath}=job.data;
 const workspace=await fs.mkdtemp(path.join(os.tmpdir(),"lordsu-build-"));
 const configPath=path.join(workspace,"config.json");
 const progressFile=path.join(workspace,"progress.json");
 const outputDir=path.join(workspace,"out");
 const buildConfig={...config,iconPath:iconPath||null};
 await fs.writeFile(configPath,JSON.stringify(buildConfig,null,2));
 await fs.mkdir(outputDir,{recursive:true});
 await fs.mkdir(storage,{recursive:true});
 await fs.mkdir(uploadDir,{recursive:true});
 let monitor;
 try{
  const existing=await redis.get(`lordsu:build:${id}`);
  if(existing&&JSON.parse(existing).cancelRequested){
   await save(id,{status:"cancelled",stage:"cancelled",progress:0,message:"Build cancelled",completedAt:new Date().toISOString()});
   return;
  }
  await save(id,{status:"running",stage:"preparing",progress:5,message:"Preparing isolated build workspace",startedAt:new Date().toISOString()});
  monitor=setInterval(async()=>{
   try{
    const raw=await fs.readFile(progressFile,"utf8");
    const p=JSON.parse(raw);
    const current=await redis.get(`lordsu:build:${id}`);
    if(current&&JSON.parse(current).cancelRequested)return;
    await save(id,{status:"running",stage:p.stage,progress:p.percent,message:p.message});
   }catch{}
  },700);
  await runBuilder([builder,configPath],workspace,{PROGRESS_FILE:progressFile,BUILD_OUTPUT_DIR:outputDir},id);
  const state=await redis.get(`lordsu:build:${id}`);
  if(state&&JSON.parse(state).cancelRequested)throw new Error("__CANCELLED__");
  const files=await fs.readdir(outputDir);
  const apk=files.find(f=>f.endsWith(".apk"));
  const sourceCommit=(await fs.readFile(path.join(outputDir,"source-commit.txt"),"utf8").catch(()=>"")).trim()||null;
  if(!apk)throw new Error("Build completed without an APK");
  const buildDir=path.join(storage,id);
  await fs.rm(buildDir,{recursive:true,force:true});
  await fs.mkdir(buildDir,{recursive:true});
  const artifactPath=path.join(buildDir,apk);
  await fs.copyFile(path.join(outputDir,apk),artifactPath);
  const artifactData=await fs.readFile(artifactPath);
  const sha256=crypto.createHash("sha256").update(artifactData).digest("hex");
  await save(id,{status:"ready",stage:"ready",progress:100,message:"APK is ready to download",completedAt:new Date().toISOString(),artifact:path.join(id,apk),fileName:apk,size:artifactData.length,sha256,sourceCommit,backend:config.backend});
 }catch(error){
  if(error.message==="__CANCELLED__"){
   await fs.rm(path.join(storage,id),{recursive:true,force:true}).catch(()=>{});
   await save(id,{status:"cancelled",stage:"cancelled",progress:0,message:"Build cancelled",completedAt:new Date().toISOString()});
  }else{
   await save(id,{status:"failed",stage:"failed",progress:0,message:"Build failed",completedAt:new Date().toISOString(),error:error.message});
  }
 }finally{
  if(monitor)clearInterval(monitor);
  if(iconPath)await fs.rm(iconPath,{force:true}).catch(()=>{});
  await fs.rm(workspace,{recursive:true,force:true});
 }
},{connection:redis,concurrency:Number(process.env.WORKER_CONCURRENCY||1),stalledInterval:30000,maxStalledCount:2});

const cleanupTimer=setInterval(()=>{cleanupExpiredArtifacts();cleanupExpiredUploads()},cleanupIntervalMs);
cleanupTimer.unref();
cleanupExpiredArtifacts();
cleanupExpiredUploads();

async function shutdown(signal){
 console.log(`Received ${signal}; shutting down`);
 clearInterval(cleanupTimer);
 await worker.close().catch(()=>{});
 await redis.quit().catch(()=>{});
 process.exit(0);
}
process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));

console.log("LordSU worker online");
