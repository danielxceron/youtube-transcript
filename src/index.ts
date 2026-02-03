const RE_YOUTUBE =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
const RE_XML_TRANSCRIPT_ASR =
  /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
const RE_XML_TRANSCRIPT_ASR_SEGMENT =
  /<s[^>]*>([^<]*)<\/s>/g;

export class YoutubeTranscriptError extends Error {
  constructor(message) {
    super(`[YoutubeTranscript] 🚨 ${message}`);
  }
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
  constructor() {
    super(
      'YouTube is receiving too many requests from this IP and now requires solving a captcha to continue'
    );
  }
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`The video is no longer available (${videoId})`);
  }
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`Transcript is disabled on this video (${videoId})`);
  }
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`No transcripts are available for this video (${videoId})`);
  }
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
  constructor(lang: string, availableLangs: string[], videoId: string) {
    super(
      `No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
        ', '
      )}`
    );
  }
}

export class YoutubeTranscriptEmptyError extends YoutubeTranscriptError {
  constructor(videoId: string, method: string) {
    super(`The transcript file URL returns an empty response using ${method} (${videoId})`);
  }
}
export interface TranscriptConfig {
  lang?: string;
}
export interface TranscriptResponse {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

/**
 * Class to retrieve transcript if exist
 */
export class YoutubeTranscript {
  /**
   * Fetch transcript from YTB Video
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  public static async fetchTranscript(
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    try {
      return await this.fetchTranscriptWithHtmlScraping(videoId, config);
    } catch (e) {
      if (e instanceof YoutubeTranscriptEmptyError) {
        return await this.fetchTranscriptWithInnerTube(videoId, config);
      } else { 
        throw e;
      }
    }
  }

  /**
   * Fetch transcript from YTB Video using HTML scraping
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  private static async fetchTranscriptWithHtmlScraping(videoId: string, config?: TranscriptConfig) {
    const identifier = this.retrieveVideoId(videoId);
    const videoPageResponse = await fetch(
      `https://www.youtube.com/watch?v=${identifier}`,
      {
        headers: {
          ...(config?.lang && { 'Accept-Language': config.lang }),
          'User-Agent': USER_AGENT,
        },
      }
    );
    const videoPageBody = await videoPageResponse.text();

    const splittedHTML = videoPageBody.split('"captions":');

    if (splittedHTML.length <= 1) {
      if (videoPageBody.includes('class="g-recaptcha"')) {
        throw new YoutubeTranscriptTooManyRequestError();
      }
      if (!videoPageBody.includes('"playabilityStatus":')) {
        throw new YoutubeTranscriptVideoUnavailableError(videoId);
      }
      throw new YoutubeTranscriptDisabledError(videoId);
    }

    const captions = (() => {
      try {
        return JSON.parse(
          splittedHTML[1].split(',"videoDetails')[0].replace('\n', '')
        );
      } catch (e) {
        return undefined;
      }
    })()?.['playerCaptionsTracklistRenderer'];

    const processedTranscript = await this.processTranscriptFromCaptions(
      captions,
      videoId,
      config
    );

    if (!processedTranscript.length) {
      throw new YoutubeTranscriptEmptyError(videoId, 'HTML scraping');
    }

    return processedTranscript;
  }

  /**
   * Fetch transcript from YTB Video using InnerTube API
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  private static async fetchTranscriptWithInnerTube(
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    const identifier = this.retrieveVideoId(videoId);
    const options = {
      method: 'POST',
      headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; Android 13)'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 33,
            hl: config?.lang ?? 'en',
            gl: 'US'
          }
        },
        videoId: identifier,
      }),
    }
    
    const InnerTubeApiResponse = await fetch(
      'https://www.youtube.com/youtubei/v1/player',
      options
    );

    const responseJson = await InnerTubeApiResponse.json();
    const captions = responseJson?.captions?.playerCaptionsTracklistRenderer;

    if (!captions) {
      throw new YoutubeTranscriptDisabledError(identifier);
    }

    const processedTranscript = await this.processTranscriptFromCaptions(
      captions,
      videoId,
      config
    );

    if (!processedTranscript.length) {
      throw new YoutubeTranscriptEmptyError(videoId, 'InnerTube API');
    }

    return processedTranscript;
  }

  private static decodeHTMLEntities(text: string): string {
    if (!text) return '';

    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.documentElement.textContent ?? '';
    }

    if (typeof globalThis !== 'undefined') {
      return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
    }

    return text;
  }

  /**
   * Process transcript from data captions
   * @param captions Data captions
   * @param videoId Video url or video identifier
   * @param config Get transcript in a specific language ISO
   */
  private static async processTranscriptFromCaptions(
    captions: any,
    videoId: string,
    config?: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    if (!captions) {
      throw new YoutubeTranscriptDisabledError(videoId);
    }

    if (!('captionTracks' in captions)) {
      throw new YoutubeTranscriptNotAvailableError(videoId);
    }

    if (
      config?.lang &&
      !captions.captionTracks.some(
        (track) => track.languageCode === config?.lang
      )
    ) {
      throw new YoutubeTranscriptNotAvailableLanguageError(
        config?.lang,
        captions.captionTracks.map((track) => track.languageCode),
        videoId
      );
    }

    const transcriptURL = (
      config?.lang
        ? captions.captionTracks.find(
            (track) => track.languageCode === config?.lang ||
            track.languageCode.startsWith(config.lang + '-')
          )
        : captions.captionTracks.find(t => t.kind === 'asr') ||
        captions.captionTracks[0]
    ).baseUrl;

    const transcriptResponse = await fetch(transcriptURL, {
      headers: {
        ...(config?.lang && { 'Accept-Language': config.lang }),
        'User-Agent': USER_AGENT,
      },
    });
    if (!transcriptResponse.ok) {
      throw new YoutubeTranscriptNotAvailableError(videoId);
    }
    const transcriptBody = await transcriptResponse.text();
    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
    if (results.length) {
      return results.map((result) => ({
        text: result[3],
        duration: parseFloat(result[2]),
        offset: parseFloat(result[1]),
        lang: config?.lang ?? captions.captionTracks[0].languageCode,
      }))
      .filter((item) => item.text.trim() !== '');
    }

    const asrResults = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT_ASR)];
    return asrResults.map((block) => {
      let text: string
      const matchAllASRSegment = [...block[3].matchAll(RE_XML_TRANSCRIPT_ASR_SEGMENT)]
      if (matchAllASRSegment.length) {
        text = matchAllASRSegment
          .map((s) => s[1])
          .join('')
          .trim();
      } else {
        text = block[3]
      }

      if (!text || text.trim() === '') return null;

      return {
        text: this.decodeHTMLEntities(text),
        duration: Number(block[2]) / 1000,
        offset: Number(block[1]) / 1000,
        lang: config?.lang ?? captions.captionTracks[0].languageCode,
      };

    }).filter(Boolean) as TranscriptResponse[];
  }

  /**
   * Retrieve video id from url or string
   * @param videoId video url or video id
   */
  private static retrieveVideoId(videoId: string) {
    if (videoId.length === 11) {
      return videoId;
    }
    const matchId = videoId.match(RE_YOUTUBE);
    if (matchId && matchId.length) {
      return matchId[1];
    }
    throw new YoutubeTranscriptError(
      'Impossible to retrieve Youtube video ID.'
    );
  }
}
