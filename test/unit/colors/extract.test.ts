/**
 * Unit tests for color extraction
 */

import { describe, it, expect } from 'vitest';
import { extractColorsFromCss, extractColorsFromHtml } from '../../../src/colors/extract';

describe('Color Extraction - Unit Tests', () => {
  describe('extractColorsFromCss', () => {
    it('should extract hex colors from CSS', () => {
      const css = `
        body { background-color: #1a1a2e; }
        .header { color: #dc143c; }
        .footer { border-color: #ffd700; }
      `;

      const colors = extractColorsFromCss(css);

      expect(colors).toContain('#1a1a2e');
      expect(colors).toContain('#dc143c');
      expect(colors).toContain('#ffd700');
    });

    it('should extract rgb colors from CSS', () => {
      const css = `
        body { background-color: rgb(26, 26, 46); }
        .header { color: rgb(220, 20, 60); }
      `;

      const colors = extractColorsFromCss(css);

      expect(colors.length).toBeGreaterThan(0);
      // Should convert RGB to hex
      expect(colors.some((c) => c.toLowerCase() === '#1a1a2e')).toBe(true);
    });

    it('should extract rgba colors from CSS', () => {
      const css = `
        .overlay { background-color: rgba(26, 26, 46, 0.8); }
      `;

      const colors = extractColorsFromCss(css);

      expect(colors.length).toBeGreaterThan(0);
    });

    it('should normalize hex colors to lowercase', () => {
      const css = `
        body { background-color: #1A1A2E; }
        .header { color: #DC143C; }
      `;

      const colors = extractColorsFromCss(css);

      expect(colors).toContain('#1a1a2e');
      expect(colors).toContain('#dc143c');
    });

    it('should remove duplicate colors', () => {
      const css = `
        body { background-color: #1a1a2e; }
        .main { background-color: #1a1a2e; }
        .sidebar { background-color: #1a1a2e; }
      `;

      const colors = extractColorsFromCss(css);

      const count = colors.filter((c) => c === '#1a1a2e').length;
      expect(count).toBe(1);
    });

    it('should handle empty CSS', () => {
      const colors = extractColorsFromCss('');
      expect(colors).toEqual([]);
    });

    it('should handle CSS with no colors', () => {
      const css = `
        body { font-family: Arial; }
        .main { padding: 20px; }
      `;

      const colors = extractColorsFromCss(css);
      expect(colors).toEqual([]);
    });
  });

  describe('extractColorsFromHtml', () => {
    it('should extract inline style colors', () => {
      const html = `
        <div style="background-color: #1a1a2e; color: #dc143c;">
          <span style="border-color: #ffd700;">Test</span>
        </div>
      `;

      const colors = extractColorsFromHtml(html);

      expect(colors).toContain('#1a1a2e');
      expect(colors).toContain('#dc143c');
      expect(colors).toContain('#ffd700');
    });

    it('should extract colors from style tags', () => {
      const html = `
        <html>
          <head>
            <style>
              body { background-color: #1a1a2e; }
              .header { color: #dc143c; }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const colors = extractColorsFromHtml(html);

      expect(colors).toContain('#1a1a2e');
      expect(colors).toContain('#dc143c');
    });

    it('should handle HTML with no colors', () => {
      const html = `
        <html>
          <body>
            <h1>Test</h1>
            <p>No colors here</p>
          </body>
        </html>
      `;

      const colors = extractColorsFromHtml(html);
      expect(colors).toEqual([]);
    });

    it('should handle empty HTML', () => {
      const colors = extractColorsFromHtml('');
      expect(colors).toEqual([]);
    });

    it('should handle malformed HTML gracefully', () => {
      const html = `
        <div style="background-color: #1a1a2e">
          <span style="color: not-a-color">Test
        </div>
      `;

      const colors = extractColorsFromHtml(html);

      // Should still extract valid color
      expect(colors).toContain('#1a1a2e');
    });
  });

  describe('Color Frequency Analysis', () => {
    it('should count color occurrences correctly', () => {
      const css = `
        body { background-color: #1a1a2e; }
        .header { background-color: #1a1a2e; }
        .footer { background-color: #1a1a2e; }
        .sidebar { background-color: #dc143c; }
      `;

      const colors = extractColorsFromCss(css);

      // Count occurrences
      const frequency: Record<string, number> = {};
      for (const color of colors) {
        frequency[color] = (frequency[color] || 0) + 1;
      }

      expect(frequency['#1a1a2e']).toBeGreaterThan(frequency['#dc143c']);
    });
  });

  describe('Color Filtering', () => {
    it('should filter out near-white colors', () => {
      const css = `
        body { background-color: #ffffff; }
        .light { background-color: #fefefe; }
        .dark { background-color: #1a1a2e; }
      `;

      const colors = extractColorsFromCss(css);
      const filtered = colors.filter((hex) => {
        const rgb = hexToRgb(hex);
        const brightness = (rgb.r + rgb.g + rgb.b) / 3;
        return brightness < 240; // Filter out very bright colors
      });

      expect(filtered).toContain('#1a1a2e');
      expect(filtered).not.toContain('#ffffff');
    });

    it('should filter out near-black colors', () => {
      const css = `
        body { background-color: #000000; }
        .dark { background-color: #0a0a0a; }
        .navy { background-color: #1a1a2e; }
      `;

      const colors = extractColorsFromCss(css);
      const filtered = colors.filter((hex) => {
        const rgb = hexToRgb(hex);
        const brightness = (rgb.r + rgb.g + rgb.b) / 3;
        return brightness > 15; // Filter out very dark colors
      });

      expect(filtered).toContain('#1a1a2e');
      expect(filtered).not.toContain('#000000');
    });
  });
});

// Helper function
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}
