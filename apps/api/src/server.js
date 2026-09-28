import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 4000);
const jobs = new Map();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lordsu-api" });
});

app.post("/api/builds", (req, res) => {
  const { name, packageName, backend, version = "stable" } = req.body ?? {};

  if (typeof name !== "string" || !name.trim() || name.length > 64) {
    return res.status(400).json({ error: "Invalid manager name" });
  }

  if (typeof packageName !== "string" || packageName.length > 128) {
    return res.status(400).json({ error: "Invalid package name" });
  }

  if (!["kernelsu", "kernelsu-next"].includes(backend)) {
    return res.status(400).json({ error: "Unsupported backend" });
  }

  const id = crypto.randomUUID();

  const job = {
    id,
    status: "queued",
    createdAt: new Date().toISOString(),
    config: {
      name: name.trim(),
      packageName,
      backend,
      version
    }
  };

  jobs.set(id, job);
  return res.status(202).json(job);
});

app.get("/api/builds/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: "Build not found" });
  }

  return res.json(job);
});

app.listen(port, () => {
  console.log(`LordSU API listening on http://localhost:${port}`);
});
