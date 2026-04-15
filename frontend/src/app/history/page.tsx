"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthNavLink from "@/components/AuthNavLink";
import { useAuth } from "@/contexts/AuthContext";
import landingStyles from "../LandingPage.module.css";
import styles from "./HistoryPage.module.css";

type RunOutput = {
  type: string;
  filename: string;
  path?: string;
  size_bytes?: number;
};

type RunRecord = {
  id: string;
  created_at: string;
  operation: string;
  template_id?: string | null;
  template_file?: string | null;
  template_source?: string;
  params?: Record<string, any>;
  profile?: string | null;
  slice_settings?: Record<string, any> | null;
  effective_slice_settings?: Record<string, any> | null;
  printer_definition?: string | null;
  multi_part?: boolean;
  parts?: string[];
  outputs?: RunOutput[];
};

export default function HistoryPage() {
  const { user } = useAuth();

  const apiBaseUrl = useMemo(() => {
    const serverDefault = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    if (typeof window === "undefined") return serverDefault;
    return process.env.NEXT_PUBLIC_API_URL_BROWSER ?? serverDefault;
  }, []);

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading run history...");

  const loadRuns = async () => {
    setLoading(true);
    setMessage("Loading run history...");
    try {
      const headers: HeadersInit = {};
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      const res = await fetch(`${apiBaseUrl}/runs?limit=100`, { headers });
      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      }

      const payload = await res.json();
      setRuns(payload.runs ?? []);
      setMessage("Run history loaded.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load run history";
      setRuns([]);
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [apiBaseUrl, user?.uid]);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString();
  };

  const copyRunJson = async (run: RunRecord) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(run, null, 2));
    } catch {
      // no-op clipboard fallback
    }
  };

  return (
    <main className={landingStyles.container}>
      <header className={landingStyles.navbar}>
        <h1 className={landingStyles.logo}>STL GENERATION</h1>
        <nav className={landingStyles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/upload">Upload</Link>
          <Link href="/history">History</Link>
          <Link href="/about">About</Link>
          <AuthNavLink className={landingStyles.loginBtn} />
        </nav>
      </header>

      <section className={styles.wrap}>
        <div className={styles.card}>
          <article className={styles.inner}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>Job History and Reproducibility</h2>
              <div className={styles.controls}>
                <button className={styles.refreshBtn} onClick={loadRuns} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            <p className={styles.subtitle}>
              Every generation and slicing run is recorded with template, parameters, slicer settings, printer, and outputs.
            </p>

            <div className={styles.historyList}>
              {runs.length === 0 ? (
                <p className={styles.empty}>{loading ? "Loading..." : message}</p>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className={styles.item}>
                    <div className={styles.itemTop}>
                      <div>
                        <p className={styles.itemTitle}>
                          {(run.template_id || run.template_file || "custom") + " • " + run.operation}
                        </p>
                        <p className={styles.itemMeta}>Run ID: {run.id}</p>
                        <p className={styles.itemMeta}>Created: {formatDate(run.created_at)}</p>
                        <p className={styles.itemMeta}>Profile: {run.profile || "n/a"}</p>
                        <p className={styles.itemMeta}>Printer: {run.printer_definition || "n/a"}</p>
                      </div>

                      <div className={styles.controls}>
                        <Link
                          href={run.template_id ? `/designer?id=${encodeURIComponent(run.template_id)}` : "/designer"}
                          className={styles.reuseBtn}
                        >
                          Open in Designer
                        </Link>
                        <button className={styles.copyBtn} onClick={() => copyRunJson(run)}>
                          Copy JSON
                        </button>
                      </div>
                    </div>

                    <p className={styles.outputs}>
                      Outputs: {(run.outputs ?? []).map((o) => o.filename).join(", ") || "none"}
                    </p>

                    <details className={styles.details}>
                      <summary>Show reproducibility details</summary>
                      <pre className={styles.jsonBlock}>{JSON.stringify({
                        params: run.params ?? {},
                        slice_settings: run.slice_settings ?? null,
                        effective_slice_settings: run.effective_slice_settings ?? null,
                        multi_part: run.multi_part ?? false,
                        parts: run.parts ?? [],
                      }, null, 2)}</pre>
                    </details>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      <footer className={landingStyles.footer}>
        <div className={landingStyles.footerLinks}>
          <Link href="/about">ABOUT</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
        <div className={landingStyles.socials}>
          <span>📸</span>
          <span>📘</span>
          <span>🔗</span>
        </div>
      </footer>
    </main>
  );
}
