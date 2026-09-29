import {Worker} from "bullmq";
import IORedis from "ioredis";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {spawn} from "node:child_process";

const redis=new IORedis(process.env.REDIS_URL||"redis://127.0.0.1:6379",{maxRetriesPerRequest:null});
const storage=process.env.ARTIFACT_DIR||"/storage";
const builder=process.env.BUILDER_SCRIPT||"/app/builder/src/build.js";

async function save(id,patch){
 const current=await redis.get(`lordsu:build:${id}`);
 const job=current?JSON.parse(current):{id};
 const next={...job,...patch};
 await redis.set(`lordsu:build:${id}`,JSON.stringify(next),"EX",86400);
 return next;
}
function runBuilder(args,cwd,env){
 return new Promise((resolve,reject)=>{
  const child=spawn("node",args,{cwd,env:{...process.env,...env},stdio:["ignore","ignore","pipe"]});
  let stderr="";
  child.stderr.on("data",chunk=>{stderr+=chunk.toString(); if(stderr.length>12000) stderr=stderr.slice(-12000)});
  child.on("error",reject);
  child.on("close",code=>code===0?resolve():reject(new Error(stderr.trim()||`Android builder exited with code ${code}`)));
 });
}

new Worker("lordsu-builds",async job=>{
 const {id,config,iconPath}=job.data;
 const workspace=await fs.mkdtemp(path.join(os.tmpdir(),"lordsu-build-"));
 const configPath=path.join(workspace,"config.json");
 const progressFile=path.join(workspace,"progress.json");
 const buildConfig={...config,iconPath:iconPath||null};
 await fs.writeFile(configPath,JSON.stringify(buildConfig,null,2));
 await fs.mkdir(storage,{recursive:true});
 let monitor;
 try{
  await save(id,{status:"running",stage:"preparing",progress:5,message:"Preparing isolated build workspace",startedAt:new Date().toISOString()});
  monitor=setInterval(async()=>{
   try{
    const raw=await fs.readFile(progressFile,"utf8");
    const p=JSON.parse(raw);
    await save(id,{status:"running",stage:p.stage,progress:p.percent,message:p.message});
   }catch{}
  },700);
  await runBuilder([builder,configPath],workspace,{PROGRESS_FILE:progressFile,BUILD_OUTPUT_DIR:outputDir});
  const files=await fs.readdir(outputDir);
  const apk=files.find(f=>f.endsWith(".apk"));
  if(!apk)throw new Error("Build completed without an APK");
  const buildDir=path.join(storage,id);
  await fs.rm(buildDir,{recursive:true,force:true});
  await fs.mkdir(buildDir,{recursive:true});
  await fs.copyFile(path.join(outputDir,apk),path.join(buildDir,apk));
  await save(id,{status:"ready",stage:"ready",progress:100,message:"APK is ready to download",completedAt:new Date().toISOString(),artifact:path.join(id,apk),fileName:apk});
 }catch(error){
  await save(id,{status:"failed",stage:"failed",progress:0,message:"Build failed",completedAt:new Date().toISOString(),error:error.message});
 }finally{
  if(monitor)clearInterval(monitor);
  await fs.rm(workspace,{recursive:true,force:true});
 }
},{connection:redis,concurrency:Number(process.env.WORKER_CONCURRENCY||1)});

console.log("LordSU worker online");
