"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./LandingPage.module.css";
import Link from "next/link";

export default function Home() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [apiMessage, setApiMessage] = useState("Run the health check to verify connectivity.");

  const pingBackend = useCallback(async () => {
    setApiStatus("loading");
    setApiMessage("Attempting to reach backend...");

    try {
      const response = await fetch(`${apiBaseUrl}/`);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const payload = await response.json();
      setApiMessage(payload.message ?? "Backend responded successfully.");
      setApiStatus("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setApiMessage(message);
      setApiStatus("error");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    pingBackend();
  }, [pingBackend]);

  const statusLabelMap = {
    idle: "Idle",
    loading: "Attempting",
    success: "Connected",
    error: "Unavailable",
  } as const;

  const statusToneClass = {
    idle: styles.statusIdle,
    loading: styles.statusLoading,
    success: styles.statusSuccess,
    error: styles.statusError,
  }[apiStatus];

  return (
    <main className={styles.container}>
      {/* NAVBAR */}
      <header className={styles.navbar}>
        <h1 className={styles.logo}>STL GENERATION</h1>

        <nav className={styles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/downloads">Downloads</Link>
          <Link href="/about">About</Link>

          <Link href="/login" className={styles.loginBtn}>
            Log In / Sign In
          </Link>
        </nav>
      </header>

      {/* HERO SECTION */}
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>
          Parameterized STL & G-code Generation
        </h2>

        <p className={styles.heroSubtitle}>
          Simple tool that combines the creation of STL files and slicing of
          g-code in one place.
        </p>

        <div className={styles.heroButtons}>
          <Link href="/designer" className={styles.primaryBtn}>
            Start Designing
          </Link>

          <Link href="/templates" className={styles.secondaryBtn}>
            Browse Templates
          </Link>
        </div>
      </section>

      {/* CONNECTIVITY STATUS */}
      <section className={styles.statusPanel}>
        <div className={styles.statusHeader}>
          <div>
            <p className={styles.statusKicker}>Connectivity</p>
            <h3 className={styles.statusTitle}>Frontend → Backend status</h3>
          </div>

          <span className={`${styles.statusPill} ${statusToneClass}`}>
            {statusLabelMap[apiStatus]}
          </span>
        </div>

        <p className={styles.statusMessage}>{apiMessage}</p>

        <button
          type="button"
          className={styles.statusButton}
          onClick={pingBackend}
          disabled={apiStatus === "loading"}
        >
          {apiStatus === "loading" ? "Checking..." : "Run Health Check"}
        </button>
      </section>

      {/* TEMPLATE GRID */}
      <section className={styles.templateGrid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={styles.templateCard}>
            <div className={styles.placeholderBox}></div>
            <p className={styles.templateLabel}>Template</p>
          </div>
        ))}
      </section>

      {/* FOOTER */}
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
