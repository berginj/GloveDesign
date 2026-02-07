export interface BrandingJobResponse {
  jobId: string;
  cached?: boolean;
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  stage: string;
  outputs?: {
    logo?: { url?: string };
    palette?: { url?: string };
  };
  error?: string;
  errorDetails?: string;
}

export interface PaletteResult {
  primary?: { hex: string; name?: string };
  secondary?: { hex: string; name?: string };
  accent?: { hex: string; name?: string };
  neutral?: { hex: string; name?: string };
  colors?: Array<{ hex: string; name?: string }>;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const FUNCTION_KEY = import.meta.env.VITE_FUNCTION_KEY ?? "";

function buildHeaders() {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (FUNCTION_KEY) {
    headers["x-functions-key"] = FUNCTION_KEY;
  }
  return headers;
}

export async function startBrandingJob(teamUrl: string): Promise<BrandingJobResponse> {
  const response = await fetch(`${API_BASE}/api/jobs`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ teamUrl, mode: "proposal" }),
  });
  if (!response.ok) {
    throw new Error(await buildErrorMessage("Job request failed", response));
  }
  return response.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) {
    throw new Error(await buildErrorMessage("Status request failed", response));
  }
  return response.json();
}

export async function fetchPalette(url: string): Promise<PaletteResult | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

async function buildErrorMessage(prefix: string, response: Response): Promise<string> {
  let detail = "";
  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object") {
      const typed = payload as { error?: string; message?: string; details?: string };
      detail = typed.error || typed.message || typed.details || "";
    }
  } catch {
    try {
      detail = (await response.text()).trim();
    } catch {
      detail = "";
    }
  }

  const suffix = detail || response.statusText || `HTTP ${response.status}`;
  return `${prefix} (${response.status}): ${suffix}`;
}
