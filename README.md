# youtube-transcript

[![npm version](https://img.shields.io/npm/v/@danielxceron/youtube-transcript.svg)](https://www.npmjs.com/package/@danielxceron/youtube-transcript)
[![CI](https://github.com/danielxceron/youtube-transcript/actions/workflows/ci.yml/badge.svg)](https://github.com/danielxceron/youtube-transcript/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@danielxceron/youtube-transcript.svg)](LICENSE)

## About This Fork

This is a fork of the original youtube-transcript package with a resilient extraction pipeline. It tries YouTube's InnerTube API first and falls back to HTML scraping when needed, so a single blocked route does not break transcript retrieval.

## What's New

- **InnerTube first**: signed caption URLs from the Android and iOS clients, rotated automatically
- **HTML scraping fallback** when InnerTube returns no captions
- **Reusable clients** with timeouts, retries, concurrency limits and caching
- **Batch fetching** with per-video results
- **Robust parsers** for srv1, srv3 and json3 caption formats
- **Complete HTML entity decoding** including numeric and double-encoded entities

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Upgrading from 1.x

Version 2.0.0 changes observable behavior. The static `fetchTranscript` API keeps working, but these points may require adjustments:

1. **Manual captions are preferred** over automatic ones when no `lang` is given. There is no flag to restore the old ASR-first preference.
2. **`segment.lang` is the selected track's language** (`de-DE`) instead of the requested one (`de`). Compare with prefixes if needed:
   ```js
   const wanted = (segment) => segment.lang?.toLowerCase().startsWith('de');
   ```
3. **ESM entry point renamed** from `dist/youtube-transcript.esm.js` to `dist/youtube-transcript.mjs`. Import through the package name or update direct CDN paths.
4. **Caching and retries are enabled** (`5 min`, `2 retries`, `20 s` timeout). To mimic 1.x latency and freshness:
   ```js
   const youtube = YoutubeTranscript.create({ cache: false, retries: 0 });
   ```
5. **New error classes**: `YoutubeTranscriptNetworkError` and `YoutubeTranscriptAbortError` now surface transport and abort failures.

## Installation

```bash
$ npm i @danielxceron/youtube-transcript
```

## Usage

```js
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

const transcript = await YoutubeTranscript.fetchTranscript('videoId or URL');
console.log(transcript);
```

Each segment has the shape `{ text, duration, offset, lang }`, where `duration` and `offset` are in seconds.

### Reusable client

For servers and long-running processes, create one client and share it:

```js
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

const youtube = YoutubeTranscript.create({
  timeoutMs: 15000,
  retries: 2,
  concurrency: 8,
  cache: { ttlMs: 300000, maxEntries: 500 },
});

const transcript = await youtube.fetchTranscript('videoId', { lang: 'en' });
```

### Batch fetching

```js
const results = await youtube.fetchTranscripts(['videoIdA', 'videoIdB', 'videoIdC']);

for (const { videoId, transcript, error } of results) {
  if (error) console.error(videoId, error.message);
  else console.log(videoId, transcript.length);
}
```

Duplicate identifiers are fetched only once.

### Options

| Option         | Default      | Description                                          |
| -------------- | ------------ | ---------------------------------------------------- |
| `fetch`        | global fetch | Custom fetch implementation (proxies, undici, tests) |
| `timeoutMs`    | `20000`      | Timeout per HTTP request                             |
| `retries`      | `2`          | Retries for network errors, `429` and `5xx`          |
| `concurrency`  | `6`          | Maximum in-flight requests per client                |
| `cache`        | enabled      | `false` disables it, or `{ ttlMs, maxEntries }`      |
| `clients`      | Android→iOS  | Custom InnerTube clients                             |
| `apiKey`       | public key   | InnerTube API key                                    |
| `userAgent`    | Chrome       | User agent used by the HTML strategy                 |
| `htmlFallback` | `true`       | Disable to skip HTML scraping                        |

Per-call options: `lang`, `timeoutMs`, `retries`, `signal`, `cookie`.

### Supported URL Formats

- Standard videos: `https://www.youtube.com/watch?v=VIDEO_ID`
- Short URLs: `https://youtu.be/VIDEO_ID`
- YouTube Shorts: `https://www.youtube.com/shorts/VIDEO_ID`
- Live: `https://www.youtube.com/live/VIDEO_ID`
- Embedded videos: `https://www.youtube.com/embed/VIDEO_ID`
- Direct video IDs: `VIDEO_ID`

Language matching uses regional prefixes, so `lang: 'en'` accepts `en`, `en-US` and `en-GB`. Manual captions are preferred over automatic ones.

## Error Handling

- `YoutubeTranscriptTooManyRequestError`: rate limiting detected
- `YoutubeTranscriptRequestBlockedError`: YouTube rejected the request from the current IP (for example, a bot check)
- `YoutubeTranscriptVideoUnavailableError`: video not accessible
- `YoutubeTranscriptDisabledError`: transcripts disabled for video
- `YoutubeTranscriptNotAvailableError`: no transcripts available
- `YoutubeTranscriptNotAvailableLanguageError`: requested language not available
- `YoutubeTranscriptEmptyError`: every extraction strategy returned nothing
- `YoutubeTranscriptNetworkError`: transport failure after retries
- `YoutubeTranscriptAbortError`: request aborted through `signal`

Every error exposes `name`, `videoId` (when applicable) and `cause` (when wrapped).

## Development

Requires Node.js 20 or newer (`.nvmrc` pins 22).

```bash
$ npm ci
$ npm run check         # format:check + typecheck + tests + build
$ npm test              # unit tests, mocked network
$ npm run typecheck
$ npm run format
$ npm run build
$ npm run smoke -- dQw4w9WgXcQ
```

Run a single file or watch mode:

```bash
$ npx vitest run tests/transcript.test.ts
$ npm run test:watch
```

Live tests hit YouTube for real and are opt-in:

```bash
$ YOUTUBE_TRANSCRIPT_LIVE=1 npx vitest run tests/live.test.ts
```

YouTube may block requests from cloud-provider IPs with `LOGIN_REQUIRED` and a "Sign in to confirm you're not a bot" reason. The suite reports those cases as skipped with the reason instead of failing, because they are an environment restriction rather than a regression. Run the suite from a residential connection or route requests through a proxy or authenticated cookie if you need a strict result.

CI covers Node 20, 22 and 24; a scheduled workflow runs the live suite weekly. Releases are published by GitHub Actions when a `v*` tag is pushed, using the `NPM_TOKEN` secret and npm provenance.

## Environment Compatibility

| Strategy      | Client-Side | Local Server | Production Server |
| ------------- | ----------- | ------------ | ----------------- |
| InnerTube API | ✅          | ✅           | ✅                |
| HTML Scraping | ✅          | ✅           | ✅                |

## License

**[MIT](LICENSE)** © 2026 Daniel Cerón Claros

Based on [youtube-transcript](https://github.com/Kakulukian/youtube-transcript) by Kakulukian.
