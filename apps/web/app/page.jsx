"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {AnimatePresence,motion} from "framer-motion";
import {
  AlertCircle,ArrowRight,Check,CheckCircle2,ChevronDown,Clock3,Code2,Copy,
  Download,FileImage,GitBranch,Loader2,PackageCheck,RefreshCw,ShieldCheck,
  Sparkles,Upload,Wifi,X,Zap
} from "lucide-react";
import {Button} from "../components/ui/button";
import {Input} from "../components/ui/input";
import {Label} from "../components/ui/label";
import {Card,CardContent} from "../components/ui/card";
import {Skeleton} from "../components/ui/skeleton";
import {Toast} from "../components/ui/toast";

const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000";
const backends=[
  {id:"kernelsu",name:"KernelSU",desc:"Kernel-based root backend",branch:"main"},
  {id:"kernelsu-next",name:"KernelSU Next",desc:"KernelSU-compatible backend",branch:"dev"}
];
const steps=[
  ["preparing","Preparing"],["source","Source"],["branding","Branding"],["signing-setup","Signing"],
  ["compile","Compiling"],["package","Packaging"],["align","Optimizing"],["sign","Signing"],
  ["verify","Verifying"],["ready","Complete"]
];
const terminalStatuses=["ready","failed","cancelled"];

