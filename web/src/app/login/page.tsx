"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (response.ok) {
      router.replace(params.get("next") ?? "/");
      router.refresh();
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xs space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Kansas City Torrent</h1>
        <p className="text-sm text-muted-foreground">Perfect Team command centre</p>
      </div>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
