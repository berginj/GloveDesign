# Testing Guide

## Overview

GloveDesign uses **Vitest** for unit and integration testing. Tests validate the entire branding scan pipeline from job submission to completion.

## Test Structure

```
test/
├── integration/          # End-to-end tests
│   └── branding-scan.test.ts
├── unit/                 # Unit tests
│   ├── colors/
│   │   └── extract.test.ts
│   └── logo/
│       └── scoring.test.ts
├── setup.ts             # Test setup and configuration
└── fixtures/            # Test data and mocks

test-fixtures/
├── simple-team-site/    # Simple test website
│   ├── index.html       # Homepage with team colors
│   ├── logo.svg         # Team logo
│   └── robots.txt       # Robots.txt
└── test-server.js       # Local HTTP server for testing
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (runs tests on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory.

---

## Integration Testing

Integration tests validate the complete branding scan workflow.

### Prerequisites

**1. Start Local Function App:**
```bash
# In terminal 1
npm run dev
```

**2. Start Test Server:**
```bash
# In terminal 2
npm run test:server
```

This starts a local HTTP server at `http://localhost:3000` serving the test website.

**3. Run Integration Tests:**
```bash
# In terminal 3
npm run test:integration
```

### What Integration Tests Cover

**1. Job Submission**
- POST /api/jobs with valid URL
- Validates jobId is returned
- Validates UUID format

**2. Job Processing**
- Polls job status until completion
- Validates stage progression: `received → validation → crawling → logo_selection → color_extraction → completed`
- Max wait time: 2 minutes

**3. Color Extraction**
- Validates colors are extracted from CSS and HTML
- Compares extracted colors to expected colors
- Expected colors for test site:
  - Navy Blue: `#1a1a2e` (primary)
  - Crimson Red: `#dc143c` (secondary)
  - Gold: `#ffd700` (accent)

**4. Logo Detection**
- Validates logo is found and scored
- Validates logo URL points to blob storage
- Checks logo.svg is detected

**5. Error Handling**
- Tests invalid URLs (should return 400)
- Tests unreachable URLs (should fail gracefully)

### Example Integration Test

```typescript
it('should process a job from start to completion', async () => {
  // Submit job
  const response = await fetch(`${API_BASE}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamUrl: 'http://localhost:3000',
      mode: 'proposal',
    }),
  });

  const { jobId } = await response.json();

  // Poll until completion
  let job;
  while (true) {
    const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobId}`);
    job = await statusResponse.json();

    if (job.stage === 'completed' || job.stage === 'failed') {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  // Verify
  expect(job.stage).toBe('completed');
  expect(job.outputs.logo).toBeDefined();
  expect(job.outputs.palette).toBeDefined();
});
```

---

## Unit Testing

Unit tests validate individual functions and modules in isolation.

### What Unit Tests Cover

**1. Color Extraction (`test/unit/colors/extract.test.ts`)**
- Extract hex colors from CSS
- Extract RGB/RGBA colors from CSS
- Extract colors from inline styles
- Extract colors from `<style>` tags
- Normalize colors to lowercase
- Remove duplicate colors
- Handle empty/malformed input

**2. Logo Scoring (`test/unit/logo/scoring.test.ts`)**
- Score by filename (logo, brand, emblem)
- Score by dimensions (square logos score higher)
- Score by position (above-the-fold scores higher)
- Score by alt text
- Combine scores correctly

**3. Crawl Edge Cases (`tests/crawl.edge-cases.test.ts`)**
- Robots.txt blocking and missing scenarios
- Budget enforcement (max bytes, max pages, max images)
- Various image formats (WebP, AVIF, ICO, BMP)
- CSS edge cases (data URIs, relative paths, comments)
- Max pages/images limits
- Malformed JSON-LD gracefully
- Page prioritization (about/team pages)

**4. Logo Selection Edge Cases (`tests/selectLogo.edge-cases.test.ts`)**
- Invalid image data rejection (HTML instead of images)
- Valid image format acceptance (PNG, JPEG, SVG, WebP magic bytes)
- Empty buffer handling
- Configurable analysis count
- Placeholder SVG generation
- First candidate success path

**5. URL Validation**
- Validate URL format
- Block suspicious patterns
- Block dangerous ports
- Normalize URLs

### Example Unit Test

