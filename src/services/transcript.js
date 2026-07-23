const discordTranscripts = require('discord-html-transcripts');

async function createTranscript(channel) {
  return discordTranscripts.createTranscript(channel, {
    limit: -1,
    returnType: 'attachment',
    filename: `transcript-${channel.name}.html`,
    saveImages: true,
    poweredBy: false
  });
}

module.exports = { createTranscript };
