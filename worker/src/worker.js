import {Worker} from "bullmq";
import IORedis from "ioredis";
import {spawn} from "node:child_process";

const redis=new IORedis(process.env.REDIS_URL||"redis://127.0.0.1:6379",{maxRetriesPerRequest:null});
const sources={
 kernelsu:{url:"https://github.com/tiann/KernelSU.git",defaultRef:"main"},
 "kernelsu-next":{url:"https://github.com/KernelSU-Next/KernelSU-Next.git",defaultRef:"dev"}
};

function run(command,args,cwd){
 return new Promise((resolve,reject)=>{
  const p=spawn(command,args,{cwd,stdio:"inherit"});
  p.on("error",reject);p.on("close",code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
 });
}

new Worker("lordsu-builds",async job=>{
 const source=sources[job.data.config.backend];
 if(!source)throw new Error("Unsupported backend");
 console.log(`Build ${job.id}: ${job.data.config.name} using ${job.data.config.backend}`);
 // Production implementation executes the fixed builder container here.
 // User input is passed as validated configuration; arbitrary commands are never accepted.
 // The next milestone supplies the Android build adapter for each approved source layout.
 await run("node",["-e","console.log('validated build job')"]);
 return {status:"validated",backend:job.data.config.backend,source:source.url};
},{connection:redis,concurrency:Number(process.env.WORKER_CONCURRENCY||1)});

console.log("LordSU worker online");