```typescript
describe('extractColorsFromCss', () => {
  it('should extract hex colors from CSS', () => {
    const css = `
      body { background-color: #1a1a2e; }
      .header { color: #dc143c; }
    `;

    const colors = extractColorsFromCss(css);

    expect(colors).toContain('#1a1a2e');
    expect(colors).toContain('#dc143c');
  });
});
```

---

## Test Fixtures

### Simple Team Site

Located in `test-fixtures/simple-team-site/`, this is a minimal test website with:

**Colors:**
- Primary: Navy Blue (#1a1a2e) - body background
- Secondary: Crimson Red (#dc143c) - header background
- Accent: Gold (#ffd700) - accent sections

**Logo:**
- `logo.svg` - SVG logo with lightning bolt
- Referenced in HTML with `id="team-logo"`

**Structure:**
- `index.html` - Homepage with team colors
- `logo.svg` - Team logo
- `robots.txt` - Allows all crawling

### Using Test Site Locally

**Start the test server:**
```bash
npm run test:server
```

**Visit in browser:**
```
http://localhost:3000
```

**Test branding scan:**
```bash
curl -X POST http://localhost:7071/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"teamUrl": "http://localhost:3000", "mode": "proposal"}'
```

---

## Mocking and Fixtures

### Mocking Azure Services

For unit tests that interact with Azure services, use mocks:

```typescript
import { vi } from 'vitest';

// Mock Azure Blob Storage
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => ({
        uploadBlockBlob: vi.fn(),
      })),
    })),
  },
}));
```

### Fixture Data

Create fixture files in `test/fixtures/`:

```typescript
// test/fixtures/sample-crawl-report.ts
export const sampleCrawlReport = {
  visited: ['http://example.com', 'http://example.com/about'],
  imageCandidates: [
    {
      url: 'http://example.com/logo.png',
      dimensions: { width: 400, height: 400 },
      alt: 'Team Logo',
    },
  ],
};
```

---

## Continuous Integration

### GitHub Actions

Tests run automatically on every push and pull request.

**Workflow file:** `.github/workflows/ci.yml`

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:coverage
```

---

## Writing New Tests

### Guidelines

1. **Test Naming:**
   - Describe what the test does: `should extract colors from CSS`
   - Use `it()` for individual tests
   - Use `describe()` for grouping related tests

2. **Test Organization:**
   - Unit tests: Test individual functions
   - Integration tests: Test complete workflows
   - Keep tests focused and independent

3. **Assertions:**
   - Use clear, specific assertions
   - Test both success and failure cases
   - Test edge cases (empty input, null, undefined)

4. **Async Tests:**
   - Use `async/await` for async operations
   - Set appropriate timeouts for long-running tests
   - Clean up resources in `afterEach` or `afterAll`

### Example New Test

```typescript
// test/unit/validation/url.test.ts
import { describe, it, expect } from 'vitest';
import { validateUrl } from '@/common/validation';

describe('validateUrl', () => {
  it('should validate valid URLs', () => {
    const result = validateUrl('https://example.com');
    expect(result.ok).toBe(true);
  });

  it('should reject invalid URLs', () => {
    const result = validateUrl('not-a-url');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should reject blocked ports', () => {
    const result = validateUrl('http://example.com:22');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not allowed');
  });
});
```

---

## Debugging Tests

### Run Single Test File

```bash
npx vitest run test/unit/colors/extract.test.ts
```

### Run Specific Test

```bash
npx vitest run -t "should extract hex colors"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:watch"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### View Coverage Report

After running `npm run test:coverage`, open:
```
coverage/index.html
```

---

## Common Issues

### Test Server Not Running

**Error:** `ECONNREFUSED localhost:3000`

**Solution:**
```bash
# Start test server first
npm run test:server
```

### Function App Not Running

**Error:** `ECONNREFUSED localhost:7071`

**Solution:**
```bash
# Start function app
npm run dev
```

### Timeout Errors

**Error:** `Test timeout of 30000ms exceeded`

**Solution:**
- Increase timeout in test: `{ timeout: 60000 }`
- Check if test server and function app are running
- Check Azure storage emulator (Azurite) is running

### Import Errors

**Error:** `Cannot find module '@/common/validation'`

**Solution:**
- Check path alias in `vitest.config.ts`
- Use relative imports if alias doesn't work

---

## Best Practices

1. **Keep Tests Fast**
   - Mock external services in unit tests
   - Use fixtures instead of real API calls
   - Run integration tests separately

2. **Test Behavior, Not Implementation**
   - Test what functions do, not how they do it
   - Avoid testing internal implementation details
   - Focus on inputs and outputs

3. **Maintain Test Data**
   - Keep test fixtures up to date
   - Use realistic test data
   - Document test data expectations

4. **Clean Up Resources**
   - Close HTTP connections
   - Clean up temporary files
   - Reset mocks between tests

5. **Write Readable Tests**
   - Use descriptive test names
   - Keep tests simple and focused
   - Add comments for complex logic

---

## Next Steps

1. **Add More Unit Tests:**
   - Logo scoring algorithm
   - Crawl logic
   - Job orchestration logic

2. **Add Performance Tests:**
   - Test crawl speed
   - Test color extraction performance
   - Test blob upload speed

3. **Add E2E Tests:**
   - Test complete user flow from frontend
   - Test with real team websites
   - Test error scenarios

4. **Set Up Test Coverage Goals:**
   - Target: 80% coverage for core modules
   - Monitor coverage trends over time
   - Enforce coverage thresholds in CI
