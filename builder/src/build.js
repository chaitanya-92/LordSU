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
if(!cfg.name?.trim()) throw new Error("Manager name is required");
if(!/^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$/.test(cfg.packageName)) throw new Error("Invalid package name");

const work=await fs.mkdtemp(path.join(os.tmpdir(),"lordsu-"));
const source=path.join(work,"source");
const out=path.join(work,"out");
const progressFile=process.env.PROGRESS_FILE||path.join(work,"progress.json");
await fs.mkdir(out,{recursive:true});

async function progress(stage,percent,message){
 await fs.writeFile(progressFile,JSON.stringify({stage,percent,message,updatedAt:new Date().toISOString()}));
}

function run(command,args,cwd=work,env={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:"inherit"});
  child.on("error",reject);child.on("close",code=>code===0?resolve():reject(new Error(`${command} exited with code ${code}`)));
 });
}

function safeName(v){return v.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"manager"}

async function replaceIcons(iconPath,manager){
 if(!iconPath)return;
 const script=[
  "from PIL import Image",
  "import sys, pathlib",
  "src=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2])",
  "im=Image.open(src).convert('RGBA')",
  "side=max(im.size); canvas=Image.new('RGBA',(side,side),(0,0,0,0)); im.thumbnail((side,side),Image.Resampling.LANCZOS); canvas.alpha_composite(im,((side-im.width)//2,(side-im.height)//2))",
  "sizes={'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}",
  "for d,s in sizes.items():",
  " p=root/'app'/'src'/'main'/'res'/f'mipmap-{d}'",
  " p.mkdir(parents=True,exist_ok=True)",
  " for n in ('ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png'): canvas.resize((s,s),Image.Resampling.LANCZOS).save(p/n,optimize=True)"
 ].join("\n");
 await run("python3",["-c",script,iconPath,manager]);
}

try{
 await progress("preparing",5,"Preparing isolated build workspace");
 const backend=BACKENDS[cfg.backend];
 await progress("source",15,`Fetching ${cfg.backend === "kernelsu" ? "KernelSU" : "KernelSU Next"} source`);
 await run("git",["clone","--depth","1","--branch",backend.ref,backend.url,source]);

 const manager=path.join(source,"manager");
 const gradle=path.join(manager,process.platform==="win32"?"gradlew.bat":"gradlew");
 await run("chmod",["+x",gradle]);

 await progress("branding",30,"Applying manager name, package and icon");
 if(cfg.iconPath) await replaceIcons(cfg.iconPath,manager);

 await progress("signing-setup",38,"Generating isolated release signing identity");
 const keystore=path.join(work,"release.keystore");
 const password=crypto.randomBytes(24).toString("base64url");
 const alias="lordsu";
 await run("keytool",[
  "-genkeypair","-v","-keystore",keystore,"-storepass",password,
  "-keypass",password,"-alias",alias,"-keyalg","RSA","-keysize","3072",
  "-validity","10000","-dname","CN=LordSU Build"
 ]);

 await progress("compile",42,"Compiling Android manager with Gradle");
 const args=[
   "assembleRelease",
   `-PKSU_NAME=${cfg.name}`,
   `-PKSU_PACKAGE_NAME=${cfg.packageName}`,
   `-PKEYSTORE_FILE=${keystore}`,
   `-PKEYSTORE_PASSWORD=${password}`,
   `-PKEY_ALIAS=${alias}`,
   `-PKEY_PASSWORD=${password}`
 ];
 await run(gradle,args,manager,{GRADLE_OPTS:"-Dorg.gradle.daemon=false -Dorg.gradle.parallel=false -Dorg.gradle.jvmargs=-Xmx4g"});

 await progress("package",82,"Collecting and packaging the generated APK");
 const apkRoot=path.join(manager,"app","build","outputs","apk");
 const found=[];
 async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   const p=path.join(dir,entry.name);
   if(entry.isDirectory()) await walk(p); else if(entry.name.endsWith(".apk")) found.push(p);
  }
 }
 await walk(apkRoot);
 if(!found.length)throw new Error("Gradle completed but no APK was produced");

 const apk=found[0];
 const unsigned=path.join(out,"unsigned.apk");
 const aligned=path.join(out,"aligned.apk");
 const destination=path.join(out,`${safeName(cfg.name)}.apk`);
 const zipalign=process.env.ZIPALIGN||"zipalign";
 const apksigner=process.env.APKSIGNER||"apksigner";

 await progress("align",88,"Optimizing APK alignment");
 await fs.copyFile(apk,unsigned);
 await run(zipalign,["-f","4",unsigned,aligned]);

 await progress("sign",93,"Signing APK");
 await run(apksigner,["sign","--ks",keystore,"--ks-pass",`pass:${password}`,"--key-pass",`pass:${password}`,"--ks-key-alias",alias,"--out",destination,aligned]);

 await progress("verify",97,"Verifying APK signature");
 const data=await fs.readFile(destination);
 await run(apksigner,["verify","--verbose",destination]);
 const sha256=crypto.createHash("sha256").update(data).digest("hex");
 await progress("ready",100,"APK is ready to download");
 console.log(JSON.stringify({status:"ready",apk:destination,sha256,size:data.length}));
}finally{
 await fs.rm(work,{recursive:true,force:true}).catch(()=>{});
}
