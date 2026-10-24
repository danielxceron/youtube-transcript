# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- MIT `LICENSE` file and `.editorconfig`.
- Prettier configuration with `format` and `format:check` scripts.
- GitHub Actions CI (Node 20, 22 and 24), a scheduled live-test workflow and a tag-driven release workflow.
- Dependabot for npm and GitHub Actions.
- `check`, `prepack` and `prepublishOnly` scripts.
- Separate `tsconfig.build.json` for the bundle; `tsconfig.json` now typechecks sources and tests.

### Changed

- `engines.node` raised to `>=20` to match the test toolchain.
- `package.json` metadata: `repository` object, `bugs` URL, expanded keywords.

### Removed

- `.eslintignore` (no ESLint setup) and `tsconfig.test.json`.
- Stale `.gitignore` entries (`.editorconfig`, `/storybook-static`, `*.sln`, `*.njsproj`).

## [2.0.0] - 2026-10-24

### Added

- `YoutubeTranscript.create()` with an injectable `fetch`, timeouts, retries, concurrency limits and cache configuration.
- `YoutubeTranscript.fetchTranscripts()` for batch fetching with per-video results.
- `YoutubeTranscript.clearCache()`.
- InnerTube client rotation (Android, then iOS) with HTML scraping fallback.
- `YoutubeTranscriptNetworkError` and `YoutubeTranscriptAbortError`.
- Per-call `timeoutMs`, `retries`, `signal` and `cookie`.
- Parser support for srv1, srv3 and json3 caption formats, independent of attribute order.
- Full HTML entity decoding for decimal, hexadecimal and double-encoded entities.
- Exports: `retrieveVideoId`, `DEFAULT_CLIENTS`, `YOUTUBE_API_KEY`, `TranscriptCache`.
- Test suite with Vitest and an opt-in live integration suite.

### Changed

- **Breaking:** manual captions are preferred over automatic ones when no `lang` is requested.
- **Breaking:** `TranscriptResponse.lang` reports the selected track language (`de-DE`) instead of the requested one (`de`).
- **Breaking:** the ESM bundle was renamed from `dist/youtube-transcript.esm.js` to `dist/youtube-transcript.mjs`.
- **Breaking:** caching is enabled by default (5 minutes, 200 entries) and requests retry twice with a 20 second timeout.
- **Breaking:** the `YoutubeTranscriptNotAvailableLanguageError` message wording changed.
- Language matching now accepts regional variants consistently (`en` matches `en-US`).
- HTML extraction scans the player response instead of splitting on `"captions":`.
- Toolchain upgraded to TypeScript 5.9, Rollup 4 and Vitest 4, with strict mode enabled.

### Fixed

- InnerTube requests now send the API key and `X-YouTube-Client-*` headers. They previously failed with HTTP 400 and surfaced as a disabled transcript.
- Fallback is no longer limited to empty responses; transport and parse failures also fall back.
- A requested `lang` no longer throws when only a regional variant exists.
- Empty `captionTracks` lists and tracks without `baseUrl` are handled.
- Video identifiers are validated against `[A-Za-z0-9_-]{11}`.
- HTML entities such as `&#233;`, `&#x2019;` and `&amp;#39;` are decoded.

### Removed

- `rollup-plugin-typescript` and `rollup-plugin-typescript2` dev dependencies.

## [1.2.6] - 2026-02-04

### Fixed

- ASR caption segments are joined without inserting spaces.
