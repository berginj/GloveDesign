/**
 * Integration tests for branding scan
 * Tests the complete flow from job submission to completion
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:7071';
const TEST_SERVER_PORT = 3000;

let testServer: ChildProcess | null = null;

beforeAll(async () => {
  // Start test server
  console.log('Starting test server...');
  testServer = spawn('node', ['test-fixtures/test-server.js', TEST_SERVER_PORT.toString()]);

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('Test server started');
});

afterAll(async () => {
  // Stop test server
  if (testServer) {
    testServer.kill();
    console.log('Test server stopped');
  }
});

describe('Branding Scan - Integration Tests', () => {
  it('should submit a job successfully', async () => {
    const response = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamUrl: `http://localhost:${TEST_SERVER_PORT}`,
        mode: 'proposal',
      }),
    });

    expect(response.status).toBe(202);

    const data = await response.json();
    expect(data).toHaveProperty('jobId');
    expect(data.jobId).toMatch(/^[0-9a-f-]{36}$/); // UUID format

    console.log(`Job submitted: ${data.jobId}`);
  }, 10000);

  it('should process a job from start to completion', async () => {
    // Submit job
    const submitResponse = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamUrl: `http://localhost:${TEST_SERVER_PORT}`,
        mode: 'proposal',
      }),
    });

    expect(submitResponse.status).toBe(202);
    const { jobId } = await submitResponse.json();

    console.log(`Testing job: ${jobId}`);

    // Poll for completion (max 2 minutes)
    const startTime = Date.now();
    const maxWaitTime = 120000; // 2 minutes
    let job: any = null;

    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      expect(statusResponse.status).toBe(200);

      job = await statusResponse.json();
      console.log(`Job stage: ${job.stage}`);

      if (job.stage === 'completed') {
        break;
      }

      if (job.stage === 'failed') {
        throw new Error(`Job failed: ${job.error}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    // Verify job completed
    expect(job).not.toBeNull();
    expect(job.stage).toBe('completed');

    // Verify outputs exist
    expect(job.outputs).toBeDefined();
    expect(job.outputs.logo).toBeDefined();
    expect(job.outputs.palette).toBeDefined();

    console.log('Job outputs:', job.outputs);
  }, 150000); // 2.5 minute timeout

  it('should extract correct colors from test site', async () => {
    // Submit job
    const submitResponse = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamUrl: `http://localhost:${TEST_SERVER_PORT}`,
        mode: 'proposal',
      }),
    });

    const { jobId } = await submitResponse.json();

    // Wait for completion
    let job: any = null;
    const startTime = Date.now();
    while (Date.now() - startTime < 120000) {
      const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      job = await statusResponse.json();

      if (job.stage === 'completed' || job.stage === 'failed') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    expect(job.stage).toBe('completed');
    expect(job.outputs.palette).toBeDefined();

    // Fetch palette data
    const paletteUrl = job.outputs.palette.url;
    const paletteResponse = await fetch(paletteUrl);
    const palette = await paletteResponse.json();

    console.log('Extracted palette:', palette);

    // Verify colors are close to expected values
    const expectedColors = [
      '#1a1a2e', // Navy Blue
      '#dc143c', // Crimson Red
      '#ffd700', // Gold
    ];

    // Check that palette contains colors close to expected
    expect(palette.colors).toBeDefined();
    expect(palette.colors.length).toBeGreaterThan(0);

    // At least one color should be navy-ish (dark blue)
    const hasNavy = palette.colors.some((c: any) =>
      isColorSimilar(c.hex, '#1a1a2e', 50)
    );
    expect(hasNavy).toBe(true);

    // At least one color should be red-ish
    const hasRed = palette.colors.some((c: any) =>
      isColorSimilar(c.hex, '#dc143c', 50)
    );
    expect(hasRed).toBe(true);

    // At least one color should be gold-ish (yellow)
    const hasGold = palette.colors.some((c: any) =>
      isColorSimilar(c.hex, '#ffd700', 50)
    );
    expect(hasGold).toBe(true);
  }, 150000);

  it('should find and score the logo correctly', async () => {
    const submitResponse = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamUrl: `http://localhost:${TEST_SERVER_PORT}`,
        mode: 'proposal',
      }),
    });

    const { jobId } = await submitResponse.json();

    // Wait for completion
    let job: any = null;
    const startTime = Date.now();
    while (Date.now() - startTime < 120000) {
      const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      job = await statusResponse.json();

      if (job.stage === 'completed' || job.stage === 'failed') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    expect(job.stage).toBe('completed');
    expect(job.outputs.logo).toBeDefined();
    expect(job.outputs.logo.url).toBeDefined();

    // Logo URL should point to blob storage
    expect(job.outputs.logo.url).toMatch(/blob\.core\.windows\.net|localhost/);

    console.log('Logo URL:', job.outputs.logo.url);
  }, 150000);

  it('should handle invalid URLs gracefully', async () => {
    const response = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamUrl: 'not-a-valid-url',
        mode: 'proposal',
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should handle unreachable URLs gracefully', async () => {
    const submitResponse = await fetch(`${API_BASE}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamUrl: 'http://this-domain-does-not-exist-12345.com',
        mode: 'proposal',
      }),
    });

    expect(submitResponse.status).toBe(202);
    const { jobId } = await submitResponse.json();

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const statusResponse = await fetch(`${API_BASE}/api/jobs/${jobId}`);
    const job = await statusResponse.json();

    // Should fail at validation or crawling stage
    expect(job.stage).toMatch(/failed|validation|crawling/);
    if (job.stage === 'failed') {
      expect(job.error).toBeDefined();
    }
  }, 30000);
});

// Helper function to check if two hex colors are similar
function isColorSimilar(hex1: string, hex2: string, threshold: number = 30): boolean {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  const distance = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );

  return distance <= threshold;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}
