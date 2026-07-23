const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  PermissionFlagsBits, StringSelectMenuBuilder
} = require('discord.js');
const db = require('../database');
const { baseEmbed } = require('../utils/embed');
const { createTranscript } = require('./transcript');
const { logToGuild } = require('./logger');

function ticketPanel(config) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket:create')
    .setPlaceholder('Choisissez le type de demande')
    .addOptions(Object.entries(config.ticketTypes).map(([value, t]) => ({
      label: t.label,
      value,
      description: t.description?.slice(0, 100),
      emoji: t.emoji
    })));
  return {
    embeds: [baseEmbed(config)
      .setTitle('🎫 Ouvrir un ticket')
      .setDescription('Sélectionnez la catégorie correspondant à votre demande. Un salon privé sera créé automatiquement.')],
    components: [new ActionRowBuilder().addComponents(select)]
  };
}

function ticketButtons(config, autocloseEnabled = true) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:ping').setLabel('Ping staff').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:autoclose').setLabel(autocloseEnabled ? 'Désactiver autoclose' : 'Activer autoclose').setEmoji('⏱️').setStyle(ButtonStyle.Secondary)
  )];
}

async function createTicket(interaction, config, typeKey) {
  const type = config.ticketTypes[typeKey];
  if (!type) return interaction.reply({ content: 'Type de ticket inconnu.', ephemeral: true });
  const existing = db.prepare('SELECT channel_id FROM tickets WHERE guild_id=? AND owner_id=? AND closed_at IS NULL').get(interaction.guildId, interaction.user.id);
  if (existing) return interaction.reply({ content: `Vous avez déjà un ticket ouvert : <#${existing.channel_id}>`, ephemeral: true });

  await interaction.deferReply({ ephemeral: true });
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'client';
  const overwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];
  if (config.ticketStaffRoleId) overwrites.push({ id: config.ticketStaffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });

  const channel = await interaction.guild.channels.create({
    name: `${typeKey}-${safeName}`,
    type: ChannelType.GuildText,
    parent: type.categoryId || null,
    topic: `ticket-owner:${interaction.user.id}|type:${typeKey}`,
    permissionOverwrites: overwrites
  });

  const now = Date.now();
  db.prepare('INSERT INTO tickets(channel_id,guild_id,owner_id,type,created_at,last_activity) VALUES(?,?,?,?,?,?)')
    .run(channel.id, interaction.guildId, interaction.user.id, typeKey, now, now);

  await channel.send({
    content: `<@${interaction.user.id}>${config.ticketStaffRoleId ? ` • <@&${config.ticketStaffRoleId}>` : ''}`,
    embeds: [baseEmbed(config)
      .setTitle(`${type.emoji || '🎫'} ${type.welcomeTitle || type.label}`)
      .setDescription(type.welcomeText || 'Décrivez votre demande.')
      .addFields(
        { name: 'Client', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Choix', value: type.label, inline: true },
        { name: 'Statut', value: '🟡 En attente', inline: true },
        { name: 'Autoclose', value: `Après ${config.ticketAutoCloseHours || 24} h d'inactivité une fois claim`, inline: false }
      )],
    components: ticketButtons(config, true)
  });
  await interaction.editReply({ content: `Ticket créé : ${channel}` });
  await logToGuild(interaction.guild, config, '🎫 Ticket créé', `${interaction.user} a ouvert ${channel}.`, [{ name: 'Type', value: type.label }]);
}

async function closeTicket(interaction, config, reason = 'Fermeture manuelle') {
  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id=? AND closed_at IS NULL').get(interaction.channelId);
  if (!ticket) return interaction.reply({ content: 'Ce salon n’est pas un ticket ouvert.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const attachment = await createTranscript(interaction.channel).catch(() => null);
  const logChannel = config.ticketLogChannelId && interaction.guild.channels.cache.get(config.ticketLogChannelId);
  if (logChannel?.isTextBased()) {
    await logChannel.send({
      embeds: [baseEmbed(config).setTitle('📄 Transcript de ticket').addFields(
        { name: 'Ticket', value: interaction.channel.name, inline: true },
        { name: 'Client', value: `<@${ticket.owner_id}>`, inline: true },
        { name: 'Type', value: ticket.type, inline: true },
        { name: 'Claim', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Non claim', inline: true },
        { name: 'Fermé par', value: `${interaction.user}`, inline: true },
        { name: 'Raison', value: reason, inline: false }
      )],
      files: attachment ? [attachment] : []
    }).catch(() => null);
  }
  db.prepare('UPDATE tickets SET closed_at=? WHERE channel_id=?').run(Date.now(), interaction.channelId);
  await interaction.editReply('Transcript enregistré. Suppression du ticket.');
  await logToGuild(interaction.guild, config, '🔒 Ticket fermé', `**${interaction.channel.name}** fermé par ${interaction.user}.`, [{ name: 'Raison', value: reason }]);
  setTimeout(() => interaction.channel.delete(reason).catch(() => null), 2500);
}

async function autocloseSweep(client, config) {
  const threshold = Date.now() - (config.ticketAutoCloseHours || 24) * 3600000;
  const tickets = db.prepare('SELECT * FROM tickets WHERE closed_at IS NULL AND claimed_by IS NOT NULL AND autoclose_enabled=1 AND last_activity < ?').all(threshold);
  for (const ticket of tickets) {
    const guild = client.guilds.cache.get(ticket.guild_id);
    const channel = guild?.channels.cache.get(ticket.channel_id);
    if (!channel?.isTextBased()) { db.prepare('UPDATE tickets SET closed_at=? WHERE channel_id=?').run(Date.now(), ticket.channel_id); continue; }
    const attachment = await createTranscript(channel).catch(() => null);
    const logChannel = config.ticketLogChannelId && guild.channels.cache.get(config.ticketLogChannelId);
    if (logChannel?.isTextBased()) await logChannel.send({ content: `⏱️ Ticket **${channel.name}** fermé automatiquement après inactivité.`, files: attachment ? [attachment] : [] }).catch(() => null);
    db.prepare('UPDATE tickets SET closed_at=? WHERE channel_id=?').run(Date.now(), ticket.channel_id);
    await channel.delete('Autoclose après inactivité').catch(() => null);
  }
}

module.exports = { ticketPanel, ticketButtons, createTicket, closeTicket, autocloseSweep };
