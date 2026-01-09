"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email, password);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      setLoading(true);
      await signInWithGoogle();
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200/40 dark:border-neutral-800/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Welcome back</h1>
        <p className="text-sm text-neutral-500 mb-6">Sign in to continue</p>

        {error && (
          <div className="mb-4 rounded-md border border-red-300/50 bg-red-50 text-red-700 px-3 py-2 text-sm dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
          <span className="text-xs text-neutral-500">OR</span>
          <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 py-2.5 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-neutral-500">
          This page is Firebase-ready: wire up src/lib/auth.ts with Firebase Auth.
        </p>
      </div>
    </main>
  );
}
