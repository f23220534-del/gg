const { baseEmbed } = require('../utils/embed');

async function logToGuild(guild, config, title, description, fields = []) {
  const id = config.serverLogChannelId;
  if (!id) return;
  const channel = guild.channels.cache.get(id);
  if (!channel?.isTextBased()) return;
  const embed = baseEmbed(config).setTitle(title).setDescription(description || null);
  if (fields.length) embed.addFields(fields);
  await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = { logToGuild };
