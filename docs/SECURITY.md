# Security

## SSRF controls
- Only `http` and `https` URLs are accepted.
- URLs with embedded credentials are rejected.
- Hostnames resolving to private IP ranges are blocked.
- DNS is resolved on every fetch to mitigate DNS rebinding.
- Redirects are capped and each redirect target is re-validated.

## Rate limits and caps
- Crawl is limited to 3 pages and 30 images.
- Total download budget is capped at 25 MB per job.
- Individual page and asset downloads are capped.
- Requests are throttled with a short delay between page fetches.

## Robots.txt and legal constraints
- `robots.txt` is fetched and honored on a best-effort basis.
- If robots disallow crawling, the job records the decision and avoids crawling.
- No login, paywall, captcha bypass, or anti-bot circumvention is attempted.

## Data retention
- Artifacts are stored under `/jobs/{jobId}/` in Blob Storage.
- Job status is stored in Cosmos DB or Table Storage.
- Retention and cleanup policies should be configured based on environment needs.
