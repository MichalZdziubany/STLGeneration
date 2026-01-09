"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import landingStyles from "../LandingPage.module.css";
import styles from "../ContentPage.module.css";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Placeholder: wire to your backend/email provider later
    setStatus("sending");
    setTimeout(() => setStatus("sent"), 600);
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

      <section className={styles.wrap}>
        <div className={styles.card}>
          <article className={styles.inner}>
            <h2 className={styles.title}>Contact us</h2>
            <p className={styles.lead}>
              Questions, ideas, or feedback? We’d love to hear from you.
            </p>

            <form className={styles.form} onSubmit={onSubmit}>
              <div className={styles.row}>
                <label htmlFor="name">Name</label>
                <input id="name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
              </div>

              <div className={styles.row}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>

              <div className={styles.row}>
                <label htmlFor="message">Message</label>
                <textarea id="message" className={styles.textarea} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" />
              </div>

              <div className={styles.ctaRow}>
                <button className={styles.primaryBtn} disabled={status !== "idle"}>
                  {status === "sending" ? "Sending…" : status === "sent" ? "Sent!" : "Send"}
                </button>
                <a className={styles.secondaryBtn} href={`mailto:support@example.com?subject=STL%20Generation%20Inquiry&body=${encodeURIComponent(message)}`}>
                  Email us directly
                </a>
              </div>
              <p className={styles.note}>We typically reply within 1–2 business days.</p>
            </form>
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
