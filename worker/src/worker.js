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
function run(command,args,cwd){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,stdio:"inherit"});
  child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(`${command} exited with code ${code}`)));
 });
}

new Worker("lordsu-builds",async job=>{
 const {id,config,iconPath}=job.data;
 await save(id,{status:"running",startedAt:new Date().toISOString()});
 const workspace=await fs.mkdtemp(path.join(os.tmpdir(),"lordsu-build-"));
 const configPath=path.join(workspace,"config.json");
 const buildConfig={...config,iconPath:iconPath||null};
 await fs.writeFile(configPath,JSON.stringify(buildConfig,null,2));
 await fs.mkdir(storage,{recursive:true});
 try{
  await run("node",[builder,configPath],workspace);
  const outputDir=path.join(workspace,"out");
  const files=await fs.readdir(outputDir);
  const apk=files.find(f=>f.endsWith(".apk"));
  if(!apk)throw new Error("Builder completed without an APK");
  const buildDir=path.join(storage,id);
  await fs.rm(buildDir,{recursive:true,force:true});
  await fs.mkdir(buildDir,{recursive:true});
  await fs.copyFile(path.join(outputDir,apk),path.join(buildDir,apk));
  await save(id,{status:"ready",completedAt:new Date().toISOString(),artifact:path.join(id,apk),fileName:apk});
 }catch(error){
  await save(id,{status:"failed",completedAt:new Date().toISOString(),error:error.message});
  throw error;
 }finally{await fs.rm(workspace,{recursive:true,force:true});}
},{connection:redis,concurrency:Number(process.env.WORKER_CONCURRENCY||1)});

console.log("LordSU worker online");
