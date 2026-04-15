"use client";

import { useState } from "react";
import Link from "next/link";
import AuthNavLink from "@/components/AuthNavLink";
import landingStyles from "../LandingPage.module.css";
import styles from "./ExampleTemplates.module.css";

const cubeTemplate = `//
// CUBE TEMPLATE
// Parameters are injected by backend.
// {{CUBE_SIZE}} = length of each edge
//

cube_size = {{CUBE_SIZE}};

// Non-centered cube placed in positive coordinates
cube([cube_size, cube_size, cube_size], center = false);`;

const cylinderTemplate = `//
// CYLINDER TEMPLATE
// Parameters injected by backend.
//

height    = {{HEIGHT}};
diameter  = {{DIAMETER}};
segments  = {{SEGMENTS}};   // number of cylinder facets

cylinder(
    h = height,
    d = diameter,
    center = false,
    $fn = segments
);`;

export default function ExampleTemplatesPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyTemplate = async (key: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <main className={landingStyles.container}>
      <header className={landingStyles.navbar}>
        <h1 className={landingStyles.logo}>ParamPrint Studio</h1>
        <nav className={landingStyles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/upload">Upload</Link>
          <Link href="/history">History</Link>
          <Link href="/about">About</Link>
          <AuthNavLink className={landingStyles.loginBtn} />
        </nav>
      </header>

      <section className={styles.page}>
        <div className={styles.wrap}>
          <h2 className={styles.title}>Example Templates</h2>
          <p className={styles.subtitle}>
            Starter templates you can copy and upload as `.scad.j2` files.
          </p>

          <div className={styles.grid}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Cube Template</h3>
                <div className={styles.headerRight}>
                  <span className={styles.chip}>cube_template.scad.j2</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyTemplate("cube", cubeTemplate)}
                  >
                    {copiedKey === "cube" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <pre className={styles.code}>{cubeTemplate}</pre>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Cylinder Template</h3>
                <div className={styles.headerRight}>
                  <span className={styles.chip}>cylinder_template.scad.j2</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyTemplate("cylinder", cylinderTemplate)}
                  >
                    {copiedKey === "cylinder" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <pre className={styles.code}>{cylinderTemplate}</pre>
            </article>
          </div>

          <div className={styles.actions}>
            <Link href="/upload" className={styles.primaryBtn}>Back to Upload</Link>
            <Link href="/templates" className={styles.secondaryBtn}>Browse Templates</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
