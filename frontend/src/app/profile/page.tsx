"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteUser } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import AuthNavLink from "@/components/AuthNavLink";
import { auth } from "@/lib/firebase";
import {
  DEFAULT_USER_PROFILE_SETTINGS,
  deleteUserProfileSettings,
  UserProfileSettings,
} from "@/lib/firestore";
import {
  loadEffectiveUserProfileSettings,
  saveEffectiveUserProfileSettings,
} from "@/lib/profile-settings";
import landingStyles from "../LandingPage.module.css";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const apiBaseUrl = useMemo(() => {
    const serverDefault = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    if (typeof window === "undefined") return serverDefault;
    return process.env.NEXT_PUBLIC_API_URL_BROWSER ?? serverDefault;
  }, []);

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");

  const [printerOptions, setPrinterOptions] = useState<
    Array<{
      id: string;
      name: string;
      build_volume: {
        width: number;
        depth: number;
        height: number;
      };
    }>
  >([]);
  const [printersLoading, setPrintersLoading] = useState(false);

  const [printer, setPrinter] = useState<UserProfileSettings["printer"]>(DEFAULT_USER_PROFILE_SETTINGS.printer);
  const [printWidth, setPrintWidth] = useState(String(DEFAULT_USER_PROFILE_SETTINGS.printWidth));
  const [printHeight, setPrintHeight] = useState(String(DEFAULT_USER_PROFILE_SETTINGS.printHeight));
  const [printLength, setPrintLength] = useState(String(DEFAULT_USER_PROFILE_SETTINGS.printLength));

  const resolveLegacyPrinter = (legacyPrinter: string) => {
    const normalized = legacyPrinter.toLowerCase();
    if (!printerOptions.length) return null;

    if (normalized === "ender-3") {
      return printerOptions.find((p) => p.id.toLowerCase().includes("ender3.def.json")) ?? null;
    }
    if (normalized === "ender-3-v3") {
      return printerOptions.find((p) => p.id.toLowerCase().includes("ender3v3")) ?? null;
    }
    if (normalized === "ender-3-max") {
      return printerOptions.find((p) => p.id.toLowerCase().includes("ender3max")) ?? null;
    }

    return null;
  };

  const applyPrinterDimensions = (printerId: string) => {
    const selectedPrinter = printerOptions.find((p) => p.id === printerId);
    if (!selectedPrinter) return;
    setPrintWidth(String(selectedPrinter.build_volume.width));
    setPrintLength(String(selectedPrinter.build_volume.depth));
    setPrintHeight(String(selectedPrinter.build_volume.height));
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    let alive = true;
    const loadPrinters = async () => {
      setPrintersLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/printers`);
        if (!res.ok) {
          throw new Error(`Backend returned ${res.status}`);
        }
        const payload = await res.json();
        if (!alive) return;
        setPrinterOptions(payload.printers ?? []);
      } catch {
        if (!alive) return;
        setPrinterOptions([]);
      } finally {
        if (alive) {
          setPrintersLoading(false);
        }
      }
    };

    loadPrinters();
    return () => {
      alive = false;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!user?.uid) return;
    let alive = true;

    const load = async () => {
      setStatus("Loading profile settings...");
      try {
        const settings = await loadEffectiveUserProfileSettings(user.uid);
        if (!alive) return;
        setPrinter(settings.printer);
        setPrintWidth(String(settings.printWidth));
        setPrintHeight(String(settings.printHeight));
        setPrintLength(String(settings.printLength));
        setStatus("Ready");
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : "Unable to load settings";
        setStatus(msg);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!printerOptions.length) return;

    const selectedPrinter = printerOptions.find((p) => p.id === printer);
    if (selectedPrinter) {
      return;
    }

    const mapped = resolveLegacyPrinter(printer);
    if (mapped) {
      setPrinter(mapped.id);
      setPrintWidth(String(mapped.build_volume.width));
      setPrintLength(String(mapped.build_volume.depth));
      setPrintHeight(String(mapped.build_volume.height));
    }
  }, [printerOptions, printer]);

  const sliderMax = useMemo(() => {
    const values = [Number(printWidth), Number(printHeight), Number(printLength)].filter((n) => !Number.isNaN(n));
    if (values.length === 0) return 200;
    return Math.max(1, ...values);
  }, [printWidth, printHeight, printLength]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    const width = Number(printWidth);
    const height = Number(printHeight);
    const length = Number(printLength);

    if ([width, height, length].some((v) => Number.isNaN(v) || v <= 0)) {
      setStatus("Print width, height, and length must be positive numbers.");
      return;
    }

    setSaving(true);
    setStatus("Saving settings...");
    try {
      const persistedTo = await saveEffectiveUserProfileSettings(user.uid, {
        printer,
        printWidth: width,
        printHeight: height,
        printLength: length,
      });
      if (persistedTo === "firestore") {
        setStatus("Settings saved.");
      } else {
        setStatus("Settings saved locally in this browser (Firestore permissions blocked).");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      setStatus(msg);
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
      router.push("/login");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteAccount = async () => {
    if (!user?.uid) return;
    const confirmed = window.confirm("Delete your account permanently? This cannot be undone.");
    if (!confirmed) return;

    setBusy(true);
    setStatus("Deleting account...");
    try {
      await deleteUserProfileSettings(user.uid);
      if (!auth.currentUser) {
        throw new Error("You need to re-login before deleting your account.");
      }
      await deleteUser(auth.currentUser);
      router.push("/signup");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      setStatus(msg);
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <main className={landingStyles.container}>
        <section className={styles.wrap}>
          <div className={styles.card}>Loading...</div>
        </section>
      </main>
    );
  }

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
          <h2 className={styles.title}>Profile Settings</h2>
          <p className={styles.subtitle}>Configure your printer and build volume limits.</p>

          <p className={styles.emailRow}><strong>Signed in as:</strong> {user.email}</p>

          <form className={styles.form} onSubmit={onSave}>
            <div className={styles.row}>
              <label htmlFor="printer">Printer</label>
              <select
                id="printer"
                className={styles.select}
                value={printer}
                onChange={(e) => {
                  const selectedPrinterId = e.target.value;
                  setPrinter(selectedPrinterId);
                  applyPrinterDimensions(selectedPrinterId);
                }}
                disabled={printersLoading}
              >
                {printerOptions.length === 0 && (
                  <option value={printer}>
                    {printersLoading ? "Loading printers..." : "No Cura printers discovered"}
                  </option>
                )}
                {printerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.grid3}>
              <div className={styles.row}>
                <label htmlFor="width">Print Width (mm)</label>
                <input
                  id="width"
                  className={styles.input}
                  type="number"
                  min="1"
                  value={printWidth}
                  onChange={(e) => setPrintWidth(e.target.value)}
                />
              </div>
              <div className={styles.row}>
                <label htmlFor="height">Print Height (mm)</label>
                <input
                  id="height"
                  className={styles.input}
                  type="number"
                  min="1"
                  value={printHeight}
                  onChange={(e) => setPrintHeight(e.target.value)}
                />
              </div>
              <div className={styles.row}>
                <label htmlFor="length">Print Length (mm)</label>
                <input
                  id="length"
                  className={styles.input}
                  type="number"
                  min="1"
                  value={printLength}
                  onChange={(e) => setPrintLength(e.target.value)}
                />
              </div>
            </div>

            <p className={styles.hint}>Current designer slider max: {sliderMax} mm</p>

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={saving || busy}>
                {saving ? "Saving..." : "Save Settings"}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={onLogout} disabled={saving || busy}>
                Log Out
              </button>
              <button type="button" className={styles.dangerBtn} onClick={onDeleteAccount} disabled={saving || busy}>
                Delete Account
              </button>
            </div>

            <p className={styles.status}>{status}</p>
          </form>
        </div>
      </section>
    </main>
  );
}
