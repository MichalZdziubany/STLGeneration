'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthNavLink from '@/components/AuthNavLink';
import TemplateUpload from '@/components/TemplateUpload';
import { useAuth } from '@/contexts/AuthContext';
import styles from './UploadPage.module.css';
import landingStyles from '../LandingPage.module.css';

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className={landingStyles.container}>
        <header className={landingStyles.navbar}>
          <h1 className={landingStyles.logo}>STL GENERATION</h1>
          <nav className={landingStyles.navLinks}>
            <Link href="/">Home</Link>
            <Link href="/templates">Templates</Link>
            <Link href="/upload">Upload</Link>
            <Link href="/about">About</Link>
            <AuthNavLink className={landingStyles.loginBtn} />
          </nav>
        </header>
        <section className={styles.uploadWrapper}>
          <div className={styles.loadingContainer}>
            <p>Loading...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className={landingStyles.container}>
      <header className={landingStyles.navbar}>
        <h1 className={landingStyles.logo}>STL GENERATION</h1>
        <nav className={landingStyles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/upload">Upload</Link>
          <Link href="/about">About</Link>
          <AuthNavLink className={landingStyles.loginBtn} />
        </nav>
      </header>

      <section className={styles.uploadWrapper}>
        <div className={styles.uploadContainer}>
          <h2 className={styles.title}>Upload Template</h2>
          <p className={styles.subtitle}>
            Share your custom 3D model templates with the community
          </p>

          {uploadSuccess && (
            <div className={styles.successMessage}>
              <p>✓ Template uploaded successfully!</p>
              <Link href="/templates" className={styles.viewTemplatesBtn}>
                View My Templates
              </Link>
            </div>
          )}

          <div className={styles.uploadFormContainer}>
            <TemplateUpload
              onSuccess={() => {
                setUploadSuccess(true);
                setTimeout(() => setUploadSuccess(false), 5000);
              }}
            />
          </div>

          <div className={styles.infoSection}>
            <h3>How to Create a Template</h3>
            <ol>
              <li>Create a Jinja2 template file with .scad.j2 extension</li>
              <li>Define parameters with Jinja2 comments: {`{# @param name {type} description #}`}</li>
              <li>Upload the file with metadata</li>
              <li>Make it public to share with others</li>
            </ol>
            <Link href="/example-templates" className={styles.docsLink}>
              View Example Templates -&gt;
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
