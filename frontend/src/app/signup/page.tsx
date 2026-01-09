"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpWithEmail } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      await signUpWithEmail(email, password);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200/40 dark:border-neutral-800/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Create an account</h1>
        <p className="text-sm text-neutral-500 mb-6">It’s quick and free.</p>

        {error && (
          <div className="mb-4 rounded-md border border-red-300/50 bg-red-50 text-red-700 px-3 py-2 text-sm dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm mb-1">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm mb-1">Password</label>
            <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm mb-1">Confirm password</label>
            <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-md bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60">
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