const packageSuggestion=name=>{
  const slug=name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"").replace(/^[^a-z]+/,"")||"manager";
  return `com.${slug}.manager`;
};
const formatBytes=bytes=>bytes?\`${(bytes/1024/1024).toFixed(2)} MB\`:"—";
const shortHash=value=>value&&value.length>18?\`${value.slice(0,10)}…${value.slice(-8)}\`:value||"—";
const conciseError=value=>{
  if(!value)return "The build worker could not complete the build.";
  const text=String(value).replace(/\\s+/g," ").trim();
  const marker=text.match(/What went wrong:\s*(.*?)(?:\\s+Try:|\\s+BUILD FAILED|$)/i);
  return (marker?.[1]||text).slice(0,240);
};

export default function Home(){
  const [form,setForm]=useState({name:"",packageName:"",backend:"kernelsu",version:"stable",icon:null});
  const [job,setJob]=useState(null),[busy,setBusy]=useState(false),[restoring,setRestoring]=useState(true);
  const [error,setError]=useState(""),[packageEdited,setPackageEdited]=useState(false);
  const [startedAt,setStartedAt]=useState(null),[now,setNow]=useState(Date.now());
  const [toast,setToast]=useState(null),[copied,setCopied]=useState(""),[confirmCancel,setConfirmCancel]=useState(false);
  const fileRef=useRef(null);

  const notify=(type,title,description)=>{
    setToast({type,title,description});
    window.setTimeout(()=>setToast(null),4000);
  };

  useEffect(()=>{
    const savedId=window.localStorage.getItem("lordsu.activeBuild");
    if(!savedId){setRestoring(false);return;}
    fetch(`${API}/api/builds/${savedId}`,{cache:"no-store"})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to restore build");setJob(d);setStartedAt(d.startedAt?new Date(d.startedAt).getTime():null);if(terminalStatuses.includes(d.status))window.localStorage.removeItem("lordsu.activeBuild");})
      .catch(()=>window.localStorage.removeItem("lordsu.activeBuild"))
      .finally(()=>setRestoring(false));
  },[]);

  useEffect(()=>{
    if(!job?.id||terminalStatuses.includes(job.status))return;
    const poll=async()=>{
      try{
        const r=await fetch(`${API}/api/builds/${job.id}`,{cache:"no-store"});
        const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to read build status");
        const previous=job.status;
        setJob(d);setStartedAt(d.startedAt?new Date(d.startedAt).getTime():startedAt);
        if(d.status==="ready"&&previous!=="ready")notify("success","Build complete","Your APK has been signed and verified.");
        if(d.status==="failed"&&previous!=="failed")notify("error","Build failed",conciseError(d.error));
      }catch(e){setError(e.message);}
    };
    poll();const t=setInterval(poll,2000);return()=>clearInterval(t);
  },[job?.id,job?.status]);

  useEffect(()=>{
    if(!job?.id||terminalStatuses.includes(job.status))return;
    const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);
  },[job?.id,job?.status]);

  const elapsed=useMemo(()=>startedAt?Math.max(0,Math.floor((now-startedAt)/1000)):0,[now,startedAt]);
  const elapsedText=`${Math.floor(elapsed/60)}m ${String(elapsed%60).padStart(2,"0")}s`;
  const current=Math.max(0,steps.findIndex(([id])=>id===job?.stage));
  const hasActiveBuild=Boolean(job?.id&&!terminalStatuses.includes(job.status));

  async function build(e){
    e.preventDefault();setError("");
    const name=form.name.trim(),packageName=form.packageName.trim().toLowerCase();
    if(!name){notify("error","Manager name required","Give your manager a name before starting the build.");return;}
    if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)){const msg="Use a valid lowercase package name, for example com.example.myroot.";setError(msg);notify("error","Invalid package name",msg);return;}
    if(hasActiveBuild){notify("info","Build already running","Finish or cancel the current build before starting another one.");return;}
    setBusy(true);setJob({status:"queued",stage:"preparing",progress:0,message:"Waiting for worker"});setStartedAt(Date.now());
    try{
      const fd=new FormData();
      Object.entries({...form,name,packageName}).forEach(([k,v])=>{if(v!==null)fd.append(k,v)});
      const r=await fetch(`${API}/api/builds`,{method:"POST",body:fd}),d=await r.json();
      if(!r.ok)throw new Error(d.error||"Unable to create build");
      setJob(d);setStartedAt(d.startedAt?new Date(d.startedAt).getTime():Date.now());window.localStorage.setItem("lordsu.activeBuild",d.id);
      notify("success","Build queued","Your isolated Android build has started.");
    }catch(e){setJob({status:"failed",stage:"failed",progress:0,error:e.message});setError(e.message);notify("error","Could not start build",e.message);}
    finally{setBusy(false);}
  }

  async function cancelBuild(){
    if(!job?.id||terminalStatuses.includes(job.status))return;
    try{
      const r=await fetch(`${API}/api/builds/${job.id}/cancel`,{method:"POST"}),d=await r.json();
      if(!r.ok)throw new Error(d.error||"Unable to cancel build");
      setJob(prev=>({...prev,...d,message:"Cancelling build…"}));setConfirmCancel(false);
      notify("info","Cancellation requested","The worker is stopping and cleaning the build.");
    }catch(e){setError(e.message);notify("error","Could not cancel build",e.message);}
  }

  function resetBuild(){setJob(null);setError("");setStartedAt(null);setConfirmCancel(false);window.localStorage.removeItem("lordsu.activeBuild");}
  async function copyValue(label,value){if(!value)return;try{await navigator.clipboard.writeText(value);setCopied(label);window.setTimeout(()=>setCopied(""),1400);}catch{}}
  function onFile(file){
    if(!file)return;
    if(!["image/png","image/webp"].includes(file.type)){notify("error","Unsupported icon","Choose a PNG or WebP image.");return;}
    if(file.size>10*1024*1024){notify("error","Icon is too large","Keep the icon under 10 MB.");return;}
    setForm(prev=>({...prev,icon:file}));
  }

  return <main className="h-screen overflow-hidden bg-[#fafafa] text-zinc-950">
    <nav className="h-14 shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-xs font-bold text-white">L</div>
          <div><div className="text-sm font-semibold tracking-tight">LordSU</div><div className="text-[9px] uppercase tracking-[.16em] text-zinc-400">Manager Builder</div></div>
        </div>
        <div className="rounded-full border bg-zinc-50 px-3 py-1.5 text-xs font-medium">Application</div>
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[11px] text-zinc-500">
          <span className={`h-1.5 w-1.5 rounded-full ${hasActiveBuild?"bg-amber-500":"bg-emerald-500"}`}/>{hasActiveBuild?"Build in progress":"Service online"}
        </div>
      </div>
    </nav>

    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-7xl flex-col overflow-hidden px-5 py-4 sm:px-8">
      <header className="mb-4 shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500"><span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1"><Sparkles size={11}/> Application</span><span className="text-zinc-300">/</span><span>New manager</span></div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Create your manager</h1><p className="mt-1 text-xs text-zinc-500 sm:text-sm">Configure the identity and backend, then build a signed Android manager.</p></div>
          <div className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex"><ShieldCheck size={14}/> Signed & verified output</div>
        </div>
      </header>

      {restoring?<div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1.05fr_.95fr]"><Card><CardContent className="space-y-4 p-5"><Skeleton className="h-4 w-32"/><Skeleton className="h-10 w-full"/><Skeleton className="h-4 w-28"/><Skeleton className="h-10 w-full"/><Skeleton className="h-20 w-full"/><Skeleton className="h-24 w-full"/><Skeleton className="h-10 w-full"/></CardContent></Card><Card><CardContent className="space-y-4 p-5"><Skeleton className="h-4 w-36"/><Skeleton className="h-16 w-full"/><Skeleton className="h-7 w-full"/><Skeleton className="h-7 w-5/6"/><Skeleton className="h-7 w-4/6"/></CardContent></Card></div>
      :<div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1.05fr_.95fr]">

        <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="min-h-0">
          <Card className="flex h-full min-h-0 flex-col overflow-hidden border-zinc-200 shadow-sm">
            <div className="shrink-0 border-b bg-white px-5 py-4">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Application details</h2><p className="mt-0.5 text-[11px] text-zinc-500">Values used in the generated APK.</p></div><span className="rounded-full bg-zinc-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Application</span></div>
            </div>
            <CardContent className="min-h-0 flex-1 p-5">
              <form onSubmit={build} className="flex h-full flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Manager name</Label><Input disabled={hasActiveBuild||busy} className="mt-1.5 h-10 rounded-xl" value={form.name} onChange={e=>{const name=e.target.value;setForm(prev=>({...prev,name,...(!packageEdited?{packageName:packageSuggestion(name)}:{})}))}} placeholder="MyRoot" required/><p className="mt-1 text-[10px] text-zinc-400">Shown on Android.</p></div>
                    <div><Label>Package name</Label><Input disabled={hasActiveBuild||busy} className="mt-1.5 h-10 rounded-xl font-mono text-[11px]" value={form.packageName} onChange={e=>{setPackageEdited(true);setForm(prev=>({...prev,packageName:e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,"")}))}} placeholder="com.example.myroot" required/><p className="mt-1 text-[10px] text-zinc-400">Lowercase dotted segments.</p></div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between"><div><Label>Application icon</Label><p className="mt-0.5 text-[10px] text-zinc-400">PNG/WebP · up to 10 MB</p></div>{form.icon&&<button type="button" onClick={()=>setForm(prev=>({...prev,icon:null}))} className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-950">Remove</button>}</div>
                    <button type="button" disabled={hasActiveBuild||busy} onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFile(e.dataTransfer.files?.[0])}} className="group mt-1.5 flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 px-3 text-left transition hover:border-zinc-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white shadow-sm">{form.icon?<FileImage size={16}/>:<Upload size={16} className="text-zinc-400 group-hover:text-zinc-700"/>}</div>
                      <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{form.icon?form.icon.name:"Upload an app icon"}</div><div className="mt-0.5 text-[10px] text-zinc-400">{form.icon?formatBytes(form.icon.size):"Drag & drop or click to browse"}</div></div>
                      <ArrowRight size={14} className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-600"/>
                    </button>
                    <input ref={fileRef} className="hidden" type="file" accept="image/png,image/webp" onChange={e=>onFile(e.target.files?.[0])}/>
                  </div>

                  <div>
                    <div className="mb-1.5"><Label>Root backend</Label><p className="mt-0.5 text-[10px] text-zinc-400">Approved upstream source.</p></div>
                    <div className="grid grid-cols-2 gap-3">
                      {backends.map(backend=><motion.button whileHover={{y:-1}} whileTap={{scale:.995}} type="button" disabled={hasActiveBuild||busy} key={backend.id} onClick={()=>setForm(prev=>({...prev,backend:backend.id}))} className={`relative cursor-pointer overflow-hidden rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed ${form.backend===backend.id?"border-zinc-950 bg-zinc-950 text-white shadow-md":"border-zinc-200 bg-white hover:border-zinc-400"}`}>
                        {form.backend===backend.id&&<motion.div layoutId="backend-active" className="absolute inset-x-0 top-0 h-0.5 bg-white"/>}
                        <div className="flex items-center justify-between"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><Code2 size={14}/></div>{form.backend===backend.id&&<CheckCircle2 size={16}/>}</div>
                        <div className="mt-2.5 text-xs font-semibold">{backend.name}</div><div className={`mt-0.5 text-[10px] ${form.backend===backend.id?"text-white/60":"text-zinc-500"}`}>{backend.desc}</div>
                        <div className={`mt-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-wider ${form.backend===backend.id?"text-white/60":"text-zinc-400"}`}><GitBranch size={9}/>{backend.branch}</div>
                      </motion.button>)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-zinc-50 px-3 py-2.5">
                    <div className="flex items-center gap-2"><Zap size={14}/><div><div className="text-[11px] font-semibold">Release channel</div><div className="text-[9px] text-zinc-400">Use the approved backend branch.</div></div></div>
                    <div className="relative w-32"><select disabled={hasActiveBuild||busy} value={form.version} onChange={e=>setForm(prev=>({...prev,version:e.target.value}))} className="h-8 w-full cursor-pointer appearance-none rounded-lg border bg-white px-2 pr-7 text-[10px] outline-none"><option value="stable">Stable</option><option value="latest">Latest upstream</option></select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"/></div>
                  </div>
                </div>

                <div>
                  <Button type="submit" size="lg" disabled={busy||hasActiveBuild} className="h-10 w-full cursor-pointer rounded-xl text-xs shadow-sm">
                    {busy?<><Loader2 className="mr-2 animate-spin" size={15}/>Submitting…</>:hasActiveBuild?<><Loader2 className="mr-2 animate-spin" size={15}/>Build in progress</>:<>Build manager <ArrowRight className="ml-2" size={15}/></>}
                  </Button>
                  {error&&!hasActiveBuild&&<p className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600"><AlertCircle size={12}/>{conciseError(error)}</p>}
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:.05}} className="min-h-0">
          <Card className="flex h-full min-h-0 flex-col overflow-hidden border-zinc-200 shadow-sm">
            <div className="shrink-0 border-b bg-white px-5 py-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Build activity</h2><p className="mt-0.5 text-[11px] text-zinc-500">Live status from the isolated worker.</p></div>{job?.status&&<span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${job.status==="ready"?"bg-emerald-50 text-emerald-700":job.status==="failed"?"bg-red-50 text-red-700":job.status==="cancelled"?"bg-zinc-100 text-zinc-500":"bg-amber-50 text-amber-700"}`}>{job.status}</span>}</div></div>
            <CardContent className="min-h-0 flex-1 p-5">
              {!job?<div className="flex h-full flex-col items-center justify-center text-center"><div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-zinc-50"><PackageCheck size={21} className="text-zinc-400"/></div><h3 className="mt-3 text-xs font-semibold">No build running</h3><p className="mt-1 max-w-xs text-[10px] leading-4 text-zinc-400">Complete the application form and live build progress will appear here.</p></div>
              :<AnimatePresence mode="wait"><motion.div key={job.status} initial={{opacity:0}} animate={{opacity:1}} className="flex h-full flex-col">
                {job.status!=="failed"&&job.status!=="cancelled"&&<div className="shrink-0 rounded-xl bg-zinc-950 p-4 text-white"><div className="flex items-center justify-between gap-3"><div><div className="text-[9px] uppercase tracking-[.16em] text-white/40">Current stage</div><div className="mt-1 text-sm font-semibold">{job.message||"Waiting for worker"}</div></div><div className="text-xl font-semibold tabular-nums">{Math.round(job.progress||0)}%</div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div animate={{width:`${Math.max(0,Math.min(100,job.progress||0))}%`}} transition={{duration:.45}} className="h-full rounded-full bg-white"/></div><div className="mt-2.5 flex items-center gap-2 text-[9px] text-white/45"><Clock3 size={11}/>{elapsedText}<span>·</span><Wifi size={11}/>Live polling</div></div>}

                {job.status==="failed"||job.status==="cancelled"?<div className={`rounded-xl border p-4 ${job.status==="failed"?"border-red-200 bg-red-50":"border-zinc-200 bg-zinc-50"}`}>
                  <div className="flex gap-2.5"><AlertCircle size={16} className={job.status==="failed"?"mt-0.5 text-red-600":"mt-0.5 text-zinc-500"}/><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{job.status==="failed"?"Build failed":"Build cancelled"}</div><p className="mt-1 text-[10px] leading-4 text-zinc-500">{conciseError(job.error)}</p>{job.error&&<details className="mt-2"><summary className="cursor-pointer text-[9px] font-medium text-zinc-500">View build details</summary><pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/70 p-2 text-[8px] leading-3 text-zinc-500">{job.error}</pre></details>}</div></div>
                  <Button variant="outline" size="sm" className="mt-3 h-8 w-full cursor-pointer text-[10px]" onClick={resetBuild}><RefreshCw size={12} className="mr-1.5"/>Start another build</Button>
                </div>
                :<div className="flex-1 pt-2">{steps.map(([id,title],i)=>{const done=job.status==="ready"?true:i<current;const active=i===current;return <div key={id} className="flex items-center gap-2 rounded-lg px-1 py-1.5"><div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${done?"border-emerald-600 bg-emerald-600 text-white":active?"border-zinc-950 bg-zinc-950 text-white":"border-zinc-200 text-zinc-300"}`}>{done?<Check size={11}/>:active?<Loader2 size={11} className="animate-spin"/>:<span className="h-1.5 w-1.5 rounded-full bg-current"/>}</div><div className={`text-[10px] font-medium ${done||active?"text-zinc-900":"text-zinc-400"}`}>{title}</div>{active&&!done&&<span className="ml-auto text-[8px] text-zinc-400">Working</span>}{done&&<CheckCircle2 size={12} className="ml-auto text-emerald-600"/>}</div>})}</div>}

                {job.status==="ready"&&job.downloadUrl&&<div className="mt-3 shrink-0 rounded-xl border bg-zinc-50 p-3">
                  <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white"><PackageCheck size={15}/></div><div className="min-w-0"><div className="text-xs font-semibold">APK ready</div><div className="truncate text-[9px] text-zinc-500">{job.fileName}</div></div></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]"><div className="rounded-lg border bg-white p-2"><div className="text-zinc-400">Size</div><div className="mt-0.5 font-medium">{formatBytes(job.size)}</div></div><div className="rounded-lg border bg-white p-2"><div className="text-zinc-400">Source</div><div className="mt-0.5 font-mono font-medium">{shortHash(job.sourceCommit)}</div></div></div>
                  {job.sha256&&<div className="mt-2 rounded-lg border bg-white p-2"><div className="flex items-center justify-between text-[8px] text-zinc-400"><span>SHA-256</span><button type="button" onClick={()=>copyValue("sha",job.sha256)} className="inline-flex cursor-pointer items-center gap-1 text-zinc-500 hover:text-zinc-950">{copied==="sha"?<Check size={10}/>:<Copy size={10}/>} {copied==="sha"?"Copied":"Copy"}</button></div><div className="mt-0.5 break-all font-mono text-[8px] leading-3 text-zinc-600">{job.sha256}</div></div>}
                  <a href={API+job.downloadUrl} className="mt-2 flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-zinc-950 text-[10px] font-medium text-white transition hover:bg-zinc-800"><Download size={13}/>Download APK</a>
                  <Button variant="outline" className="mt-1.5 h-8 w-full cursor-pointer text-[10px]" onClick={resetBuild}>Create another manager</Button>
                </div>}

                {hasActiveBuild&&<div className="mt-3 shrink-0">{confirmCancel?<div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2"><span className="flex-1 text-[9px] text-red-700">Stop this build?</span><button type="button" onClick={()=>setConfirmCancel(false)} className="cursor-pointer rounded-md px-2 py-1 text-[9px] text-zinc-600 hover:bg-white">Keep</button><button type="button" onClick={cancelBuild} className="cursor-pointer rounded-md bg-red-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-red-700">Cancel</button></div>:<button type="button" onClick={()=>setConfirmCancel(true)} disabled={job.status==="cancelling"} className="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-200 text-[10px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{job.status==="cancelling"?<><Loader2 size={11} className="animate-spin"/>Cancelling…</>:<><X size={11}/>Cancel build</>}</button>}</div>}
              </motion.div></AnimatePresence>}
            </CardContent>
          </Card>
        </motion.section>
      </div>}
    </div>
    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </main>;
}
