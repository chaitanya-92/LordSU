"use client";
import {AnimatePresence,motion} from "framer-motion";
import {X} from "lucide-react";

export function Dialog({open,onOpenChange,title,description,children}){
  return <AnimatePresence>
    {open&&<motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={()=>onOpenChange?.(false)}>
      <motion.div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl" initial={{opacity:0,scale:.96,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.96,y:12}} transition={{duration:.18}} onMouseDown={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-base font-semibold">{title}</h2>{description&&<p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>}</div>
          <button type="button" aria-label="Close" onClick={()=>onOpenChange?.(false)} className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"><X size={17}/></button>
        </div>
        <div className="mt-5">{children}</div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}
