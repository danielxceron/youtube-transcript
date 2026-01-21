const { YoutubeTranscript } = require('@danielxceron/youtube-transcript');
YoutubeTranscript.fetchTranscript(process.argv[2])
  .then(console.log)
  .catch(console.error);
