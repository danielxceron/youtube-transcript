const { YoutubeTranscript } = require("./dist/youtube-transcript.common.js");

YoutubeTranscript.fetchTranscript("sa6fiO2EgJ4")
  .then(transcript => {
    console.log("Got", transcript.length, "segments");
    console.log("\n--- First 10 segments ---");
    transcript.slice(0, 10).forEach(t => console.log(t.text));
    console.log("\n--- Last 5 segments ---");
    transcript.slice(-5).forEach(t => console.log(t.text));
  })
  .catch(err => console.error("Error:", err));
