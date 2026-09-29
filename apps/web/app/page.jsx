"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {AnimatePresence,motion} from "framer-motion";
import {
  AlertCircle,ArrowRight,Check,CheckCircle2,ChevronDown,Clock3,Code2,Copy,
  Download,FileImage,GitBranch,Loader2,PackageCheck,Play,RefreshCw,ShieldCheck,
  Sparkles,Upload,Wifi, X, Zap
} from "lucide-react";
import {Button} from "../components/ui/button";
import {Input} from "../components/ui/input";
import {Label} from "../components/ui/label";
import {Card,CardContent} from "../components/ui/card";
import {Skeleton} from "../components/ui/skeleton";
import {Dialog} from "../components/ui/dialog";
import {Toast} from "../components/ui/toast";

const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000";

const backends=[
  {id:"kernelsu",name:"KernelSU",desc:"Kernel-based root backend",branch:"main"},
  {id:"kernelsu-next",name:"KernelSU Next",desc:"KernelSU-compatible backend",branch:"dev"}
];

const steps=[
  ["preparing","Preparing"],
  ["source","Source"],
  ["branding","Branding"],
  ["signing-setup","Signing"],
  ["compile","Compiling"],
  ["package","Packaging"],
  ["align","Optimizing"],
  ["sign","Signing"],
  ["verify","Verifying"],
  ["ready","Complete"]
];

const packageSuggestion=(name)=>{
  const slug=name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"").replace(/^[^a-z]+/,"")||"manager";
  return `com.${slug}.manager`;
};

const terminalStatuses=["ready","failed","cancelled"];

function formatBytes(bytes){
  if(!bytes)return "—";
  return `${(bytes/1024/1024).toFixed(2)} MB`;
}

function shortHash(value=""){
  return value.length>18?`${value.slice(0,10)}…${value.slice(-8)}`:value;
}

