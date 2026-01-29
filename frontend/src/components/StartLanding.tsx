import { useMemo, useState } from "react";
import { CatalogDesign, SeedCatalog } from "../data/seedCatalog";
import { fetchPalette, getJobStatus, PaletteResult, startBrandingJob } from "../api/branding";

interface StartLandingProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  onUpdate: (path: string, value: string | boolean) => void;
  onStart: () => void;
  onBrandingReady: (payload: { logoUrl: string | null; palette: PaletteResult | null }) => void;
}

export function StartLanding({ design, catalog, onUpdate, onStart, onBrandingReady }: StartLandingProps) {
  const [teamUrl, setTeamUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  const swatches = useMemo(() => {
    if (!palette) {
      return [];
    }
    const ordered = [palette.primary, palette.secondary, palette.accent, palette.neutral]
      .filter(Boolean)
      .map((color, index) => ({ ...color!, key: `slot-${index}` }));
    if (ordered.length) {
      return ordered;
    }
    return palette.colors?.map((color, index) => ({ ...color, key: `color-${index}` })) ?? [];
  }, [palette]);

  const canScan = Boolean(import.meta.env.VITE_API_BASE);

  const runScan = async () => {
    if (!canScan) {
      setMessage("Branding scan requires VITE_API_BASE to point at the Functions API.");
      return;
    }
    if (!teamUrl.trim()) {
      setMessage("Enter a team website to scan.");
      return;
    }
    setStatus("running");
    setMessage("Scanning branding… this can take a few minutes.");
    setErrorDetails(null);
    setLogoUrl(null);
    setPalette(null);
    setJobId(null);
    setCached(false);
    setCurrentStage(null);
    try {
      const job = await startBrandingJob(teamUrl.trim());
      setCached(Boolean(job.cached));
      setJobId(job.jobId);

      // Wait a moment before first poll to give orchestrator time to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const start = Date.now();
      let result = await getJobStatus(job.jobId);
      setCurrentStage(result.stage);
      setMessage(`Scanning… stage: ${result.stage}`);
      while (result.status !== "Succeeded" && result.status !== "Failed" && Date.now() - start < 600000) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        try {
          result = await getJobStatus(job.jobId);
          if (result.stage && result.stage !== currentStage) {
            setCurrentStage(result.stage);
            setMessage(`Scanning… stage: ${result.stage}`);
          }
        } catch (pollError) {
          // If polling fails (e.g., 404, 500), log but continue polling
          console.warn("Job status poll failed:", pollError);
          // Keep last known result and continue polling
        }
      }
      if (result.status !== "Succeeded") {
        setStatus("error");
        setMessage(result.error ?? "Branding job did not finish in time. You can keep checking.");
        if (result.errorDetails) {
          setErrorDetails(result.errorDetails);
        }
        return;
      }
      const logo = result.outputs?.logo?.url ?? null;
      const paletteUrl = result.outputs?.palette?.url;
      setLogoUrl(logo);
      if (paletteUrl) {
        const paletteData = await fetchPalette(paletteUrl);
        setPalette(paletteData);
        onBrandingReady({ logoUrl: logo, palette: paletteData });
      } else {
        onBrandingReady({ logoUrl: logo, palette: null });
      }
      setStatus("done");
      setMessage(cached ? "Branding loaded from cache. Review the palette below." : "Branding captured. Review the palette below.");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message ?? "Branding scan failed.");
    }
  };

  const continuePolling = async () => {
    if (!canScan) {
      setMessage("Branding scan requires VITE_API_BASE to point at the Functions API.");
      return;
    }
    if (!jobId) {
      setMessage("No active scan to check. Start a new scan.");
      return;
    }
    setStatus("running");
    setMessage("Still running… checking again.");
    try {
      const start = Date.now();
      let result = await getJobStatus(jobId);
      setCurrentStage(result.stage);
      setMessage(`Scanning… stage: ${result.stage}`);
      while (result.status !== "Succeeded" && result.status !== "Failed" && Date.now() - start < 600000) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        try {
          result = await getJobStatus(jobId);
          if (result.stage && result.stage !== currentStage) {
            setCurrentStage(result.stage);
            setMessage(`Scanning… stage: ${result.stage}`);
          }
        } catch (pollError) {
          // If polling fails (e.g., 404, 500), log but continue polling
          console.warn("Job status poll failed:", pollError);
          // Keep last known result and continue polling
        }
      }
      if (result.status !== "Succeeded") {
        setStatus("error");
        setMessage(result.error ?? "Branding job is still running. Try again in a bit.");
        if (result.errorDetails) {
          setErrorDetails(result.errorDetails);
        }
        return;
      }
      const logo = result.outputs?.logo?.url ?? null;
      const paletteUrl = result.outputs?.palette?.url;
      setLogoUrl(logo);
      if (paletteUrl) {
        const paletteData = await fetchPalette(paletteUrl);
        setPalette(paletteData);
        onBrandingReady({ logoUrl: logo, palette: paletteData });
      } else {
        onBrandingReady({ logoUrl: logo, palette: null });
      }
      setStatus("done");
      setMessage("Branding captured. Review the palette below.");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message ?? "Branding scan failed.");
    }
  };

  const normalizeHex = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(withHash)) {
      return withHash.toLowerCase();
    }
    return null;
  };

  const updatePaletteSlot = (slot: "primary" | "secondary" | "accent", value: string) => {
    if (!palette) {
      return;
    }
    const normalized = normalizeHex(value);
    if (!normalized) {
      return;
    }
    const current = palette[slot];
    const updated: PaletteResult = {
      ...palette,
      [slot]: {
        hex: normalized,
        name: current?.name,
        confidence: current?.confidence ?? 0.3,
        evidence: [...(current?.evidence ?? []), "manual"],
      },
    };
    setPalette(updated);
    onBrandingReady({ logoUrl, palette: updated });
  };

  return (
    <div className="start-landing">
      <div className="hero-card">
        <div>
          <p className="hero-eyebrow">Custom glove builder</p>
          <h2>Build a game-ready glove in minutes.</h2>
          <p>Set your core details, pull in team colors, and launch into the full builder.</p>
        </div>
        <div className="hero-badges">
          <span>Fastpitch-ready</span>
          <span>Two-tone laces</span>
          <span>Pro patterns</span>
        </div>
      </div>

      <div className="start-grid">
        <div className="panel">
          <h3>Start Details</h3>
          <div className="field-grid">
            <div>
              <label>Sport</label>
              <select value={design.sport} onChange={(event) => onUpdate("sport", event.target.value)}>
                <option value="baseball">Baseball</option>
                <option value="fastpitch">Fastpitch</option>
                <option value="slowpitch">Slowpitch</option>
              </select>
            </div>
            <div>
              <label>Position</label>
              <select value={design.position} onChange={(event) => onUpdate("position", event.target.value)}>
                <option value="infield">Infield</option>
                <option value="outfield">Outfield</option>
                <option value="pitcher">Pitcher</option>
                <option value="catcher">Catcher</option>
                <option value="first_base">First Base</option>
                <option value="utility">Utility</option>
                <option value="trainer">Trainer</option>
              </select>
            </div>
            <div>
              <label>Throwing Hand</label>
              <select value={design.throwHand} onChange={(event) => onUpdate("throwHand", event.target.value)}>
                <option value="RHT">RHT (glove on left)</option>
                <option value="LHT">LHT (glove on right)</option>
              </select>
            </div>
            <div>
              <label>Age Level</label>
              <select value={design.ageLevel} onChange={(event) => onUpdate("ageLevel", event.target.value)}>
                <option value="youth">Youth</option>
                <option value="teen">Teen</option>
                <option value="adult">Adult</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>
          <div className="cta">
            <button onClick={onStart}>Launch Builder</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">
            <h3>Team Branding Scan</h3>
            {cached && <span className="badge">Cached</span>}
          </div>
          <div className="field-grid">
            <div>
              <label>Team Website</label>
              <input
                placeholder="https://example.com"
                value={teamUrl}
                onChange={(event) => setTeamUrl(event.target.value)}
              />
            </div>
          </div>
          <div className="cta">
            <button onClick={runScan} disabled={status === "running"}>
              {status === "running" ? (
                <>
                  <span className="scan-spinner" aria-hidden="true" />
                  Scanning…
                </>
              ) : (
                "Scan Branding"
              )}
            </button>
            <button className="secondary" onClick={onStart}>
              Skip for now
            </button>
          </div>
          {!canScan && <div className="summary">Set VITE_API_BASE to enable team branding scans.</div>}
          {message && <div className="summary">{message}</div>}
          {status === "running" && currentStage && <div className="summary">Stage: {currentStage}</div>}
          {errorDetails && status === "error" && (
            <details className="error-details">
              <summary>Show error details</summary>
              <pre>{errorDetails}</pre>
            </details>
          )}
          {status === "error" && (
            <div className="cta">
              <button className="secondary" onClick={continuePolling}>
                Keep Checking
              </button>
            </div>
          )}
          <div className="debug-link">
            <a href="#debug">Open debug console</a>
          </div>
          {(logoUrl || swatches.length > 0) && (
            <div className="brand-result">
              {logoUrl && (
                <div>
                  <strong>Logo</strong>
                  <div className="logo-preview">
                    <img src={logoUrl} alt="Team logo" />
                  </div>
                </div>
              )}
              {swatches.length > 0 && (
                <div>
                  <strong>Recommended Palette</strong>
                  <div className="chip-row">
                    {swatches.map((color) => (
                      <div key={color.key} className="chip">
                        <span className="chip-color" style={{ background: color.hex }} />
                        {color.name ?? color.hex}
                      </div>
                    ))}
                  </div>
                  <div className="palette-editor">
                    <div className="palette-row">
                      <label>Primary</label>
                      <div className="palette-inputs">
                        <input
                          type="color"
                          value={palette?.primary?.hex ?? "#1f4b5a"}
                          onChange={(event) => updatePaletteSlot("primary", event.target.value)}
                        />
                        <input
                          value={palette?.primary?.hex ?? ""}
                          onChange={(event) => updatePaletteSlot("primary", event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="palette-row">
                      <label>Secondary 1</label>
                      <div className="palette-inputs">
                        <input
                          type="color"
                          value={palette?.secondary?.hex ?? "#e39b4b"}
                          onChange={(event) => updatePaletteSlot("secondary", event.target.value)}
                        />
                        <input
                          value={palette?.secondary?.hex ?? ""}
                          onChange={(event) => updatePaletteSlot("secondary", event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="palette-row">
                      <label>Secondary 2</label>
                      <div className="palette-inputs">
                        <input
                          type="color"
                          value={palette?.accent?.hex ?? "#c85a3d"}
                          onChange={(event) => updatePaletteSlot("accent", event.target.value)}
                        />
                        <input value={palette?.accent?.hex ?? ""} onChange={(event) => updatePaletteSlot("accent", event.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Builder Preview</h3>
        <div className="summary">
          Brands available: {catalog.brands.map((brand) => brand.name).join(", ")}. You can still change patterns,
          materials, and colors once you launch.
        </div>
      </div>

      <div className="build-info">
        Build: {__BUILD_COMMIT__}
      </div>
    </div>
  );
}
