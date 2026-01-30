import { useEffect, useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const DEFAULT_TEAM_URL = "http://www.abrtravel.org/";

interface RequestLogEntry {
  label: string;
  status: number;
  body: unknown;
  at: string;
}

export function DebugPanel() {
  const [teamUrl, setTeamUrl] = useState(DEFAULT_TEAM_URL);
  const [jobId, setJobId] = useState("");
  const [functionKey, setFunctionKey] = useState(() => {
    const stored = localStorage.getItem("debugFunctionKey");
    return stored ?? import.meta.env.VITE_FUNCTION_KEY ?? "";
  });
  const [log, setLog] = useState<RequestLogEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<Record<string, unknown> | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [deadLetters, setDeadLetters] = useState<Record<string, unknown> | null>(null);
  const [recentJobs, setRecentJobs] = useState<Array<{ jobId: string; stage?: string; teamUrl?: string }> | null>(null);
  const [durableStatus, setDurableStatus] = useState<Record<string, unknown> | null>(null);
  const [requeueResult, setRequeueResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    localStorage.setItem("debugFunctionKey", functionKey);
  }, [functionKey]);

  const headers = useMemo(() => {
    const base: Record<string, string> = { "content-type": "application/json" };
    if (functionKey.trim()) {
      base["x-functions-key"] = functionKey.trim();
    }
    return base;
  }, [functionKey]);

  const logResponse = async (label: string, response: Response) => {
    let body: unknown = null;
    try {
      body = await response.clone().json();
    } catch {
      body = await response.text();
    }
    setLog((prev) => [
      {
        label,
        status: response.status,
        body,
        at: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
    return body;
  };

  const runRequest = async (label: string, input: RequestInfo, init?: RequestInit) => {
    try {
      const response = await fetch(input, init);
      setLastError(null);
      return await logResponse(label, response);
    } catch (error) {
      const entry: RequestLogEntry = {
        label,
        status: 0,
        body: { error: (error as Error).message ?? String(error) },
        at: new Date().toLocaleTimeString(),
      };
      setLog((prev) => [entry, ...prev]);
      setLastError((error as Error).message ?? "Network error");
      return null;
    }
  };

  const startJob = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    const body = await runRequest("POST /api/jobs", `${API_BASE}/api/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ teamUrl, mode: "proposal" }),
    });
    if ((body as { jobId?: string })?.jobId) {
      setJobId((body as { jobId: string }).jobId);
    }
  };

  const checkStatus = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    if (!jobId.trim()) {
      setMessage("Enter a jobId to check.");
      return;
    }
    setMessage(null);
    await runRequest("GET /api/jobs/:id", `${API_BASE}/api/jobs/${jobId}`, { headers });
  };

  const clearLog = () => setLog([]);

  const loadQueueStatus = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    const body = await runRequest("GET /api/debug/queue", `${API_BASE}/api/debug/queue`, { headers });
    if (body) {
      setQueueStatus(body as Record<string, unknown>);
    }
  };

  const loadRecentJobs = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    const body = await runRequest("GET /api/debug/jobs", `${API_BASE}/api/debug/jobs?limit=25`, { headers });
    if ((body as { jobs?: Array<{ jobId: string; stage?: string; teamUrl?: string }> })?.jobs) {
      setRecentJobs((body as { jobs: Array<{ jobId: string; stage?: string; teamUrl?: string }> }).jobs);
    }
  };

  const loadDeadLetters = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    const body = await runRequest("GET /api/debug/deadletters", `${API_BASE}/api/debug/deadletters?limit=10`, {
      headers,
    });
    if (body) {
      setDeadLetters(body as Record<string, unknown>);
    }
  };

  const startDirect = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    const body = await runRequest("POST /api/debug/start", `${API_BASE}/api/debug/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({ teamUrl, mode: "proposal" }),
    });
    if ((body as { jobId?: string })?.jobId) {
      setJobId((body as { jobId: string }).jobId);
    }
  };

  const fetchDurableStatus = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    if (!jobId.trim()) {
      setMessage("Enter a jobId to inspect durable status.");
      return;
    }
    setMessage(null);
    const body = await runRequest(
      "GET /api/debug/durable/:id",
      `${API_BASE}/api/debug/durable/${jobId}?history=false&input=true`,
      {
        headers,
      }
    );
    if (body) {
      setDurableStatus(body as Record<string, unknown>);
    }
  };

  const requeueDeadLetters = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    const body = await runRequest("POST /api/debug/requeue", `${API_BASE}/api/debug/requeue?limit=1`, {
      method: "POST",
      headers,
    });
    if (body) {
      setRequeueResult(body as Record<string, unknown>);
    }
  };

  const cancelJob = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    if (!jobId.trim()) {
      setMessage("Enter a jobId to cancel.");
      return;
    }
    setMessage(null);
    await runRequest("POST /api/jobs/:id/cancel", `${API_BASE}/api/jobs/${jobId}/cancel`, {
      method: "POST",
      headers,
    });
  };

  const retryJob = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    if (!jobId.trim()) {
      setMessage("Enter a jobId to retry.");
      return;
    }
    setMessage(null);
    await runRequest("POST /api/debug/retry/:id", `${API_BASE}/api/debug/retry/${jobId}`, {
      method: "POST",
      headers,
    });
  };

  const pingApi = async () => {
    if (!API_BASE) {
      setMessage("VITE_API_BASE is not set. The debug panel cannot reach the Functions API.");
      return;
    }
    setMessage(null);
    await runRequest("GET /api/catalog/brands", `${API_BASE}/api/catalog/brands`, { headers });
  };

  return (
    <div className="debug-page">
      <div className="debug-header">
        <div>
          <p className="hero-eyebrow">Debug tools</p>
          <h2>Branding Scan Console</h2>
          <p>Run scans and inspect raw responses without leaving the app.</p>
        </div>
        <a className="button-link" href="#">
          Back to Builder
        </a>
      </div>

      <div className="debug-grid">
        <div className="panel">
          <h3>Request Controls</h3>
          <div className="summary">
            <strong>API Base</strong>: {API_BASE || "Not set"}
            <br />
            <strong>Function Key</strong>: {functionKey ? "Set" : "Missing"}
          </div>
          <div className="field-grid">
            <div>
              <label>Team Website</label>
              <input value={teamUrl} onChange={(event) => setTeamUrl(event.target.value)} />
            </div>
            <div>
              <label>Function Key (optional)</label>
              <input
                value={functionKey}
                onChange={(event) => setFunctionKey(event.target.value)}
                placeholder="x-functions-key"
              />
            </div>
            <div>
              <label>Job ID</label>
              <input value={jobId} onChange={(event) => setJobId(event.target.value)} />
            </div>
          </div>
          <div className="cta">
            <button onClick={startJob}>Start Job</button>
            <button className="secondary" onClick={startDirect}>
              Start Direct
            </button>
            <button className="secondary" onClick={checkStatus}>
              Check Status
            </button>
            <button className="secondary" onClick={retryJob}>
              Retry Job
            </button>
            <button className="secondary" onClick={fetchDurableStatus}>
              Durable Status
            </button>
            <button className="secondary" onClick={cancelJob}>
              Cancel Job
            </button>
            <button className="secondary" onClick={pingApi}>
              Ping API
            </button>
            <button className="secondary" onClick={loadQueueStatus}>
              Queue Status
            </button>
            <button className="secondary" onClick={loadDeadLetters}>
              Dead Letters
            </button>
            <button className="secondary" onClick={requeueDeadLetters}>
              Requeue Dead Letter
            </button>
            <button className="secondary" onClick={loadRecentJobs}>
              Recent Jobs
            </button>
            <button className="secondary" onClick={clearLog}>
              Clear Log
            </button>
          </div>
          {message && <div className="summary">{message}</div>}
          {lastError && <div className="summary">Last error: {lastError}</div>}
          {queueStatus && (
            <div className="summary">
              <strong>Queue</strong>
              <pre>{JSON.stringify(queueStatus, null, 2)}</pre>
            </div>
          )}
          {deadLetters && (
            <div className="summary">
              <strong>Dead Letters</strong>
              <pre>{JSON.stringify(deadLetters, null, 2)}</pre>
            </div>
          )}
          {requeueResult && (
            <div className="summary">
              <strong>Requeue Result</strong>
              <pre>{JSON.stringify(requeueResult, null, 2)}</pre>
            </div>
          )}
          {durableStatus && (
            <div className="summary">
              <strong>Durable Status</strong>
              <pre>{JSON.stringify(durableStatus, null, 2)}</pre>
            </div>
          )}
          {recentJobs && (
            <div className="summary">
              <strong>Recent Jobs</strong>
              <div className="list">
                {recentJobs.map((job) => (
                  <button
                    key={job.jobId}
                    className="link-button"
                    onClick={() => setJobId(job.jobId)}
                    type="button"
                  >
                    {job.jobId} · {job.stage ?? "unknown"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel debug-log">
          <h3>Responses</h3>
          {log.length === 0 ? (
            <div className="summary">No responses yet.</div>
          ) : (
            log.map((entry, index) => (
              <div key={`${entry.at}-${index}`} className="debug-entry">
                <div className="debug-entry-header">
                  <strong>{entry.label}</strong>
                  <span>Status {entry.status}</span>
                  <span>{entry.at}</span>
                </div>
                <pre>{JSON.stringify(entry.body, null, 2)}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
