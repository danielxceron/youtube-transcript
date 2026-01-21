import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

(async () => {
    console.log(await YoutubeTranscript.fetchTranscript(process.argv[2]));
})();