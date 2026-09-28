"use client";

import { useState } from "react";

const backends = [
  { id: "kernelsu", name: "KernelSU", description: "Build against the approved KernelSU backend." },
  { id: "kernelsu-next", name: "KernelSU Next", description: "Build against the approved KernelSU Next backend." }
];

export default function Home() {
  const [form, setForm] = useState({
    name: "",
    packageName: "",
    backend: "kernelsu",
    version: "stable"
  });
  const [status, setStatus] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("Submitting build…");

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/builds",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form)
        }
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Build request failed");

      setStatus(`Build queued · ${data.id}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_460px]">
          <section className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit rounded-full border px-3 py-1 text-xs text-muted-foreground">
              ON-DEMAND ANDROID BUILDER
            </div>
            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
              Build your own root manager.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Configure the identity and approved backend, then LordSU builds a fresh manager APK for you.
            </p>
          </section>

          <form onSubmit={submit} className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Create manager</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your input is configuration only. Builds use approved source revisions.
              </p>
            </div>

            <div className="space-y-5">
              <label className="block text-sm font-medium">
                Manager name
                <input
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 outline-none ring-offset-background focus:ring-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="MyRoot"
                  required
                />
              </label>

              <label className="block text-sm font-medium">
                Package name
                <input
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 outline-none ring-offset-background focus:ring-2"
                  value={form.packageName}
                  onChange={(e) => setForm({ ...form, packageName: e.target.value })}
                  placeholder="com.example.myroot"
                  required
                />
              </label>

              <fieldset>
                <legend className="text-sm font-medium">Root backend</legend>
                <div className="mt-2 grid gap-3">
                  {backends.map((backend) => (
                    <button
                      key={backend.id}
                      type="button"
                      onClick={() => setForm({ ...form, backend: backend.id })}
                      className={`rounded-xl border p-4 text-left transition ${
                        form.backend === backend.id
                          ? "border-foreground bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="font-medium">{backend.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{backend.description}</div>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm font-medium">
                Version
                <select
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                >
                  <option value="stable">Latest approved stable</option>
                </select>
              </label>

              <button
                type="submit"
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
              >
                Build manager
              </button>

              {status && (
                <div className="rounded-lg border bg-muted px-3 py-2 text-sm">
                  {status}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
