require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, REST, Routes, Events,
  ChannelType, PermissionFlagsBits
} = require('discord.js');
const ms = require('ms');
const db = require('./database');
const commands = require('./commands/definitions');
const { loadConfig, saveConfig } = require('./utils/config');
const { isAdmin, isTicketStaff } = require('./utils/permissions');
const { baseEmbed } = require('./utils/embed');
const { logToGuild } = require('./services/logger');
const { ticketPanel, ticketButtons, createTicket, closeTicket, autocloseSweep } = require('./services/tickets');
const { productPanel, productSelector, productDetails } = require('./services/products');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  console.error('Variables manquantes dans .env : DISCORD_TOKEN, CLIENT_ID, GUILD_ID');
  process.exit(1);
}
let config = loadConfig();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

async function ensureAdminRole(guild) {
  let role = guild.roles.cache.find(r => r.name === config.adminRoleName);
  if (!role) role = await guild.roles.create({ name: config.adminRoleName, color: config.branding.color, permissions: [PermissionFlagsBits.Administrator], reason: 'Rôle administrateur du bot' });
  return role;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
}

client.once(Events.ClientReady, async c => {
  console.log(`Connecté : ${c.user.tag}`);
  const guild = c.guilds.cache.get(process.env.GUILD_ID);
  if (guild) await ensureAdminRole(guild).catch(console.error);
  await registerCommands();
  setInterval(() => autocloseSweep(client, config).catch(console.error), 10 * 60 * 1000);
  setInterval(() => endGiveaways().catch(console.error), 30 * 1000);
});

client.on(Events.MessageCreate, message => {
  if (message.author.bot || !message.guild) return;
  const row = db.prepare('SELECT channel_id FROM tickets WHERE channel_id=? AND closed_at IS NULL').get(message.channelId);
  if (row) db.prepare('UPDATE tickets SET last_activity=? WHERE channel_id=?').run(Date.now(), message.channelId);
});

client.on(Events.GuildMemberAdd, member => logToGuild(member.guild, config, '📥 Membre arrivé', `${member.user.tag} (${member.id}) a rejoint le serveur.`));
client.on(Events.GuildMemberRemove, member => logToGuild(member.guild, config, '📤 Membre parti', `${member.user.tag} (${member.id}) a quitté le serveur.`));
client.on(Events.MessageDelete, message => { if (message.guild && !message.author?.bot) logToGuild(message.guild, config, '🗑️ Message supprimé', `Salon : ${message.channel}\nAuteur : ${message.author || 'Inconnu'}\nContenu : ${message.content || '*aucun texte*'}`.slice(0, 4000)); });
client.on(Events.MessageUpdate, (oldM, newM) => { if (newM.guild && !newM.author?.bot && oldM.content !== newM.content) logToGuild(newM.guild, config, '✏️ Message modifié', `Salon : ${newM.channel}\nAuteur : ${newM.author}\nAvant : ${oldM.content || '*vide*'}\nAprès : ${newM.content || '*vide*'}`.slice(0, 4000)); });
client.on(Events.ChannelCreate, ch => ch.guild && logToGuild(ch.guild, config, '➕ Salon créé', `${ch.name} (${ch.id})`));
client.on(Events.ChannelDelete, ch => ch.guild && logToGuild(ch.guild, config, '➖ Salon supprimé', `${ch.name} (${ch.id})`));

