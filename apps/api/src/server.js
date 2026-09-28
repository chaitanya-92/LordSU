import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import {z} from "zod";
import {Queue} from "bullmq";
import IORedis from "ioredis";

const app=express(),upload=multer({dest:"/tmp/lordsu-uploads",limits:{fileSize:2*1024*1024}});
const port=Number(process.env.PORT||4000),redis=new IORedis(process.env.REDIS_URL||"redis://127.0.0.1:6379",{maxRetriesPerRequest:null});
const queue=new Queue("lordsu-builds",{connection:redis});
const jobs=new Map();
app.use(cors());app.use(express.json());

const schema=z.object({
 name:z.string().trim().min(1).max(64),
 packageName:z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/).max(128),
 backend:z.enum(["kernelsu","kernelsu-next"]),
 version:z.string().max(64).default("stable")
});

app.get("/health",(_q,s)=>s.json({ok:true,service:"lordsu-api"}));

app.post("/api/builds",upload.single("icon"),async(req,res)=>{
 const parsed=schema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0].message});
 const id=crypto.randomUUID();
 const job={id,status:"queued",createdAt:new Date().toISOString(),config:parsed.data,iconPath:req.file?.path||null};
 jobs.set(id,job);
 await queue.add("build",{id,config:parsed.data,iconPath:job.iconPath},{jobId:id,removeOnComplete:100,removeOnFail:100});
 res.status(202).json({id,status:"queued"});
});

app.get("/api/builds/:id",(req,res)=>{
 const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:"Build not found"});res.json(j);
});

app.listen(port,()=>console.log(`LordSU API listening on :${port}`));
