/**
 * Vitest setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_API_BASE = process.env.TEST_API_BASE || 'http://localhost:7071';