client.on(Events.InteractionCreate, async interaction => {
  try {
    config = loadConfig();
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket:create') return createTicket(interaction, config, interaction.values[0]);
      if (interaction.customId === 'products:select') {
        const details = productDetails(config, interaction.values[0]);
        return interaction.update(details || { content: 'Produit introuvable.', embeds: [], components: [] });
      }
    }
    if (interaction.isButton()) {
      if (interaction.customId === 'products:open') return interaction.reply({ ...productSelector(config), ephemeral: true });
      if (interaction.customId.startsWith('products:buy:')) return createTicket(interaction, config, 'account');
      if (interaction.customId === 'ticket:ping') {
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id=? AND closed_at IS NULL').get(interaction.channelId);
        if (!ticket || interaction.user.id !== ticket.owner_id) return interaction.reply({ content: 'Seul le client du ticket peut ping le staff.', ephemeral: true });
        return interaction.reply({ content: config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}> — le client demande de l’aide.` : 'Aucun rôle staff configuré.', allowedMentions: { roles: config.ticketStaffRoleId ? [config.ticketStaffRoleId] : [] } });
      }
      if (interaction.customId === 'ticket:claim') {
        if (!isTicketStaff(interaction.member, config)) return interaction.reply({ content: 'Réservé au staff.', ephemeral: true });
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id=? AND closed_at IS NULL').get(interaction.channelId);
        if (!ticket) return interaction.reply({ content: 'Ticket introuvable.', ephemeral: true });
        if (ticket.claimed_by) return interaction.reply({ content: `Déjà claim par <@${ticket.claimed_by}>.`, ephemeral: true });
        db.prepare('UPDATE tickets SET claimed_by=?, last_activity=? WHERE channel_id=?').run(interaction.user.id, Date.now(), interaction.channelId);
        return interaction.reply({ embeds: [baseEmbed(config).setTitle('✅ Ticket claim').setDescription(`${interaction.user} prend en charge ce ticket.`)] });
      }
      if (interaction.customId === 'ticket:close') {
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id=? AND closed_at IS NULL').get(interaction.channelId);
        if (!ticket || (interaction.user.id !== ticket.owner_id && !isTicketStaff(interaction.member, config))) return interaction.reply({ content: 'Vous ne pouvez pas fermer ce ticket.', ephemeral: true });
        return closeTicket(interaction, config);
      }
      if (interaction.customId === 'ticket:autoclose') {
        if (!isTicketStaff(interaction.member, config)) return interaction.reply({ content: 'Réservé au staff.', ephemeral: true });
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id=? AND closed_at IS NULL').get(interaction.channelId);
        const next = ticket.autoclose_enabled ? 0 : 1;
        db.prepare('UPDATE tickets SET autoclose_enabled=? WHERE channel_id=?').run(next, interaction.channelId);
        return interaction.update({ components: ticketButtons(config, Boolean(next)) });
      }
      if (interaction.customId.startsWith('giveaway:join:')) {
        const messageId = interaction.customId.split(':')[2];
        const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id=? AND ended=0').get(messageId);
        if (!giveaway) return interaction.reply({ content: 'Ce giveaway est terminé.', ephemeral: true });
        const exists = db.prepare('SELECT 1 FROM giveaway_entries WHERE message_id=? AND user_id=?').get(messageId, interaction.user.id);
        if (exists) { db.prepare('DELETE FROM giveaway_entries WHERE message_id=? AND user_id=?').run(messageId, interaction.user.id); return interaction.reply({ content: 'Participation retirée.', ephemeral: true }); }
        db.prepare('INSERT INTO giveaway_entries(message_id,user_id) VALUES(?,?)').run(messageId, interaction.user.id);
        return interaction.reply({ content: '🎉 Participation enregistrée.', ephemeral: true });
      }
    }
    if (!interaction.isChatInputCommand()) return;
    const adminOnly = ['setup', 'panel', 'product', 'giveaway', 'warn', 'warnings'];
    if (adminOnly.includes(interaction.commandName) && !isAdmin(interaction.member, config)) return interaction.reply({ content: `Commande réservée au rôle **${config.adminRoleName}** ou aux administrateurs.`, ephemeral: true });

    if (interaction.commandName === 'setup') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'channel') config[interaction.options.getString('type')] = interaction.options.getChannel('salon').id;
      if (sub === 'staff') config.ticketStaffRoleId = interaction.options.getRole('role').id;
      if (sub === 'category') {
        const cat = interaction.options.getChannel('categorie');
        if (cat.type !== ChannelType.GuildCategory) return interaction.reply({ content: 'Choisissez une catégorie Discord.', ephemeral: true });
        config.ticketTypes[interaction.options.getString('type')].categoryId = cat.id;
      }
      if (sub === 'autoclose') config.ticketAutoCloseHours = interaction.options.getInteger('heures');
      saveConfig(config); return interaction.reply({ content: '✅ Configuration enregistrée.', ephemeral: true });
    }
    if (interaction.commandName === 'panel') {
      const type = interaction.options.getString('type');
      await interaction.channel.send(type === 'tickets' ? ticketPanel(config) : productPanel(config));
      return interaction.reply({ content: 'Panel publié.', ephemeral: true });
    }
    if (interaction.commandName === 'product') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'add') {
        const p = { id: interaction.options.getString('id').toLowerCase().replace(/[^a-z0-9_-]/g, ''), name: interaction.options.getString('nom'), price: interaction.options.getString('prix'), description: interaction.options.getString('description'), emoji: interaction.options.getString('emoji') || '📦', available: true };
        config.products = config.products.filter(x => x.id !== p.id); config.products.push(p); saveConfig(config);
        return interaction.reply({ content: `✅ Produit **${p.name}** enregistré.`, ephemeral: true });
      }
      if (sub === 'remove') { const id = interaction.options.getString('id'); config.products = config.products.filter(p => p.id !== id); saveConfig(config); return interaction.reply({ content: 'Produit supprimé.', ephemeral: true }); }
      return interaction.reply({ embeds: [baseEmbed(config).setTitle('Produits').setDescription(config.products.map(p => `${p.emoji || '📦'} **${p.name}** — ${p.price}\nID: \`${p.id}\``).join('\n\n') || 'Aucun produit')], ephemeral: true });
    }
    if (interaction.commandName === 'giveaway') {
      const duration = ms(interaction.options.getString('duree'));
      if (!duration || duration < 10000) return interaction.reply({ content: 'Durée invalide (minimum 10 secondes).', ephemeral: true });
      const prize = interaction.options.getString('prix'), winners = interaction.options.getInteger('gagnants'), endsAt = Date.now() + duration;
      const channel = config.giveawayChannelId ? interaction.guild.channels.cache.get(config.giveawayChannelId) : interaction.channel;
      const msg = await channel.send({ embeds: [baseEmbed(config).setTitle('🎉 GIVEAWAY').setDescription(`## ${prize}\n\nCliquez pour participer.\nFin : <t:${Math.floor(endsAt / 1000)}:R>\nGagnant(s) : **${winners}**`)], components: [] });
      await msg.edit({ components: [new (require('discord.js').ActionRowBuilder)().addComponents(new (require('discord.js').ButtonBuilder)().setCustomId(`giveaway:join:${msg.id}`).setLabel('Participer').setEmoji('🎊').setStyle(require('discord.js').ButtonStyle.Success))] });
      db.prepare('INSERT INTO giveaways(message_id,channel_id,guild_id,prize,winners_count,ends_at) VALUES(?,?,?,?,?,?)').run(msg.id, channel.id, interaction.guildId, prize, winners, endsAt);
      return interaction.reply({ content: `Giveaway créé dans ${channel}.`, ephemeral: true });
    }
    if (interaction.commandName === 'ban' || interaction.commandName === 'kick' || interaction.commandName === 'timeout') {
      const member = interaction.options.getMember('membre'), reason = interaction.options.getString('raison') || 'Aucune raison';
      if (!member) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
      if (interaction.commandName === 'ban') await member.ban({ reason });
      if (interaction.commandName === 'kick') await member.kick(reason);
      if (interaction.commandName === 'timeout') { const duration = ms(interaction.options.getString('duree')); if (!duration || duration > 2419200000) return interaction.reply({ content: 'Durée invalide ou supérieure à 28 jours.', ephemeral: true }); await member.timeout(duration, reason); }
      await logToGuild(interaction.guild, config, `🛡️ ${interaction.commandName.toUpperCase()}`, `${member.user.tag} sanctionné par ${interaction.user}.`, [{ name: 'Raison', value: reason }]);
      return interaction.reply({ content: `✅ Action **${interaction.commandName}** appliquée à ${member.user.tag}.` });
    }
    if (interaction.commandName === 'warn') {
      const user = interaction.options.getUser('membre'), reason = interaction.options.getString('raison');
      db.prepare('INSERT INTO warnings(guild_id,user_id,moderator_id,reason,created_at) VALUES(?,?,?,?,?)').run(interaction.guildId, user.id, interaction.user.id, reason, Date.now());
      await user.send(`⚠️ Vous avez reçu un avertissement sur **${interaction.guild.name}**.\nRaison : ${reason}`).catch(() => null);
      await logToGuild(interaction.guild, config, '⚠️ Avertissement', `${user} averti par ${interaction.user}.`, [{ name: 'Raison', value: reason }]);
      return interaction.reply({ content: `Avertissement ajouté à ${user}.` });
    }
    if (interaction.commandName === 'warnings') {
      const user = interaction.options.getUser('membre'); const rows = db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=? ORDER BY id DESC LIMIT 20').all(interaction.guildId, user.id);
      return interaction.reply({ embeds: [baseEmbed(config).setTitle(`Avertissements de ${user.tag}`).setDescription(rows.map(r => `**#${r.id}** • <t:${Math.floor(r.created_at / 1000)}:d> • <@${r.moderator_id}>\n${r.reason}`).join('\n\n') || 'Aucun avertissement.')], ephemeral: true });
    }
    if (interaction.commandName === 'clear') {
      const count = interaction.options.getInteger('nombre'); const deleted = await interaction.channel.bulkDelete(count, true); return interaction.reply({ content: `🧹 ${deleted.size} message(s) supprimé(s).`, ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    const payload = { content: `❌ Erreur : ${error.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null); else await interaction.reply(payload).catch(() => null);
  }
});

async function endGiveaways() {
  const due = db.prepare('SELECT * FROM giveaways WHERE ended=0 AND ends_at<=?').all(Date.now());
  for (const g of due) {
    const guild = client.guilds.cache.get(g.guild_id), channel = guild?.channels.cache.get(g.channel_id);
    const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE message_id=?').all(g.message_id).map(x => x.user_id);
    const shuffled = entries.sort(() => Math.random() - 0.5); const winners = shuffled.slice(0, g.winners_count);
    if (channel?.isTextBased()) {
      const msg = await channel.messages.fetch(g.message_id).catch(() => null);
      if (msg) await msg.edit({ components: [], embeds: [baseEmbed(config).setTitle('🎉 GIVEAWAY TERMINÉ').setDescription(`## ${g.prize}\n\n${winners.length ? `Gagnant(s) : ${winners.map(id => `<@${id}>`).join(', ')}` : 'Aucun participant valide.'}`)] }).catch(() => null);
      if (winners.length) await channel.send(`🎊 Félicitations ${winners.map(id => `<@${id}>`).join(', ')} ! Vous gagnez **${g.prize}**.`).catch(() => null);
    }
    db.prepare('UPDATE giveaways SET ended=1 WHERE message_id=?').run(g.message_id);
  }
}

client.login(process.env.DISCORD_TOKEN);
