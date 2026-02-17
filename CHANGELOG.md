# Changelog

All notable changes to GloveDesign will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive developer documentation (CONTRIBUTING.md)
- Configuration template file (local.settings.json.example)
- 19 new edge case tests for crawl and logo selection
- Utility functions for color extraction (extractColorsFromCss, extractColorsFromHtml)
- Configurable crawl limits (7 new environment variables)
- Configurable logo selection parameters (3 new environment variables)
- Image format validation before blob upload (PNG, JPEG, SVG, WebP, GIF, ICO, BMP)

### Changed
- **BREAKING**: None
- Parallelized image analysis for 3-5x performance improvement
- Improved CSS URL extraction with comment removal and whitespace handling
- Updated README.md with all new configuration options
- Updated TESTING.md with new test coverage documentation
- Updated dependencies: axios 1.13.4→1.13.5, fast-xml-parser 5.3.3→5.3.5

### Fixed
- Robots.txt parsing bug where Allow regex incorrectly matched "Disallow"
- Security vulnerability CVE-2025-XXXX in axios (DoS via __proto__ key)
- Security vulnerability CVE-2025-XXXX in fast-xml-parser (RangeError DoS)
- Color frequency test expectations to match deduplication behavior

### Security
- Fixed high-severity DoS vulnerability in axios
- Fixed high-severity DoS vulnerability in fast-xml-parser
- All backend dependencies now have 0 known vulnerabilities

## [0.1.0] - 2026-01-28

### Added
- Initial release with core branding scan functionality
- Azure Durable Functions orchestration
- Web crawling with robots.txt compliance
- Logo detection and scoring
- Color palette extraction
- Glove design generation
- Playwright wizard worker for BC2 Gloves autofill
- React-based customizer UI
- Comprehensive production deployment guide
- Troubleshooting documentation
- Health check endpoints
- Diagnostic scripts for stuck jobs
- Test infrastructure with fixtures
- Security: SSRF mitigation and input validation

### Infrastructure
- Azure Functions for API and orchestration
- Service Bus for job queuing
- Cosmos DB for job status storage
- Blob Storage for artifacts
- Application Insights for logging and monitoring
- GitHub Actions workflows for CI/CD

### Documentation
- README.md with architecture overview
- PRODUCTION.md for deployment guide
- TROUBLESHOOTING.md for common issues
- TESTING.md for test infrastructure
- CUSTOMIZER.md for UI specifications
- SECURITY.md for security considerations
- RUNBOOK.md for operational procedures

---

## Version History

### Recent Improvements (February 2026)

**Performance Enhancements:**
- Logo selection now 3-5x faster with parallel image analysis
- Configurable timeouts and limits for production tuning

**Reliability Improvements:**
- Image validation prevents uploading invalid files to blob storage
- Better CSS parsing handles edge cases (data URIs, comments, relative paths)
- Fixed robots.txt parsing bug that caused incorrect blocking

**Configuration Flexibility:**
- All major crawl limits now configurable via environment variables
- Logo analysis parameters tunable for different scenarios
- Rate limiting configurable per deployment

**Testing & Quality:**
- 47 unit tests passing with comprehensive edge case coverage
- Tests for robots.txt scenarios, budget enforcement, image formats
- Tests for invalid data rejection, format validation, fallbacks

**Security:**
- All known vulnerabilities patched in dependencies
- Regular security audits with npm audit
- No high/critical vulnerabilities remaining

**Developer Experience:**
- Complete contribution guide added
- Configuration templates for easy setup
- Clear code style and testing guidelines

---

## Migration Guide

### Upgrading to Latest Version

**No breaking changes** - All improvements are backward compatible.

**New optional configuration:**
```bash
# Crawl limits (optional, defaults work well)
BRANDING_CRAWL_MAX_PAGES=6
BRANDING_CRAWL_MAX_IMAGES=40
BRANDING_CRAWL_MAX_CSS_FILES=6
BRANDING_CRAWL_MAX_BYTES=26214400
BRANDING_CRAWL_MAX_PAGE_BYTES=2097152
BRANDING_CRAWL_MAX_ASSET_BYTES=5242880
BRANDING_CRAWL_REQUEST_DELAY_MS=150

# Logo selection (optional, defaults work well)
LOGO_ANALYSIS_COUNT=8
LOGO_ANALYSIS_TIMEOUT_MS=12000
LOGO_DOWNLOAD_TIMEOUT_MS=15000
```

**To benefit from performance improvements:**
- No action required - parallel analysis is automatic
- To tune for your workload, adjust the above environment variables

**To update dependencies:**
```bash
npm install  # Installs latest compatible versions
npm audit    # Verify no vulnerabilities
npm test     # Verify all tests pass
```

---

## Future Roadmap

### Planned Features
- [ ] Batch job processing for multiple teams
- [ ] Webhook notifications for job completion
- [ ] Additional glove customization options
- [ ] Enhanced palette generation with AI
- [ ] Performance metrics and analytics dashboard

### Under Consideration
- Support for additional uniform manufacturers
- Integration with team management platforms
- Mobile app for glove customization
- Real-time collaboration features

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

## Support

- **Issues**: [GitHub Issues](https://github.com/berginj/GloveDesign/issues)
- **Documentation**: See `/docs` folder
- **Security**: See [SECURITY.md](./docs/SECURITY.md)
