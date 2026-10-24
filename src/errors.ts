export interface TranscriptErrorOptions {
  videoId?: string;
  cause?: unknown;
}

export class YoutubeTranscriptError extends Error {
  readonly videoId?: string;

  constructor(message: string, options: TranscriptErrorOptions = {}) {
    super(
      `[YoutubeTranscript] 🚨 ${message}`,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = new.target.name;
    this.videoId = options.videoId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
  constructor() {
    super(
      'YouTube is receiving too many requests from this IP and now requires solving a captcha to continue',
    );
  }
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`The video is no longer available (${videoId})`, { videoId });
  }
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`Transcript is disabled on this video (${videoId})`, { videoId });
  }
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`No transcripts are available for this video (${videoId})`, { videoId });
  }
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
  constructor(lang: string, availableLangs: string[], videoId: string) {
    super(
      `No transcripts are available in ${lang} for this video (${videoId}). Available languages: ${availableLangs.join(
        ', ',
      )}`,
      { videoId },
    );
  }
}

export class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
  constructor(videoId: string, method: string) {
    super(`The transcript file URL returns an empty response using ${method} (${videoId})`, {
      videoId,
    });
  }
}

export class YoutubeTranscriptNetworkError extends YoutubeTranscriptError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

export class YoutubeTranscriptAbortError extends YoutubeTranscriptError {
  constructor() {
    super('The request was aborted');
  }
}
