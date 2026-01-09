import Link from "next/link";
import landingStyles from "../LandingPage.module.css";
import styles from "../ContentPage.module.css";

export const metadata = {
  title: "Privacy Policy | STL Generation",
};

export default function PrivacyPage() {
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
            <h2 className={styles.title}>Privacy Policy</h2>
            <p className={styles.lead}>
              We care about your privacy. This page explains what we collect, why we collect it, and the choices you have.
            </p>

            <h3 className={styles.sectionTitle}>Information we collect</h3>
            <ul className={styles.list}>
              <li>Account details you provide (e.g., email) when signing in.</li>
              <li>Usage data to improve performance and reliability.</li>
              <li>Generated files metadata (e.g., template used, parameters) to help with history and troubleshooting.</li>
            </ul>

            <h3 className={styles.sectionTitle}>How we use information</h3>
            <ul className={styles.list}>
              <li>Provide and improve STL generation and slicing features.</li>
              <li>Secure the service, prevent abuse, and debug issues.</li>
              <li>Communicate important updates about your account or service changes.</li>
            </ul>

            <h3 className={styles.sectionTitle}>Third‑party services</h3>
            <p>
              We may rely on third‑party infrastructure (e.g., authentication or analytics). Those providers process data according to their policies. We aim to keep integrations minimal and privacy‑respecting.
            </p>

            <h3 className={styles.sectionTitle}>Data retention</h3>
            <p>
              We keep data only for as long as necessary to provide the service and comply with legal obligations. You can request deletion of your account data at any time.
            </p>

            <h3 className={styles.sectionTitle}>Your choices</h3>
            <ul className={styles.list}>
              <li>You can access, update, or delete your account data upon request.</li>
              <li>You can opt out of non‑essential analytics where applicable.</li>
            </ul>

            <h3 className={styles.sectionTitle}>Contact</h3>
            <p>
              Questions about this policy? Reach us at <a href="mailto:support@example.com">support@example.com</a> or use the <Link href="/contact">contact form</Link>.
            </p>

            <p className={styles.muted}>
              This policy may evolve as the product grows. We’ll notify you about significant changes.
            </p>
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
