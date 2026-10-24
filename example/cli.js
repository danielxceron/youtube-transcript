const { YoutubeTranscript } = require('@danielxceron/youtube-transcript');

const [video, lang] = process.argv.slice(2);

if (!video) {
  console.error('Usage: node example/cli.js <video id or url> [lang]');
  process.exit(1);
}

YoutubeTranscript.fetchTranscript(video, lang ? { lang } : {})
  .then((transcript) => console.log(JSON.stringify(transcript, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
