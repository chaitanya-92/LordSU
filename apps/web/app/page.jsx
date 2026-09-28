"use client";
import {useState} from "react";
import {Check, ChevronRight, Upload, Loader2} from "lucide-react";
import {Button} from "../components/ui/button";
import {Input} from "../components/ui/input";
import {Label} from "../components/ui/label";
import {Card,CardHeader,CardContent} from "../components/ui/card";

const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:4000";
const backends=[
 {id:"kernelsu",name:"KernelSU",desc:"Kernel-based root backend",branch:"main"},
 {id:"kernelsu-next",name:"KernelSU Next",desc:"Advanced KernelSU-compatible backend",branch:"dev"}
];

export default function Home(){
 const [form,setForm]=useState({name:"",packageName:"",backend:"kernelsu",version:"stable",icon:null});
 const [busy,setBusy]=useState(false),[job,setJob]=useState(null);
 const selected=backends.find(x=>x.id===form.backend);
 async function build(e){
  e.preventDefault();setBusy(true);setJob({status:"queued"});
  try{
   const fd=new FormData();
   Object.entries(form).forEach(([k,v])=>{if(v!==null)fd.append(k,v)});
   const r=await fetch(API+"/api/builds",{method:"POST",body:fd});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Build failed");
   setJob(d);
  }catch(e){setJob({status:"failed",error:e.message})}finally{setBusy(false)}
 }
 return <main className="min-h-screen">
  <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
   <div className="text-lg font-semibold">LordSU</div><span className="text-sm text-zinc-500">Manager Builder</span>
  </nav>
  <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_500px]">
   <section className="pt-10">
    <div className="mb-4 inline-flex rounded-full border bg-white px-3 py-1 text-xs font-medium">ON-DEMAND BUILDS</div>
    <h1 className="max-w-2xl text-5xl font-semibold tracking-tight sm:text-6xl">Build your own root manager.</h1>
    <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-500">Choose the identity, icon and approved root backend. LordSU creates a fresh manager build without requiring you to operate GitHub Actions.</p>
    <div className="mt-8 space-y-3 text-sm text-zinc-600"><p className="flex gap-2"><Check size={18}/> Isolated build jobs</p><p className="flex gap-2"><Check size={18}/> KernelSU and KernelSU Next backends</p><p className="flex gap-2"><Check size={18}/> Temporary APK delivery and verification</p></div>
   </section>
   <Card><CardHeader><h2 className="text-xl font-semibold">Create manager</h2><p className="mt-1 text-sm text-zinc-500">Configure your build.</p></CardHeader><CardContent>
    <form onSubmit={build} className="space-y-5">
     <div><Label>Manager name</Label><Input className="mt-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="MyRoot" required/></div>
     <div><Label>Package name</Label><Input className="mt-2" value={form.packageName} onChange={e=>setForm({...form,packageName:e.target.value})} placeholder="com.example.myroot" required/></div>
     <div><Label>Icon</Label><label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-zinc-500 hover:bg-zinc-50"><Upload size={18}/><span>{form.icon?form.icon.name:"Upload PNG/WebP"}</span><input className="hidden" type="file" accept="image/png,image/webp" onChange={e=>setForm({...form,icon:e.target.files?.[0]||null})}/></label></div>
     <div><Label>Root backend</Label><div className="mt-2 grid gap-2">{backends.map(b=><button type="button" key={b.id} onClick={()=>setForm({...form,backend:b.id})} className={`rounded-xl border p-4 text-left ${form.backend===b.id?"border-foreground bg-zinc-50":"hover:bg-zinc-50"}`}><div className="flex items-center justify-between font-medium">{b.name}{form.backend===b.id&&<Check size={17}/>}</div><p className="mt-1 text-xs text-zinc-500">{b.desc} · {b.branch}</p></button>)}</div></div>
     <Button className="w-full" size="lg" disabled={busy}>{busy?<><Loader2 className="mr-2 animate-spin" size={17}/>Creating build…</>:<>Build manager <ChevronRight className="ml-2" size={17}/></>}</Button>
    </form>
    {job&&<div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm"><b>{job.status==="failed"?"Build failed":job.status==="ready"?"Build ready":"Build queued"}</b>{job.id&&<p className="mt-1 text-xs text-zinc-500">Build ID: {job.id}</p>}{job.downloadUrl&&<a className="mt-3 inline-block font-medium underline" href={job.downloadUrl}>Download APK</a>}{job.error&&<p className="mt-1 text-red-600">{job.error}</p>}</div>}
   </CardContent></Card>
  </div>
 </main>
}
