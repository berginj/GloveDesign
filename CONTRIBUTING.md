# Contributing to GloveDesign

Thank you for your interest in contributing to GloveDesign! This document provides guidelines and instructions for setting up your development environment and contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Running the Project Locally](#running-the-project-locally)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)

## Development Setup

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Azure Functions Core Tools v4** - [Installation Guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- **Azurite** - Azure Storage Emulator for local development
  ```bash
  npm install -g azurite
  ```

### Clone and Install

```bash
git clone https://github.com/berginj/GloveDesign.git
cd GloveDesign
npm install
```

### Configure Local Settings

1. Copy the example settings file:
   ```bash
   cp local.settings.json.example local.settings.json
   ```

2. Update `local.settings.json` with your configuration:
   - For local development, use `UseDevelopmentStorage=true` for Blob and Table storage
   - Configure Service Bus connection string if testing queue functionality
   - Set other environment variables as needed (see README.md for full list)

### Start Azurite (Local Storage Emulator)

In a separate terminal:
```bash
azurite --silent --location ./azurite --debug ./azurite/debug.log
```

This creates a local storage emulator at:
- Blob: `http://127.0.0.1:10000`
- Queue: `http://127.0.0.1:10001`
- Table: `http://127.0.0.1:10002`

## Running the Project Locally

### Start the Functions Host

```bash
npm run dev
```

The Functions API will be available at `http://localhost:7071`

### Start the Frontend (Optional)

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Test the API

Submit a test job:
```bash
curl -X POST http://localhost:7071/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"teamUrl":"https://arlingtontravelbaseball.org/","mode":"proposal"}'
```

Check job status:
```bash
curl http://localhost:7071/api/jobs/{jobId}
```

## Running Tests

### Run All Unit Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test -- tests/crawl.edge-cases.test.ts
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory. Open `coverage/index.html` to view detailed coverage.

### Run Integration Tests

Integration tests require the Functions host and test server to be running:

**Terminal 1 - Start Functions:**
```bash
npm run dev
```

**Terminal 2 - Start Test Server:**
```bash
npm run test:server
```

**Terminal 3 - Run Integration Tests:**
```bash
npm run test:integration
```

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode (`strict: true` in tsconfig.json)
- Prefer explicit types over `any`
- Use interfaces for object shapes

### Naming Conventions

- **Files**: Use kebab-case (e.g., `select-logo.ts`)
- **Functions**: Use camelCase (e.g., `selectLogoActivity`)
- **Types/Interfaces**: Use PascalCase (e.g., `LogoScore`, `CrawlReport`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `MAX_PAGES`, `REQUEST_DELAY_MS`)

### Code Organization

- Keep functions small and focused (single responsibility)
- Extract magic numbers to named constants
- Prefer pure functions when possible
- Use async/await over raw promises
- Handle errors explicitly

### Testing Best Practices

- Write tests for new features and bug fixes
- Test both success and failure cases
- Test edge cases (empty input, null, undefined, boundary values)
- Use descriptive test names: `should extract colors from CSS`
- Keep tests independent (no shared state)
- Mock external services in unit tests

### Documentation

- Add JSDoc comments for public APIs
- Update README.md for user-facing changes
- Update TESTING.md when adding new test patterns
- Update TROUBLESHOOTING.md for common issues

## Submitting Changes

### Before Submitting

1. **Run the build:**
   ```bash
   npm run build
   ```

2. **Run all tests:**
   ```bash
   npm test
   ```

3. **Check for security vulnerabilities:**
   ```bash
   npm audit
   ```

4. **Format your commits:**
   - Use clear, descriptive commit messages
   - Explain what changed and why
   - Reference issues if applicable (e.g., "Fixes #123")

### Commit Message Format

```
Brief summary (50 chars or less)

Detailed explanation if needed:
- What changed
- Why it changed
- Any breaking changes or migration notes

Fixes #issue-number
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit with clear messages
5. Push to your fork
6. Open a Pull Request against `main`
7. Describe your changes in the PR description
8. Link any related issues

### PR Checklist

- [ ] Code builds without errors
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated if needed
- [ ] No new security vulnerabilities
- [ ] Follows code style guidelines

## Environment Variables

### Core Configuration

See `local.settings.json.example` for all available environment variables.

Key variables for development:
- `SERVICEBUS_NAMESPACE` - Required for queue functionality
- `BLOB_CONNECTION_STRING` - Use `UseDevelopmentStorage=true` for local
- `TABLE_CONNECTION_STRING` - Use `UseDevelopmentStorage=true` for local

### Performance Tuning (Optional)

Adjust these for testing different scenarios:
- `BRANDING_CRAWL_MAX_PAGES` - Limit pages crawled (default: 6)
- `BRANDING_CRAWL_REQUEST_DELAY_MS` - Rate limiting delay (default: 150ms)
- `LOGO_ANALYSIS_COUNT` - Number of logos to analyze (default: 8)

## Troubleshooting

### Common Issues

**Functions won't start:**
- Check Azurite is running
- Verify `local.settings.json` exists
- Check port 7071 is not in use

**Tests failing:**
- Run `npm install` to update dependencies
- Check Azurite is running for integration tests
- Verify test server is running for integration tests

**Module not found errors:**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Check import paths are correct

### Getting Help

- Check [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for detailed solutions
- Review existing [GitHub Issues](https://github.com/berginj/GloveDesign/issues)
- Open a new issue with:
  - Clear description of the problem
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details (OS, Node version, etc.)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and improve
- Follow project guidelines

Thank you for contributing! 🎉
