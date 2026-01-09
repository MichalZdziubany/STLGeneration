"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail, signInWithGoogle, requestPasswordReset, resetPasswordWithCode } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState<"idle" | "sending" | "sent">("idle");
  const [resetCode, setResetCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [resetting, setResetting] = useState<"idle" | "working" | "done">("idle");

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

        <div className="mt-6 text-xs text-neutral-600 flex flex-col items-center gap-2">
          <div>
            Don’t have an account? <a href="/signup" className="underline">Create one</a>
          </div>
          <button
            type="button"
            className="underline text-neutral-600 hover:text-neutral-800"
            onClick={() => {
              setForgotOpen((v) => !v);
              setResetOpen(false);
            }}
          >
            {forgotOpen ? "Hide forgot password" : "Forgot password?"}
          </button>
          {forgotOpen && (
            <div className="w-full max-w-sm mt-1">
              <label className="block text-xs mb-1">Email</label>
              <input
                type="email"
                value={resetEmail || email}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!(resetEmail || email)) return;
                  setResetSending("sending");
                  try {
                    await requestPasswordReset(resetEmail || email);
                    setResetSending("sent");
                  } catch {
                    setResetSending("idle");
                  }
                }}
                className="mt-2 w-full rounded-md bg-black text-white py-2 text-sm disabled:opacity-60"
                disabled={resetSending !== "idle"}
              >
                {resetSending === "sending" ? "Sending…" : resetSending === "sent" ? "Email sent" : "Send reset link"}
              </button>
            </div>
          )}

          <button
            type="button"
            className="underline text-neutral-600 hover:text-neutral-800"
            onClick={() => {
              setResetOpen((v) => !v);
              setForgotOpen(false);
            }}
          >
            {resetOpen ? "Hide reset form" : "Have a reset code?"}
          </button>
          {resetOpen && (
            <div className="w-full max-w-sm mt-1">
              <label className="block text-xs mb-1">Reset code</label>
              <input
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste the code from your email"
              />
              <label className="block text-xs mb-1 mt-3">New password</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full rounded-md border border-neutral-300/60 dark:border-neutral-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!resetCode || newPass.length < 6) return;
                  setResetting("working");
                  try {
                    await resetPasswordWithCode(resetCode, newPass);
                    setResetting("done");
                  } finally {
                    setTimeout(() => setResetting("idle"), 1200);
                  }
                }}
                className="mt-2 w-full rounded-md bg-black text-white py-2 text-sm disabled:opacity-60"
                disabled={resetting !== "idle"}
              >
                {resetting === "working" ? "Resetting…" : resetting === "done" ? "Password updated" : "Reset password"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
