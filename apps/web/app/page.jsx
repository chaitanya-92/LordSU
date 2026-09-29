"use client";
import {useEffect,useMemo,useState} from "react";
import {Check,ChevronRight,Download,Loader2,Upload,AlertCircle,Circle,Clock3,ShieldCheck,Zap} from "lucide-react";
import {Button} from "../components/ui/button";
import {Input} from "../components/ui/input";
import {Label} from "../components/ui/label";
import {Card,CardHeader,CardContent} from "../components/ui/card";

const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000";
const backends=[
 {id:"kernelsu",name:"KernelSU",desc:"Kernel-based root backend",branch:"main"},
 {id:"kernelsu-next",name:"KernelSU Next",desc:"KernelSU-compatible backend",branch:"dev"}
];
const packageSuggestion=(name)=>{
 const slug=name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"").replace(/^[^a-z]+/,"")||"manager";
 return `com.${slug}.manager`;
};
const steps=[
 ["preparing","Preparing","Create isolated workspace"],
 ["source","Source","Fetch approved upstream"],
 ["branding","Branding","Apply name, package and icon"],
 ["signing-setup","Signing setup","Create release signing identity"],
 ["compile","Compiling","Build Android release with Gradle"],
 ["package","Packaging","Collect generated APK"],
 ["align","Optimizing","Align APK"],
 ["sign","Signing","Sign APK"],
 ["verify","Verifying","Verify APK signature"],
 ["ready","Complete","APK ready"]
];
export default function Home(){
 const [form,setForm]=useState({name:"",packageName:"",backend:"kernelsu",version:"stable",icon:null});
 const [busy,setBusy]=useState(false),[job,setJob]=useState(null),[error,setError]=useState("");
 const [packageEdited,setPackageEdited]=useState(false);
 const [startedAt,setStartedAt]=useState(null),[now,setNow]=useState(Date.now());
 const terminalStatuses=["ready","failed","cancelled"];
 useEffect(()=>{const savedId=window.localStorage.getItem("lordsu.activeBuild");if(!savedId)return;fetch(API+"/api/builds/"+savedId,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to restore build");setJob(d);setStartedAt(d.startedAt?new Date(d.startedAt).getTime():null)}).catch(()=>window.localStorage.removeItem("lordsu.activeBuild"))},[]);
 useEffect(()=>{if(!job?.id||terminalStatuses.includes(job.status))return;const poll=async()=>{try{const r=await fetch(API+"/api/builds/"+job.id,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to read build status");setJob(d);setStartedAt(d.startedAt?new Date(d.startedAt).getTime():null)}catch(e){setError(e.message)}};poll();const t=setInterval(poll,2000);return()=>clearInterval(t)},[job?.id,job?.status]);
 useEffect(()=>{if(!job?.id||terminalStatuses.includes(job.status))return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[job?.id,job?.status]);
 const elapsed=useMemo(()=>startedAt?Math.max(0,Math.floor((now-startedAt)/1000)):0,[now,startedAt]);
 const elapsedText=`${Math.floor(elapsed/60)}m ${String(elapsed%60).padStart(2,"0")}s`;
 async function build(e){
  e.preventDefault();setBusy(true);setError("");setStartedAt(null);
  const packageName=form.packageName.trim().toLowerCase();
  if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)){
   const message="Use a valid lowercase package name, for example com.example.myroot.";
   setError(message);setJob({status:"failed",stage:"failed",progress:0,message:"Invalid package name",error:message});setBusy(false);return;
  }
  setJob({status:"queued",progress:0,message:"Waiting for worker"});
  try{const fd=new FormData();Object.entries({...form,packageName}).forEach(([k,v])=>{if(v!==null)fd.append(k,v)});const r=await fetch(API+"/api/builds",{method:"POST",body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to create build");setJob(d);window.localStorage.setItem("lordsu.activeBuild",d.id)}catch(e){setJob({status:"failed",stage:"failed",error:e.message});setError(e.message)}finally{setBusy(false)}
 }
 async function cancelBuild(){
  if(!job?.id||terminalStatuses.includes(job.status))return;
  setError("");
  try{
   const r=await fetch(API+"/api/builds/"+job.id+"/cancel",{method:"POST"});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||"Unable to cancel build");
   setJob(prev=>({...prev,...d,message:"Cancelling build…"}));
  }catch(e){setError(e.message)}
 }
 const current=steps.findIndex(([id])=>id===job?.stage);
 return <main className="min-h-screen bg-[#fafafa] text-zinc-950">
  <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
   <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white font-bold">L</div><div><div className="font-semibold tracking-tight">LordSU</div><div className="text-[11px] text-zinc-500">Manager Builder</div></div></div>
   <div className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500"/><span>Build service online</span></div>
  </nav>
  <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-8 lg:grid-cols-[1fr_560px]">
   <section className="pt-10 lg:pt-16">
    <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium shadow-sm"><Zap size={13}/> ON-DEMAND ANDROID BUILDS</div>
    <h1 className="max-w-3xl text-5xl font-semibold tracking-[-.04em] sm:text-6xl lg:text-7xl">Build your manager.<br/><span className="text-zinc-400">Watch every step.</span></h1>
    <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-500">Configure your manager identity and approved backend. LordSU handles source preparation, compilation, signing and APK verification for you.</p>
    <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
     {[["Isolated","build workspace"],["Verified","signed APK"],["Cached","Gradle dependencies"]].map(([a,b])=><div key={a} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="font-medium">{a}</div><div className="mt-1 text-xs text-zinc-500">{b}</div></div>)}
    </div>
   </section>
   <Card className="overflow-hidden border-zinc-200 shadow-xl shadow-zinc-200/50">
    <CardHeader><h2 className="text-xl font-semibold">Create manager</h2><p className="mt-1 text-sm text-zinc-500">Your build stays isolated from other jobs.</p></CardHeader>
    <CardContent>
     <form onSubmit={build} className="space-y-5">
      <div><Label>Manager name</Label><Input className="mt-2 h-11" value={form.name} onChange={e=>{const name=e.target.value;setForm(prev=>({...prev,name,...(!packageEdited?{packageName:packageSuggestion(name)}:{})}))}} placeholder="MyRoot" required/></div>
      <div><Label>Package name</Label><Input className="mt-2 h-11 font-mono text-sm" value={form.packageName} onChange={e=>{setPackageEdited(true);setForm({...form,packageName:e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,"")})}} placeholder="com.example.myroot" required/>
      <p className="mt-1.5 text-xs text-zinc-500">Lowercase letters, numbers, underscores and dots only.</p></div>
      <div><Label>Icon</Label><label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-50"><Upload size={18}/><span className="truncate">{form.icon?form.icon.name:"Upload PNG or WebP"}</span><input className="hidden" type="file" accept="image/png,image/webp" onChange={e=>setForm({...form,icon:e.target.files?.[0]||null})}/></label></div>
      <div><Label>Root backend</Label><div className="mt-2 grid gap-2">{backends.map(b=><button type="button" key={b.id} onClick={()=>setForm({...form,backend:b.id})} className={`rounded-xl border p-4 text-left transition-all ${form.backend===b.id?"border-zinc-950 bg-zinc-50 shadow-sm":"border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"}`}><div className="flex items-center justify-between font-medium">{b.name}{form.backend===b.id&&<Check size={17}/>}</div><p className="mt-1 text-xs text-zinc-500">{b.desc} · {b.branch}</p></button>)}</div></div>
      <Button className="w-full h-11" size="lg" disabled={busy}>{busy?<><Loader2 className="mr-2 animate-spin" size={17}/>Submitting build…</>:<>Build manager <ChevronRight className="ml-2" size={17}/></>}</Button>
     </form>
     {job&&<div className="mt-6 overflow-hidden rounded-2xl border bg-zinc-950 text-white shadow-lg">
      {!["failed","cancelled"].includes(job.status)&&<div className="p-5">
       <div className="flex items-start justify-between gap-4"><div><div className="text-xs text-zinc-400">BUILD PROGRESS</div><div className="mt-1 text-lg font-semibold">{job.message||"Waiting for worker"}</div></div><div className="text-2xl font-semibold tabular-nums">{Math.round(job.progress||0)}%</div></div>
       <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white transition-all duration-700 ease-out" style={{width:`${Math.max(0,Math.min(100,job.progress||0))}%`}}/><div className="lordsu-shimmer relative -mt-2 h-2 rounded-full" style={{width:`${Math.max(0,Math.min(100,job.progress||0))}%`}}/></div>
       <div className="mt-5 flex items-center gap-2 text-xs text-zinc-400"><Clock3 size={14}/>{elapsedText}<span>·</span><ShieldCheck size={14}/>Isolated worker</div>
      </div>}
      <div className="border-t border-white/10 p-5">
       <div className="space-y-3">{steps.map(([id,title,desc],i)=>{const done=job.status==="ready"?i<steps.length:i<current;const active=i===current&&!terminalStatuses.includes(job.status);return <div key={id} className="flex gap-3"><div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${done?"border-white bg-white text-zinc-950":active?"border-white text-white":"border-white/15 text-white/30"}`}>{done?<Check size={13}/>:active?<Loader2 size={13} className="animate-spin"/>:<Circle size={8}/>}</div><div className="min-w-0"><div className={`text-sm ${active||done?"text-white":"text-white/35"}`}>{title}</div><div className="text-[11px] text-white/35">{desc}</div></div></div>})}</div>
       {job.status==="ready"&&job.downloadUrl&&<a href={API+job.downloadUrl} className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-white font-medium text-zinc-950 transition hover:scale-[1.01] hover:bg-zinc-100"><Download size={17}/>Download APK</a>}
      </div>
     </div>}
     {(job?.status==="failed"||job?.status==="cancelled"||error)&&<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0" size={18}/><div><div className="font-semibold">{job?.status==="cancelled"?"Build cancelled":"Build failed"}</div><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{job?.error||error}</p></div></div></div>}
    </CardContent>
   </Card>
  </div>
 </main>
}
