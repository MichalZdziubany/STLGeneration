"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./LandingPage.module.css";
import Link from "next/link";

type TemplateCard = {
  id: string;
  name: string;
  geometry: string;
  file: string;
  description: string;
  parameters: string[];
  tags: string[];
  dimensions?: string;
  link?: string;
};

export default function Home() {
  const apiBaseUrl = useMemo(() => {
    const serverDefault = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    if (typeof window === "undefined") {
      return serverDefault;
    }

    return process.env.NEXT_PUBLIC_API_URL_BROWSER ?? serverDefault;
  }, []);
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [apiMessage, setApiMessage] = useState("Run the health check to verify connectivity.");
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [templateStatus, setTemplateStatus] = useState<"loading" | "ready" | "error">("loading");
  const [templateMessage, setTemplateMessage] = useState("Fetching templates...");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [generationStatus, setGenerationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [generationMessage, setGenerationMessage] = useState("Pick a template to start generating.");

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

  useEffect(() => {
    let isMounted = true;

    const fetchTemplates = async () => {
      setTemplateStatus("loading");
      setTemplateMessage("Fetching templates...");

      try {
        const response = await fetch(`${apiBaseUrl}/templates`);

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const payload = await response.json();
        if (isMounted) {
          setTemplates(payload.templates ?? []);
          setTemplateStatus("ready");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load templates";
        if (isMounted) {
          setTemplateStatus("error");
          setTemplateMessage(message);
        }
      }
    };

    fetchTemplates();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  useEffect(() => {
    if (templateStatus !== "ready" || templates.length === 0) {
      return;
    }

    if (!selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templateStatus, templates, selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplate) {
      setParameterValues({});
      return;
    }

    setParameterValues((prev) => {
      const next: Record<string, string> = {};
      (selectedTemplate.parameters ?? []).forEach((param) => {
        next[param] = prev[param] ?? "";
      });
      return next;
    });

    setGenerationStatus("idle");
    setGenerationMessage("Adjust parameters and generate an STL.");
  }, [selectedTemplate]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleParamChange = (param: string, value: string) => {
    setParameterValues((prev) => ({ ...prev, [param]: value }));
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTemplate) {
      setGenerationStatus("error");
      setGenerationMessage("No template selected.");
      return;
    }

    setGenerationStatus("loading");
    setGenerationMessage("Generating STL...");

    const normalizedParams: Record<string, string | number> = {};
    Object.entries(parameterValues).forEach(([key, value]) => {
      if (value.trim() === "") {
        return;
      }

      const numeric = Number(value);
      normalizedParams[key] = Number.isNaN(numeric) ? value : numeric;
    });

    try {
      const response = await fetch(`${apiBaseUrl}/generate-stl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          params: normalizedParams,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedTemplate.id}-${Date.now()}.stl`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      setGenerationStatus("success");
      setGenerationMessage("STL downloaded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate STL";
      setGenerationStatus("error");
      setGenerationMessage(message);
    }
  };

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
        {templateStatus !== "ready" && (
          <div className={styles.templateState}>{templateMessage}</div>
        )}

        {templateStatus === "ready" && templates.length === 0 && (
          <div className={styles.templateState}>No templates found in backend/app/templates.</div>
        )}

        {templateStatus === "ready" &&
          templates.map((template: TemplateCard) => (
            <article key={template.id} className={styles.templateCard}>
              <div className={styles.templateHeader}>
                <span className={styles.templateGeometry}>{template.geometry}</span>
                <span className={styles.templateFile}>{template.file}</span>
              </div>

              <h3 className={styles.templateName}>{template.name}</h3>
              <p className={styles.templateDescription}>{template.description}</p>

              {template.parameters?.length > 0 && (
                <ul className={styles.templateParams}>
                  {template.parameters.map((param) => (
                    <li key={`${template.id}-${param}`}>{param}</li>
                  ))}
                </ul>
              )}

              {template.tags?.length > 0 && (
                <div className={styles.templateTagRow}>
                  {template.tags.map((tag) => (
                    <span key={`${template.id}-${tag}`} className={styles.templateTag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <Link href={template.link ?? "/designer"} className={styles.templateCta}>
                Load Template →
              </Link>
            </article>
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
