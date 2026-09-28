import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {spawn} from "node:child_process";

const BACKENDS={
 kernelsu:{url:"https://github.com/tiann/KernelSU.git",ref:"main"},
 "kernelsu-next":{url:"https://github.com/KernelSU-Next/KernelSU-Next.git",ref:"dev"}
};

const cfg=JSON.parse(await fs.readFile(process.argv[2],"utf8"));
if(!BACKENDS[cfg.backend]) throw new Error("Unsupported backend");
if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(cfg.packageName)) throw new Error("Invalid package name");

const work=await fs.mkdtemp(path.join(os.tmpdir(),"lordsu-"));
const source=path.join(work,"source");
const out=path.join(work,"out");
await fs.mkdir(out,{recursive:true});

function run(command,args,cwd=work,env={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:"inherit"});
  child.on("error",reject);
  child.on("close",code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
 });
}

try{
 const backend=BACKENDS[cfg.backend];
 await run("git",["clone","--depth","1","--branch",backend.ref,backend.url,source]);

 const manager=path.join(source,"manager");
 const gradle=path.join(manager,process.platform==="win32"?"gradlew.bat":"gradlew");
 await run("chmod",["+x",gradle]);

 const args=[
   "assembleRelease",
   `-PKSU_NAME=${cfg.name}`,
   `-PKSU_PACKAGE_NAME=${cfg.packageName}`
 ];
 if(cfg.versionName) args.push(`-PVERSION_NAME=${cfg.versionName}`);

 await run(gradle,args,manager);

 const apkRoot=path.join(manager,"app","build","outputs","apk");
 const found=[];
 async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   const p=path.join(dir,entry.name);
   if(entry.isDirectory()) await walk(p);
   else if(entry.name.endsWith(".apk")) found.push(p);
  }
 }
 await walk(apkRoot);
 if(!found.length) throw new Error("Gradle completed but no APK was produced");

 const apk=found[0];
 const destination=path.join(out,`${cfg.name.replace(/[^a-zA-Z0-9._-]+/g,"-")}.apk`);
 await fs.copyFile(apk,destination);
 const data=await fs.readFile(destination);
 const sha256=crypto.createHash("sha256").update(data).digest("hex");
 console.log(JSON.stringify({status:"ready",apk:destination,sha256,size:data.length}));
} finally {
 // Production worker should move only the verified output to temporary artifact storage
 // and remove the complete workspace after the job retention period.
}
