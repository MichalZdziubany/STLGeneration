"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import landingStyles from "../LandingPage.module.css";
import styles from "../DesignerPage.module.css";

type TemplateCard = {
  id: string;
  name: string;
  geometry: string;
  file: string;
  description: string;
  parameters: string[];
  tags: string[];
  dimensions?: string;
};

export default function ClientPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const apiBaseUrl = useMemo(() => {
    const serverDefault = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    if (typeof window === "undefined") return serverDefault;
    return process.env.NEXT_PUBLIC_API_URL_BROWSER ?? serverDefault;
  }, []);

  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading template…");
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [params, setParams] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setStatus("loading");
      setMessage("Fetching templates…");
      try {
        const res = await fetch(`${apiBaseUrl}/templates`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        const payload = await res.json();
        if (!alive) return;
        const list: TemplateCard[] = payload.templates ?? [];
        setTemplates(list);
        setStatus("ready");
        setSelectedId((prev) => prev ?? (list[0]?.id ?? null));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to load templates";
        if (!alive) return;
        setStatus("error");
        setMessage(msg);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [apiBaseUrl]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setParams({});
      return;
    }
    setParams((prev) => {
      const next: Record<string, string> = {};
      (selected.parameters ?? []).forEach((p) => {
        next[p] = prev[p] ?? "";
      });
      return next;
    });
  }, [selected]);

  const onParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className={landingStyles.container}>
      <header className={landingStyles.navbar}>
        <h1 className={landingStyles.logo}>STL GENERATION</h1>
        <nav className={landingStyles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/downloads">Downloads</Link>
          <Link href="/about">About</Link>
          <Link href="/login" className={landingStyles.loginBtn}>Log In / Sign In</Link>
        </nav>
      </header>

      <section className={styles.designerWrap}>
        <div className={styles.designerGrid}>
          <div className={styles.panel}>
            {status !== "ready" && (
              <div className={landingStyles.templateState}>{message}</div>
            )}

            {status === "ready" && selected && (
              <>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>{selected.name}</h3>
                  <span className={landingStyles.templateFile}>{selected.file}</span>
                </div>
                <p className={landingStyles.templateDescription}>{selected.description}</p>

                <form className={styles.paramForm} onSubmit={onGenerate}>
                  {(selected.parameters ?? []).map((p) => (
                    <div key={p} className={styles.formRow}>
                      <label>{p}</label>
                      <input
                        className={styles.input}
                        value={params[p] ?? ""}
                        onChange={(e) => onParamChange(p, e.target.value)}
                        placeholder={`Enter ${p}`}
                      />
                    </div>
                  ))}

                  <div className={styles.actions}>
                    <button type="submit" className={styles.primaryBtn} disabled={generating}>
                      {generating ? "Generating…" : "Generate"}
                    </button>
                    <Link href="/templates" className={styles.secondaryBtn}>Back to templates</Link>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>3D Preview</h3>
            </div>
            <div className={styles.previewBox}>
              <span>Model preview will appear here.</span>
            </div>
          </div>
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
