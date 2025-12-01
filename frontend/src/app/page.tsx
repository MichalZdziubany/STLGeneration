import styles from "./css/LandingPage.module.css";
import Link from "next/link";

export default function Home() {
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
