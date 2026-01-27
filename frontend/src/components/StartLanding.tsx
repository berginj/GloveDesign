import { useMemo, useState } from "react";
import { CatalogDesign, SeedCatalog } from "../data/seedCatalog";
import { fetchPalette, getJobStatus, PaletteResult, startBrandingJob } from "../api/branding";

interface StartLandingProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  onUpdate: (path: string, value: string) => void;
  onStart: () => void;
}

export function StartLanding({ design, catalog, onUpdate, onStart }: StartLandingProps) {
  const [teamUrl, setTeamUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteResult | null>(null);

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
    setMessage("Scanning branding… this can take a minute.");
    setLogoUrl(null);
    setPalette(null);
    try {
      const job = await startBrandingJob(teamUrl.trim());
      const start = Date.now();
      let result = await getJobStatus(job.jobId);
      while (result.status !== "Succeeded" && result.status !== "Failed" && Date.now() - start < 120000) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        result = await getJobStatus(job.jobId);
      }
      if (result.status !== "Succeeded") {
        setStatus("error");
        setMessage(result.error ?? "Branding job did not finish in time.");
        return;
      }
      const logo = result.outputs?.logo?.url ?? null;
      const paletteUrl = result.outputs?.palette?.url;
      setLogoUrl(logo);
      if (paletteUrl) {
        const paletteData = await fetchPalette(paletteUrl);
        setPalette(paletteData);
      }
      setStatus("done");
      setMessage("Branding captured. Review the palette below.");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message ?? "Branding scan failed.");
    }
  };

  return (
    <div className="start-landing">
      <div className="start-header">
        <h2>Customize Your Glove</h2>
        <p>Pick your key details up front, then launch into the builder with your team branding ready.</p>
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
          <h3>Team Branding Scan</h3>
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
              {status === "running" ? "Scanning…" : "Scan Branding"}
            </button>
            <button className="secondary" onClick={onStart}>
              Skip for now
            </button>
          </div>
          {!canScan && <div className="summary">Set VITE_API_BASE to enable team branding scans.</div>}
          {message && <div className="summary">{message}</div>}
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
                  <strong>Palette</strong>
                  <div className="chip-row">
                    {swatches.map((color) => (
                      <div key={color.key} className="chip">
                        <span className="chip-color" style={{ background: color.hex }} />
                        {color.name ?? color.hex}
                      </div>
                    ))}
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
    </div>
  );
}
