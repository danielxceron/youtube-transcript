import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

const [video, lang] = process.argv.slice(2);

if (!video) {
  console.error('Usage: npm run smoke -- <video id or url> [lang]');
  process.exit(1);
}

try {
  const transcript = await YoutubeTranscript.fetchTranscript(video, lang ? { lang } : {});
  console.log(JSON.stringify(transcript, null, 2));
} catch (error) {
  console.error(error);
  process.exit(1);
}