export default function Home(){
  const [form,setForm]=useState({name:"",packageName:"",backend:"kernelsu",version:"stable",icon:null});
  const [job,setJob]=useState(null);
  const [busy,setBusy]=useState(false);
  const [restoring,setRestoring]=useState(true);
  const [error,setError]=useState("");
  const [packageEdited,setPackageEdited]=useState(false);
  const [startedAt,setStartedAt]=useState(null);
  const [now,setNow]=useState(Date.now());
  const [confirmCancel,setConfirmCancel]=useState(false);
  const [toast,setToast]=useState(null);
  const [copied,setCopied]=useState("");
  const fileRef=useRef(null);

  const notify=(type,title,description)=>{
    setToast({type,title,description});
    window.setTimeout(()=>setToast(null),4200);
  };

  useEffect(()=>{
    const savedId=window.localStorage.getItem("lordsu.activeBuild");
    if(!savedId){setRestoring(false);return;}
    fetch(`${API}/api/builds/${savedId}`,{cache:"no-store"})
      .then(async r=>{
        const d=await r.json();
        if(!r.ok)throw new Error(d.error||"Unable to restore build");
        setJob(d);
        setStartedAt(d.startedAt?new Date(d.startedAt).getTime():null);
        if(terminalStatuses.includes(d.status))window.localStorage.removeItem("lordsu.activeBuild");
      })
      .catch(()=>window.localStorage.removeItem("lordsu.activeBuild"))
      .finally(()=>setRestoring(false));
  },[]);

  useEffect(()=>{
    if(!job?.id||terminalStatuses.includes(job.status))return;
    const poll=async()=>{
      try{
        const r=await fetch(`${API}/api/builds/${job.id}`,{cache:"no-store"});
        const d=await r.json();
        if(!r.ok)throw new Error(d.error||"Unable to read build status");
        setJob(d);
        setStartedAt(d.startedAt?new Date(d.startedAt).getTime():startedAt);
        if(d.status==="ready")notify("success","Build complete","Your APK has been signed and verified.");
        if(d.status==="failed")notify("error","Build failed",d.error||"The worker could not complete the build.");
      }catch(e){setError(e.message)}
    };
    poll();
    const t=setInterval(poll,2000);
    return()=>clearInterval(t);
  },[job?.id,job?.status]);

  useEffect(()=>{
    if(!job?.id||terminalStatuses.includes(job.status))return;
    const t=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(t);
  },[job?.id,job?.status]);

  const elapsed=useMemo(()=>startedAt?Math.max(0,Math.floor((now-startedAt)/1000)):0,[now,startedAt]);
  const elapsedText=`${Math.floor(elapsed/60)}m ${String(elapsed%60).padStart(2,"0")}s`;
  const current=steps.findIndex(([id])=>id===job?.stage);
  const hasActiveBuild=Boolean(job?.id&&!terminalStatuses.includes(job.status));
  const selectedBackend=backends.find(b=>b.id===form.backend)||backends[0];

  async function build(e){
    e.preventDefault();
    setError("");
    const name=form.name.trim();
    const packageName=form.packageName.trim().toLowerCase();

    if(!name){
      notify("error","Manager name required","Give your manager a name before starting the build.");
      return;
    }
    if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)){
      const message="Use a valid lowercase package name, for example com.example.myroot.";
      setError(message);
      notify("error","Invalid package name",message);
      return;
    }
    if(hasActiveBuild){
      notify("info","Build already running","Finish or cancel the current build before starting another one.");
      return;
    }

    setBusy(true);
    setJob({status:"queued",stage:"preparing",progress:0,message:"Waiting for worker"});
    setStartedAt(Date.now());

    try{
      const fd=new FormData();
      Object.entries({...form,name,packageName}).forEach(([k,v])=>{if(v!==null)fd.append(k,v)});
      const r=await fetch(`${API}/api/builds`,{method:"POST",body:fd});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Unable to create build");
      setJob(d);
      setStartedAt(d.startedAt?new Date(d.startedAt).getTime():Date.now());
      window.localStorage.setItem("lordsu.activeBuild",d.id);
      notify("success","Build queued","Your isolated Android build has been created.");
    }catch(e){
      setJob({status:"failed",stage:"failed",progress:0,error:e.message});
      setError(e.message);
      notify("error","Could not start build",e.message);
    }finally{
      setBusy(false);
    }
  }

  async function cancelBuild(){
    if(!job?.id||terminalStatuses.includes(job.status))return;
    setError("");
    try{
      const r=await fetch(`${API}/api/builds/${job.id}/cancel`,{method:"POST"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Unable to cancel build");
      setJob(prev=>({...prev,...d,message:"Cancelling build…"}));
      setConfirmCancel(false);
      notify("info","Cancellation requested","The worker will stop the build and clean its temporary workspace.");
    }catch(e){
      setError(e.message);
      notify("error","Could not cancel build",e.message);
    }
  }

  function resetBuild(){
    setJob(null);
    setError("");
    setStartedAt(null);
    window.localStorage.removeItem("lordsu.activeBuild");
  }

  async function copyValue(label,value){
    if(!value)return;
    try{
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(()=>setCopied(""),1600);
    }catch{}
  }

  function onFile(file){
    if(!file)return;
    if(!["image/png","image/webp"].includes(file.type)){
      notify("error","Unsupported icon","Choose a PNG or WebP image.");
      return;
    }
    if(file.size>10*1024*1024){
      notify("error","Icon is too large","Keep the icon under 10 MB.");
      return;
    }
    setForm(prev=>({...prev,icon:file}));
  }

  return <main className="min-h-screen bg-[#fafafa] text-zinc-950">
    <nav className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white shadow-sm">L</div>
          <div>
            <div className="text-sm font-semibold tracking-tight">LordSU</div>
            <div className="text-[10px] uppercase tracking-[.16em] text-zinc-400">Manager Builder</div>
          </div>
        </div>
        <div className="hidden items-center gap-1 rounded-full border bg-zinc-50 p-1 sm:flex">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm">Application</span>
          <span className="px-3 py-1.5 text-xs text-zinc-400">Builds</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-zinc-500">
          <span className={`h-1.5 w-1.5 rounded-full ${hasActiveBuild?"bg-amber-500":"bg-emerald-500"}`}/>
          {hasActiveBuild?"Build in progress":"Service online"}
        </div>
      </div>
    </nav>

    <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <motion.header initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 shadow-sm"><Sparkles size={13}/> Application</span>
          <span className="text-zinc-300">/</span>
          <span>New manager</span>
        </div>
        <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Create your manager</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">Configure the identity and backend, then let LordSU handle the isolated Android build.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500"><ShieldCheck size={15}/> Signed & verified output</div>
        </div>
      </motion.header>

      {restoring ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
        <Card><CardContent className="space-y-6 p-6 sm:p-7"><Skeleton className="h-5 w-32"/><Skeleton className="h-11 w-full"/><Skeleton className="h-5 w-28"/><Skeleton className="h-11 w-full"/><Skeleton className="h-24 w-full"/><Skeleton className="h-28 w-full"/><Skeleton className="h-11 w-full"/></CardContent></Card>
        <Card><CardContent className="space-y-5 p-6 sm:p-7"><Skeleton className="h-5 w-40"/><Skeleton className="h-20 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-5/6"/><Skeleton className="h-8 w-4/6"/></CardContent></Card>
      </div> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">

        <motion.section initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.05}} >
          <Card className="overflow-hidden border-zinc-200 shadow-sm">
            <div className="border-b bg-white px-6 py-5 sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-base font-semibold">Application details</h2><p className="mt-1 text-xs text-zinc-500">These values become part of your generated APK.</p></div>
                <span className="hidden rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:inline-flex">Step 1 of 1</span>
              </div>
            </div>
            <CardContent className="space-y-7 p-6 sm:p-7">
              <form onSubmit={build} className="space-y-7">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label>Manager name</Label>
                    <Input disabled={hasActiveBuild||busy} className="mt-2 h-11" value={form.name} onChange={e=>{const name=e.target.value;setForm(prev=>({...prev,name,...(!packageEdited?{packageName:packageSuggestion(name)}:{})}))}} placeholder="MyRoot" required/>
                    <p className="mt-1.5 text-xs text-zinc-400">Shown as the app name on Android.</p>
                  </div>
                  <div>
                    <Label>Package name</Label>
                    <Input disabled={hasActiveBuild||busy} className="mt-2 h-11 font-mono text-xs" value={form.packageName} onChange={e=>{setPackageEdited(true);setForm(prev=>({...prev,packageName:e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,"")}))}} placeholder="com.example.myroot" required/>
                    <p className="mt-1.5 text-xs text-zinc-400">Lowercase segments separated by dots.</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between"><div><Label>Application icon</Label><p className="mt-1 text-xs text-zinc-400">PNG or WebP · up to 10 MB</p></div>{form.icon&&<button type="button" onClick={()=>setForm(prev=>({...prev,icon:null}))} className="text-xs text-zinc-500 hover:text-zinc-950">Remove</button>}</div>
                  <button type="button" disabled={hasActiveBuild||busy} onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFile(e.dataTransfer.files?.[0])}} className="group mt-3 flex w-full items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-left transition hover:border-zinc-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm">{form.icon?<FileImage size={20}/>:<Upload size={19} className="text-zinc-400 group-hover:text-zinc-700" />}</div>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{form.icon?form.icon.name:"Upload an app icon"}</div><div className="mt-1 text-xs text-zinc-400">{form.icon?formatBytes(form.icon.size):"Drag & drop or click to browse"}</div></div>
                    <ArrowRight size={16} className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-600"/>
                  </button>
                  <input ref={fileRef} className="hidden" type="file" accept="image/png,image/webp" onChange={e=>onFile(e.target.files?.[0])}/>
                </div>

                <div>
                  <div className="mb-3"><Label>Root backend</Label><p className="mt-1 text-xs text-zinc-400">Choose the approved source used for this build.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {backends.map((backend,index)=><motion.button whileHover={{y:-2}} whileTap={{scale:.99}} type="button" disabled={hasActiveBuild||busy} key={backend.id} onClick={()=>setForm(prev=>({...prev,backend:backend.id}))} className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${form.backend===backend.id?"border-zinc-950 bg-zinc-950 text-white shadow-lg shadow-zinc-200":"border-zinc-200 bg-white hover:border-zinc-400"}`}>
                      {form.backend===backend.id&&<motion.div layoutId="backend-active" className="absolute inset-x-0 top-0 h-0.5 bg-white"/>}
                      <div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/10 bg-white/10"><Code2 size={17}/></div>{form.backend===backend.id&&<CheckCircle2 size={18}/>}</div>
                      <div className="mt-4 text-sm font-semibold">{backend.name}</div>
                      <div className={`mt-1 text-xs leading-5 ${form.backend===backend.id?"text-white/60":"text-zinc-500"}`}>{backend.desc}</div>
                      <div className={`mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider ${form.backend===backend.id?"text-white/70":"text-zinc-400"}`}><GitBranch size={11}/>{backend.branch}</div>
                    </motion.button>)}
                  </div>
                </div>

                <div>
                  <Label>Release channel</Label>
                  <div className="relative mt-2">
                    <select disabled={hasActiveBuild||busy} value={form.version} onChange={e=>setForm(prev=>({...prev,version:e.target.value}))} className="h-11 w-full appearance-none rounded-xl border bg-white px-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-zinc-950/10">
                      <option value="stable">Stable</option>
                      <option value="latest">Latest upstream</option>
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                  </div>
                </div>

                <div className="rounded-2xl border bg-zinc-50 p-4">
                  <div className="flex items-start gap-3"><Zap size={16} className="mt-0.5 text-zinc-700"/><div><div className="text-xs font-semibold">Build preview</div><p className="mt-1 text-xs leading-5 text-zinc-500">LordSU will create an isolated workspace, apply your branding, compile the manager, align it, sign it and verify the final APK.</p></div></div>
                </div>

                <Button type="submit" size="lg" disabled={busy||hasActiveBuild} className="h-12 w-full rounded-xl shadow-sm">
                  {busy?<><Loader2 className="mr-2 animate-spin" size={17}/>Submitting application…</>:hasActiveBuild?<><Loader2 className="mr-2 animate-spin" size={17}/>Build in progress</>:<>Build manager <ArrowRight className="ml-2" size={17}/></>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.1}} className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-zinc-200 shadow-sm">
            <div className="border-b bg-white px-6 py-5 sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-base font-semibold">Build activity</h2><p className="mt-1 text-xs text-zinc-500">Live status from the isolated worker.</p></div>
                {job?.status&&<span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${job.status==="ready"?"bg-emerald-50 text-emerald-700":job.status==="failed"?"bg-red-50 text-red-700":job.status==="cancelled"?"bg-zinc-100 text-zinc-500":"bg-amber-50 text-amber-700"}`}>{job.status}</span>}
              </div>
            </div>

            <CardContent className="p-6 sm:p-7">
              {!job ? <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-zinc-50"><PackageCheck size={24} className="text-zinc-400"/></div>
                <h3 className="mt-5 text-sm font-semibold">No build running</h3>
                <p className="mt-2 max-w-xs text-xs leading-5 text-zinc-400">Complete the application form and your live build progress will appear here.</p>
              </div> : <AnimatePresence mode="wait">
                <motion.div key={job.status==="ready"?"ready":job.status==="failed"?"failed":job.status==="cancelled"?"cancelled":"running"} initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
                  {job.status!=="failed"&&job.status!=="cancelled"&&<div className="rounded-2xl bg-zinc-950 p-5 text-white">
                    <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-medium uppercase tracking-[.16em] text-white/40">Current stage</div><div className="mt-1.5 text-base font-semibold">{job.message||"Waiting for worker"}</div></div><div className="text-2xl font-semibold tabular-nums">{Math.round(job.progress||0)}%</div></div>
                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div animate={{width:`${Math.max(0,Math.min(100,job.progress||0))}%`}} transition={{duration:.5}} className="h-full rounded-full bg-white"/></div>
                    <div className="mt-4 flex items-center gap-2 text-[11px] text-white/45"><Clock3 size={13}/>{elapsedText}<span>·</span><Wifi size={13}/>Live polling</div>
                  </div>}

                  {job.status==="failed"||job.status==="cancelled" ? <div className={`rounded-2xl border p-5 ${job.status==="failed"?"border-red-200 bg-red-50":"border-zinc-200 bg-zinc-50"}`}>
                    <div className="flex gap-3"><AlertCircle size={18} className={job.status==="failed"?"mt-0.5 text-red-600":"mt-0.5 text-zinc-500"}/><div><div className="text-sm font-semibold">{job.status==="failed"?"Build failed":"Build cancelled"}</div><p className="mt-1 text-xs leading-5 text-zinc-500">{job.error||"The temporary workspace has been cleaned up."}</p></div></div>
                    <Button variant="outline" size="sm" className="mt-4 w-full" onClick={resetBuild}><RefreshCw size={14} className="mr-2"/>Start another build</Button>
                  </div> : <div className="space-y-1">
                    {steps.map(([id,title],i)=>{
                      const done=job.status==="ready"?i<steps.length:i<current;
                      const active=i===current;
                      return <div key={id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${done?"border-emerald-600 bg-emerald-600 text-white":active?"border-zinc-950 bg-zinc-950 text-white":"border-zinc-200 text-zinc-300"}`}>{done?<Check size={13}/>:active?<Loader2 size={13} className="animate-spin"/>:<span className="h-1.5 w-1.5 rounded-full bg-current"/>}</div>
                        <div className={`text-xs font-medium ${done||active?"text-zinc-900":"text-zinc-400"}`}>{title}</div>
                        {active&&!done&&<span className="ml-auto text-[10px] text-zinc-400">Working</span>}
                        {done&&<CheckCircle2 size={14} className="ml-auto text-emerald-600"/>}
                      </div>;
                    })}
                  </div>}

                  {job.status==="ready"&&job.downloadUrl&&<div className="rounded-2xl border bg-zinc-50 p-4">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white"><PackageCheck size={18}/></div><div className="min-w-0"><div className="text-sm font-semibold">APK ready</div><div className="mt-1 truncate text-xs text-zinc-500">{job.fileName}</div></div></div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border bg-white p-3"><div className="text-zinc-400">Size</div><div className="mt-1 font-medium">{formatBytes(job.size)}</div></div><div className="rounded-xl border bg-white p-3"><div className="text-zinc-400">Source</div><div className="mt-1 font-mono font-medium">{shortHash(job.sourceCommit)}</div></div></div>
                    {job.sha256&&<div className="mt-2 rounded-xl border bg-white p-3"><div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400"><span>SHA-256</span><button type="button" onClick={()=>copyValue("sha",job.sha256)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-950">{copied==="sha"?<Check size={12}/>:<Copy size={12}/>} {copied==="sha"?"Copied":"Copy"}</button></div><div className="mt-1 break-all font-mono text-[10px] leading-4 text-zinc-600">{job.sha256}</div></div>}
                    {job.sourceCommit&&<div className="mt-2 rounded-xl border bg-white p-3"><div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400"><span>Source commit</span><button type="button" onClick={()=>copyValue("commit",job.sourceCommit)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-950">{copied==="commit"?<Check size={12}/>:<Copy size={12}/>} {copied==="commit"?"Copied":"Copy"}</button></div><div className="mt-1 break-all font-mono text-[10px] leading-4 text-zinc-600">{job.sourceCommit}</div></div>}
                    <a href={API+job.downloadUrl} className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800"><Download size={16}/>Download APK</a>
                    <Button variant="outline" className="mt-2 w-full" onClick={resetBuild}>Create another manager</Button>
                  </div>}

                  {hasActiveBuild&&<button type="button" onClick={()=>setConfirmCancel(true)} disabled={job.status==="cancelling"} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">{job.status==="cancelling"?<><Loader2 size={14} className="animate-spin"/>Cancelling…</>:<><X size={14}/>Cancel build</>}</button>}
                </motion.div>
              </AnimatePresence>}
            </CardContent>
          </Card>
        </motion.section>
      </div>}
    </div>

    <Dialog open={confirmCancel} onOpenChange={setConfirmCancel} title="Cancel this build?" description="The worker will stop the current process and remove its temporary workspace.">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={()=>setConfirmCancel(false)}>Keep building</Button>
        <Button className="bg-red-600 text-white hover:bg-red-700" onClick={cancelBuild}>Cancel build</Button>
      </div>
    </Dialog>

    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </main>;
}
