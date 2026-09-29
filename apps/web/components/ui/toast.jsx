"use client";
import {AnimatePresence,motion} from "framer-motion";
import {AlertCircle,CheckCircle2,Info,X} from "lucide-react";

const icons={success:CheckCircle2,error:AlertCircle,info:Info};

export function Toast({toast,onClose}){
  const Icon=icons[toast?.type||"info"];
  return <AnimatePresence>
    {toast&&<motion.div initial={{opacity:0,y:-12,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-12,scale:.98}} className="fixed right-4 top-4 z-[60] w-[min(380px,calc(100vw-2rem))]">
      <div className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-xl shadow-zinc-200/60">
        <Icon size={18} className={toast.type==="error"?"mt-0.5 text-red-600":toast.type==="success"?"mt-0.5 text-emerald-600":"mt-0.5 text-zinc-700"}/>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{toast.title}</p>{toast.description&&<p className="mt-1 text-xs leading-5 text-zinc-500">{toast.description}</p>}</div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><X size={15}/></button>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
