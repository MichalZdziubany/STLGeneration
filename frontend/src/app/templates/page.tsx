"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../LandingPage.module.css";

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

export default function TemplatesPage() {
  const apiBaseUrl = useMemo(() => {
    const serverDefault = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    if (typeof window === "undefined") return serverDefault;
    return process.env.NEXT_PUBLIC_API_URL_BROWSER ?? serverDefault;
  }, []);

  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Fetching templates...");

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setStatus("loading");
      setMessage("Fetching templates...");
      try {
        const res = await fetch(`${apiBaseUrl}/templates`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        const payload = await res.json();
        if (!alive) return;
        const list: TemplateCard[] = payload.templates ?? [];
        setTemplates(list);
        setStatus("ready");
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

  return (
    <main className={styles.container}>
      <header className={styles.navbar}>
        <h1 className={styles.logo}>Templates</h1>
        <nav className={styles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/designer">Designer</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>

      <section className={styles.templateGrid}>
        {status !== "ready" && (
          <div className={styles.templateState}>{message}</div>
        )}

        {status === "ready" && templates.length === 0 && (
          <div className={styles.templateState}>No templates found.</div>
        )}

        {status === "ready" && templates.map((t) => (
          <article key={`${t.id}-${t.file}`} className={styles.templateCard}>
            <div className={styles.templateHeader}>
              <span className={styles.templateGeometry}>{t.geometry}</span>
              <span className={styles.templateFile}>{t.file}</span>
            </div>
            <h3 className={styles.templateName}>{t.name}</h3>
            <p className={styles.templateDescription}>{t.description}</p>
            {t.parameters?.length > 0 && (
              <ul className={styles.templateParams}>
                {t.parameters
                  .filter((p) => p.toUpperCase() !== "CENTERED")
                  .map((p) => (
                    <li key={`${t.id}-${p}`}>{p}</li>
                  ))}
              </ul>
            )}
            <Link href={`/designer?id=${encodeURIComponent(t.file)}`} className={styles.templateCta}>
              Load in Designer →
            </Link>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/about">ABOUT</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
        <div className={styles.socials}>
          <span>📸</span>
          <span>📘</span>
          <span>🔗</span>
        </div>
      </footer>
    </main>
  );
}
