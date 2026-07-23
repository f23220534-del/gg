const { EmbedBuilder } = require('discord.js');

function baseEmbed(config) {
  const embed = new EmbedBuilder()
    .setColor(config.branding.color || '#7C3AED')
    .setFooter({ text: config.branding.footer || config.branding.name || 'Discord Bot' })
    .setTimestamp();
  if (config.branding.thumbnail) embed.setThumbnail(config.branding.thumbnail);
  return embed;
}

module.exports = { baseEmbed };
