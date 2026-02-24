"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import landingStyles from "../LandingPage.module.css";
import styles from "../DesignerPage.module.css";

type TemplateCard = {
  id: string;
  name: string;
  geometry?: string;
  file?: string;
  description: string;
  parameters: string[];
  tags?: string[];
  dimensions?: string;
  userId?: string;
  isPublic?: boolean;
};

export default function ClientPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");
  const { user } = useAuth();

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
  const [slicing, setSlicing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("Ready");

  // Helper: Check if template is a user template
  const isUserTemplate = (template: TemplateCard | null): boolean => {
    return !!template?.userId;
  };

  // Helper: Fetch user template JS content from backend
  const fetchUserTemplateContent = async (templateId: string, userId: string): Promise<string | null> => {
    try {
      const headers: HeadersInit = {};
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      const res = await fetch(`${apiBaseUrl}/templates/${templateId}`, { headers });
      if (!res.ok) return null;

      const data = await res.json();
      return data.content || null;
    } catch (error) {
      console.error("Failed to fetch template content:", error);
      return null;
    }
  };

  // Helper: Execute user template via Next.js API
  const executeUserTemplate = async (
    jsCode: string,
    params: Record<string, string | number>
  ): Promise<string | null> => {
    try {
      const res = await fetch("/api/templates/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jsCode, params }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Template execution failed");
      }

      const data = await res.json();
      return data.scadCode || null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Template execution failed";
      throw new Error(msg);
    }
  };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setStatus("loading");
      setMessage("Fetching templates…");
      try {
        const headers: HeadersInit = {};
        if (user?.uid) {
          headers["user-id"] = user.uid;
        }

        const res = await fetch(`${apiBaseUrl}/templates`, { headers });
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
  }, [apiBaseUrl, user?.uid]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId || t.file === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setParams({});
      return;
    }
    setParams((prev) => {
      const next: Record<string, string> = {};
      (selected.parameters ?? [])
        .filter((p) => p.toUpperCase() !== "CENTERED")
        .forEach((p) => {
          next[p] = prev[p] ?? "";
        });
      return next;
    });
  }, [selected]);

  const onParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const getSliderConfig = (value: string) => {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    const hasNumber = trimmed !== "" && !Number.isNaN(parsed);
    const step = trimmed.includes(".") ? 0.1 : 1;
    const clamped = hasNumber ? Math.min(Math.max(parsed, 0), 200) : 0;
    return { min: 0, max: 200, step, value: clamped, enabled: true };
  };

  const onSlice = async () => {
    if (!selected) return;
    setSlicing(true);
    setStatusMsg("Slicing to G-code…");
    try {
      const normalized: Record<string, string | number> = {};
      Object.entries(params).forEach(([k, v]) => {
        if (!v || v.trim() === "") return;
        const n = Number(v);
        normalized[k] = Number.isNaN(n) ? v : n;
      });

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      let slicePayload: Record<string, any> = {
        params: normalized,
        slice_settings: null,
        profile: "balanced_profile",
        user_id: user?.uid,
      };

      // Handle user templates
      if (isUserTemplate(selected)) {
        if (!selected.userId) {
          throw new Error("User template missing userId");
        }

        const jsContent = await fetchUserTemplateContent(selected.id, selected.userId);
        if (!jsContent) {
          throw new Error("Failed to load template content");
        }

        setStatusMsg("Executing template…");
        const scadCode = await executeUserTemplate(jsContent, normalized);
        if (!scadCode) {
          throw new Error("Template execution produced no SCAD code");
        }

        slicePayload.scad_code = scadCode;
      } else {
        // Built-in template
        slicePayload.template_id = selected.file ?? selected.id;
      }

      setStatusMsg("Slicing to G-code…");
      const res = await fetch(`${apiBaseUrl}/slice`, {
        method: "POST",
        headers,
        body: JSON.stringify(slicePayload),
      });

      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(selected.file ?? selected.id).replace(".scad.j2", "")}-${Date.now()}.gcode`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMsg("G-code downloaded successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to slice G-code";
      setStatusMsg(msg);
    } finally {
      setSlicing(false);
    }
  };

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setGenerating(true);
    setStatusMsg("Generating STL…");
    try {
      const normalized: Record<string, string | number> = {};
      Object.entries(params).forEach(([k, v]) => {
        if (!v || v.trim() === "") return;
        const n = Number(v);
        normalized[k] = Number.isNaN(n) ? v : n;
      });

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      let generatePayload: Record<string, any> = {
        params: normalized,
        user_id: user?.uid,
      };

      // Handle user templates
      if (isUserTemplate(selected)) {
        if (!selected.userId) {
          throw new Error("User template missing userId");
        }

        const jsContent = await fetchUserTemplateContent(selected.id, selected.userId);
        if (!jsContent) {
          throw new Error("Failed to load template content");
        }

        setStatusMsg("Executing template…");
        const scadCode = await executeUserTemplate(jsContent, normalized);
        if (!scadCode) {
          throw new Error("Template execution produced no SCAD code");
        }

        generatePayload.scad_code = scadCode;
      } else {
        // Built-in template
        generatePayload.template_id = selected.file ?? selected.id;
      }

      setStatusMsg("Generating STL…");
      const res = await fetch(`${apiBaseUrl}/generate-stl`, {
        method: "POST",
        headers,
        body: JSON.stringify(generatePayload),
      });

      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(selected.file ?? selected.id).replace(".scad.j2", "")}-${Date.now()}.stl`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMsg("STL downloaded successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate STL";
      setStatusMsg(msg);
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
          <Link href="/upload">Upload</Link>
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
                </div>
                <p className={landingStyles.templateDescription}>{selected.description}</p>

                <form className={styles.paramForm} onSubmit={onGenerate}>
                  {(selected.parameters ?? [])
                    .filter((p) => p.toUpperCase() !== "CENTERED")
                    .map((p) => (
                      <div key={p} className={styles.formRow}>
                        <label>{p}</label>
                        {(() => {
                          const cfg = getSliderConfig(params[p] ?? "");
                          return (
                            <div className={styles.paramControls}>
                              <input
                                type="number"
                                className={styles.input}
                                value={params[p] ?? ""}
                                onChange={(e) => onParamChange(p, e.target.value)}
                                placeholder={`Enter ${p}`}
                              />
                              <input
                                type="range"
                                className={styles.slider}
                                min={cfg.min}
                                max={cfg.max}
                                step={cfg.step}
                                value={cfg.value}
                                disabled={!cfg.enabled}
                                onChange={(e) => onParamChange(p, e.target.value)}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    ))}

                  <div className={styles.actions}>
                    <button type="submit" className={styles.primaryBtn} disabled={generating}>
                      {generating ? "Generating…" : "Generate STL"}
                    </button>
                    <button type="button" className={styles.secondaryBtn} onClick={onSlice} disabled={slicing}>
                      {slicing ? "Slicing…" : "Slice G-code"}
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
              <span>{statusMsg}</span>
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
