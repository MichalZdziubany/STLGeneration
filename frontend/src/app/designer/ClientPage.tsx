"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import StlPreview from "@/components/StlPreview";
import AuthNavLink from "@/components/AuthNavLink";
import { useAuth } from "@/contexts/AuthContext";
import { loadEffectiveUserProfileSettings } from "@/lib/profile-settings";
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

type SliceProfile = {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  file?: string;
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
  const [sliceProfiles, setSliceProfiles] = useState<SliceProfile[]>([]);
  const [sliceProfilesLoading, setSliceProfilesLoading] = useState(false);
  const [selectedSliceProfileId, setSelectedSliceProfileId] = useState<string>("balanced_profile");
  const [adhesionMode, setAdhesionMode] = useState<string>("preset");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [threadedPreviewUrls, setThreadedPreviewUrls] = useState<{ bolt: string | null; nut: string | null }>({
    bolt: null,
    nut: null,
  });
  const [previewMsg, setPreviewMsg] = useState<string>("Adjust parameters to render a live preview.");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [autoPreview, setAutoPreview] = useState(true);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [sliderMax, setSliderMax] = useState(200);
  const previewObjectUrlRef = useRef<string | null>(null);
  const threadedPreviewObjectUrlsRef = useRef<{ bolt: string | null; nut: string | null }>({
    bolt: null,
    nut: null,
  });

  // Helper: Check if template is a user template
  const isUserTemplate = (template: TemplateCard | null): boolean => {
    return !!template?.userId;
  };

  // Helper: Fetch user template JS content from backend
  const fetchUserTemplateContent = async (templateId: string, ownerUserId: string): Promise<string | null> => {
    try {
      const headers: HeadersInit = {};
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      const owner = encodeURIComponent(ownerUserId);
      const res = await fetch(`${apiBaseUrl}/templates/${templateId}?owner_user_id=${owner}`, { headers });
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
      if (!user?.uid) {
        setSliderMax(200);
        return;
      }

      try {
        const profile = await loadEffectiveUserProfileSettings(user.uid);
        if (!alive) return;
        const maxDim = Math.max(profile.printWidth, profile.printHeight, profile.printLength, 1);
        setSliderMax(maxDim);
      } catch {
        if (!alive) return;
        setSliderMax(200);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

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

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setSliceProfilesLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/profiles`);
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);

        const payload = await res.json();
        if (!alive) return;

        const profiles: SliceProfile[] = payload.profiles ?? [];
        setSliceProfiles(profiles);

        const availableIds = new Set(profiles.map((p) => p.id));
        const guidedDefault = profiles.find((p) => p.metadata?.guided_default === true)?.id;
        const fallback = guidedDefault ?? (availableIds.has("balanced_profile") ? "balanced_profile" : profiles[0]?.id ?? "balanced_profile");

        setSelectedSliceProfileId((prev) => (availableIds.has(prev) ? prev : fallback));
      } catch {
        if (!alive) return;
        setSliceProfiles([]);
        setSelectedSliceProfileId("balanced_profile");
      } finally {
        if (alive) {
          setSliceProfilesLoading(false);
        }
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [apiBaseUrl]);

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);
  const selectedSliceProfile = useMemo(
    () => sliceProfiles.find((p) => p.id === selectedSliceProfileId) ?? null,
    [sliceProfiles, selectedSliceProfileId]
  );
  const isThreadedNutBoltTemplate = useMemo(
    () => !!selected && !isUserTemplate(selected) && selected.id === "threaded_nut_bolt",
    [selected]
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
    const clamped = hasNumber ? Math.min(Math.max(parsed, 0), sliderMax) : 0;
    return { min: 0, max: sliderMax, step, value: clamped, enabled: true };
  };

  const normalizeParams = (source: Record<string, string>) => {
    const normalized: Record<string, string | number> = {};
    Object.entries(source).forEach(([k, v]) => {
      if (!v || v.trim() === "") return;
      const n = Number(v);
      normalized[k] = Number.isNaN(n) ? v : n;
    });
    return normalized;
  };

  const buildTemplatePayload = async (normalized: Record<string, string | number>) => {
    const payload: Record<string, any> = {
      params: normalized,
      user_id: user?.uid,
    };

    if (!selected) {
      throw new Error("No template selected");
    }

    if (isUserTemplate(selected)) {
      if (!selected.userId) {
        throw new Error("User template missing userId");
      }

      const jsContent = await fetchUserTemplateContent(selected.id, selected.userId);
      if (!jsContent) {
        throw new Error("Failed to load template content");
      }

      const scadCode = await executeUserTemplate(jsContent, normalized);
      if (!scadCode) {
        throw new Error("Template execution produced no SCAD code");
      }

      payload.scad_code = scadCode;
      return payload;
    }

    payload.template_id = selected.id;
    return payload;
  };

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        window.URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      if (threadedPreviewObjectUrlsRef.current.bolt) {
        window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.bolt);
        threadedPreviewObjectUrlsRef.current.bolt = null;
      }
      if (threadedPreviewObjectUrlsRef.current.nut) {
        window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.nut);
        threadedPreviewObjectUrlsRef.current.nut = null;
      }
    };
  }, []);

  const renderPreview = async (signal: AbortSignal) => {
    if (!selected) {
      setPreviewMsg("Select a template to preview.");
      setPreviewUrl(null);
      return;
    }

    const hasInput = Object.values(params).some((value) => value.trim() !== "");
    if (!hasInput) {
      setPreviewMsg("Adjust parameters to render a live preview.");
      setPreviewUrl(null);
      return;
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (user?.uid) {
      headers["user-id"] = user.uid;
    }

    setPreviewLoading(true);
    setPreviewMsg("Rendering preview…");
    try {
      const normalized = normalizeParams(params);

      if (isThreadedNutBoltTemplate) {
        const payload = await buildTemplatePayload(normalized);

        const loadPart = async (part: "bolt" | "nut") => {
          const res = await fetch(`${apiBaseUrl}/generate-stl`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              ...payload,
              params: {
                ...normalized,
                PART_MODE: part,
              },
            }),
            signal,
          });
          if (!res.ok) {
            throw new Error(`Backend returned ${res.status}`);
          }
          const blob = await res.blob();
          return window.URL.createObjectURL(blob);
        };

        const [boltUrl, nutUrl] = await Promise.all([loadPart("bolt"), loadPart("nut")]);

        if (previewObjectUrlRef.current) {
          window.URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }

        if (threadedPreviewObjectUrlsRef.current.bolt) {
          window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.bolt);
        }
        if (threadedPreviewObjectUrlsRef.current.nut) {
          window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.nut);
        }

        threadedPreviewObjectUrlsRef.current = { bolt: boltUrl, nut: nutUrl };
        setThreadedPreviewUrls({ bolt: boltUrl, nut: nutUrl });
        setPreviewUrl(null);
        setPreviewMsg("Bolt and nut previews updated.");
        return;
      }

      const payload = await buildTemplatePayload(normalized);

      const res = await fetch(`${apiBaseUrl}/generate-stl`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const blob = await res.blob();
      const nextUrl = window.URL.createObjectURL(blob);

      if (previewObjectUrlRef.current) {
        window.URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      previewObjectUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
      if (threadedPreviewObjectUrlsRef.current.bolt) {
        window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.bolt);
      }
      if (threadedPreviewObjectUrlsRef.current.nut) {
        window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.nut);
      }
      threadedPreviewObjectUrlsRef.current = { bolt: null, nut: null };
      setThreadedPreviewUrls({ bolt: null, nut: null });
      setPreviewMsg("Live preview updated.");
    } catch (err) {
      if (signal.aborted) return;
      if (previewObjectUrlRef.current) {
        window.URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      setPreviewUrl(null);
      if (threadedPreviewObjectUrlsRef.current.bolt) {
        window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.bolt);
      }
      if (threadedPreviewObjectUrlsRef.current.nut) {
        window.URL.revokeObjectURL(threadedPreviewObjectUrlsRef.current.nut);
      }
      threadedPreviewObjectUrlsRef.current = { bolt: null, nut: null };
      setThreadedPreviewUrls({ bolt: null, nut: null });
      const msg = err instanceof Error ? err.message : "Failed to render preview";
      setPreviewMsg(msg);
    } finally {
      if (!signal.aborted) {
        setPreviewLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!autoPreview) {
      setPreviewMsg("Auto preview is off. Click Refresh Preview.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      renderPreview(controller.signal);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selected, params, apiBaseUrl, user?.uid, autoPreview]);

  useEffect(() => {
    if (autoPreview || previewRefreshKey === 0) return;
    const controller = new AbortController();
    renderPreview(controller.signal);
    return () => {
      controller.abort();
    };
  }, [previewRefreshKey, autoPreview]);

  const onSlice = async () => {
    if (!selected) return;
    setSlicing(true);
    setStatusMsg("Slicing to G-code…");
    try {
      const normalized = normalizeParams(params);

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      let slicePayload: Record<string, any> = {
        params: normalized,
        slice_settings: adhesionMode === "preset" ? null : { adhesion_type: adhesionMode },
        profile: selectedSliceProfileId,
        user_id: user?.uid,
      };

      setStatusMsg("Executing template…");
      const sharedPayload = await buildTemplatePayload(normalized);
      if (sharedPayload.scad_code) {
        slicePayload.scad_code = sharedPayload.scad_code;
      }
      if (sharedPayload.template_id) {
        slicePayload.template_id = sharedPayload.template_id;
      }
      if (isThreadedNutBoltTemplate) {
        slicePayload.multi_part = true;
        slicePayload.parts = ["bolt", "nut"];
        slicePayload.part_selector_param = "PART_MODE";
      }

      setStatusMsg(
        `Slicing to G-code using ${selectedSliceProfile?.name ?? selectedSliceProfileId} preset…`
      );
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
      a.download = isThreadedNutBoltTemplate
        ? `${selected.id}-${Date.now()}-gcodes.zip`
        : `${selected.id.replace(".scad.j2", "")}-${Date.now()}.gcode`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMsg(isThreadedNutBoltTemplate ? "Bolt and nut G-code ZIP downloaded." : "G-code downloaded successfully.");
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
      const normalized = normalizeParams(params);

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (user?.uid) {
        headers["user-id"] = user.uid;
      }

      setStatusMsg("Executing template…");
      const generatePayload = await buildTemplatePayload(normalized);
      if (isThreadedNutBoltTemplate) {
        generatePayload.multi_part = true;
        generatePayload.parts = ["bolt", "nut"];
        generatePayload.part_selector_param = "PART_MODE";
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
      a.download = isThreadedNutBoltTemplate
        ? `${selected.id}-${Date.now()}-stls.zip`
        : `${selected.id.replace(".scad.j2", "")}-${Date.now()}.stl`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMsg(isThreadedNutBoltTemplate ? "Bolt and nut STL ZIP downloaded." : "STL downloaded successfully.");
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
          <AuthNavLink className={landingStyles.loginBtn} />
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

                  <div className={styles.sliceOptionsRow}>
                    <div className={styles.slicePresetBox}>
                      <label htmlFor="slice-profile">Guided slicer preset</label>
                      <select
                        id="slice-profile"
                        className={styles.input}
                        value={selectedSliceProfileId}
                        onChange={(e) => setSelectedSliceProfileId(e.target.value)}
                        disabled={sliceProfilesLoading || sliceProfiles.length === 0}
                      >
                        {sliceProfiles.length > 0 ? (
                          sliceProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name}
                            </option>
                          ))
                        ) : (
                          <option value="balanced_profile">Balanced Profile</option>
                        )}
                      </select>
                      <p className={styles.slicePresetHelp}>
                        {sliceProfilesLoading
                          ? "Loading slicer presets…"
                          : selectedSliceProfile?.description ||
                            "Preset values are merged into slicing settings and recorded in the output G-code header."}
                      </p>
                    </div>

                    <div className={styles.slicePresetBox}>
                      <label htmlFor="adhesion-mode">Optional adhesion</label>
                      <select
                        id="adhesion-mode"
                        className={styles.input}
                        value={adhesionMode}
                        onChange={(e) => setAdhesionMode(e.target.value)}
                      >
                        <option value="preset">Use preset default</option>
                        <option value="none">None</option>
                        <option value="skirt">Skirt</option>
                        <option value="brim">Brim</option>
                        <option value="raft">Raft</option>
                      </select>
                      <p className={styles.slicePresetHelp}>
                        Overrides adhesion only for this slice operation.
                      </p>
                    </div>
                  </div>

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
              <div className={styles.previewControls}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={autoPreview}
                    onChange={(e) => setAutoPreview(e.target.checked)}
                  />
                  Auto Preview
                </label>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setPreviewRefreshKey((prev) => prev + 1)}
                  disabled={previewLoading}
                >
                  {previewLoading ? "Refreshing…" : "Refresh Preview"}
                </button>
              </div>
            </div>
            <div className={styles.previewBox}>
              {isThreadedNutBoltTemplate && (threadedPreviewUrls.bolt || threadedPreviewUrls.nut) ? (
                <div className={styles.previewDualGrid}>
                  <div className={styles.previewCard}>
                    <p className={styles.previewCardTitle}>Bolt</p>
                    <div className={styles.viewerWrap}>
                      {threadedPreviewUrls.bolt ? <StlPreview url={threadedPreviewUrls.bolt} /> : <span>No bolt preview.</span>}
                    </div>
                  </div>
                  <div className={styles.previewCard}>
                    <p className={styles.previewCardTitle}>Nut</p>
                    <div className={styles.viewerWrap}>
                      {threadedPreviewUrls.nut ? <StlPreview url={threadedPreviewUrls.nut} /> : <span>No nut preview.</span>}
                    </div>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className={styles.viewerWrap}>
                  <StlPreview url={previewUrl} />
                </div>
              ) : (
                <span>{previewLoading ? "Rendering preview…" : previewMsg}</span>
              )}
            </div>
            <p className={styles.previewMeta}>{statusMsg}</p>
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
