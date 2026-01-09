import Link from "next/link";
import landingStyles from "../LandingPage.module.css";
import styles from "../ContentPage.module.css";

export const metadata = {
  title: "About | STL Generation",
};

export default function AboutPage() {
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
            <h2 className={styles.title}>About this project</h2>
            <p className={styles.lead}>
              We’re building a simple, fast way to generate parametric STL files and slice G‑code in one place. Our goal is to remove the busywork so you can focus on ideas and iteration.
            </p>

            <h3 className={styles.sectionTitle}>What we’re aiming for</h3>
            <ul className={styles.list}>
              <li>Clean, predictable templates for common shapes and fixtures.</li>
              <li>Instant feedback with a live preview as parameters change.</li>
              <li>One‑click export to STL and ready‑to‑print G‑code.</li>
              <li>Reasonable defaults with profiles for popular printers.</li>
            </ul>

            <h3 className={styles.sectionTitle}>Why it matters</h3>
            <p>
              Parametric modeling is powerful, but it shouldn’t be intimidating. By packaging templates, slicing, and exports into a single flow, we reduce context switching and make iteration feel effortless.
            </p>

            <div className={styles.ctaRow}>
              <Link href="/designer" className={styles.primaryBtn}>Start Designing</Link>
              <Link href="/templates" className={styles.secondaryBtn}>Browse Templates</Link>
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
