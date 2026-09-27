"use client";

import Image from "next/image";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        // Only same-site paths: "//evil.example" or a full URL would leave the app.
        const next = params.get("next");
        router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/build");
        router.refresh();
        return;
      }
      if (response.status === 401) {
        setError("Wrong password.");
        input.current?.select();
      } else {
        setError(`Server error (${response.status}). Try again in a moment.`);
      }
    } catch {
      setError("Couldn't reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-xl">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/app-icon.png" alt="" width={64} height={64} priority className="size-16 rounded-2xl shadow-md" />
        <div>
          <h1 className="page-title text-3xl">Kansas City Torrent</h1>
          <p className="text-sm text-muted-foreground">Perfect Team command centre</p>
        </div>
      </div>
      <div aria-hidden className="stitch-rule" />
      <input
        ref={input}
        type="password"
        aria-label="Password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
      />
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    /**
     * Fixed and opaque so it covers the app shell. The root layout renders the
     * sidebar and header around every route including this one, and a signed-out
     * visitor should not be looking at the navigation.
     *
     * `useSearchParams` forces a client-side bailout during prerender, so the
     * form has to sit inside a Suspense boundary or the static export of this
     * route fails the build.
     */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
