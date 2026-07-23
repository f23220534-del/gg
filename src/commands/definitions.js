const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Configurer les salons et rôles du bot')
    .addSubcommand(s => s.setName('channel').setDescription('Définir un salon').addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices(
      { name: 'Logs serveur', value: 'serverLogChannelId' }, { name: 'Transcripts tickets', value: 'ticketLogChannelId' }, { name: 'Giveaways', value: 'giveawayChannelId' }
    )).addChannelOption(o => o.setName('salon').setDescription('Salon cible').setRequired(true)))
    .addSubcommand(s => s.setName('staff').setDescription('Définir le rôle staff ticket').addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)))
    .addSubcommand(s => s.setName('category').setDescription('Définir une catégorie ticket').addStringOption(o => o.setName('type').setDescription('Type ticket').setRequired(true).addChoices(
      { name: 'Compte', value: 'account' }, { name: 'Échange', value: 'exchange' }, { name: 'Remplacement', value: 'replacement' }, { name: 'Partenariat', value: 'partnership' }
    )).addChannelOption(o => o.setName('categorie').setDescription('Catégorie').setRequired(true)))
    .addSubcommand(s => s.setName('autoclose').setDescription('Définir le délai autoclose').addIntegerOption(o => o.setName('heures').setDescription('Nombre d’heures').setMinValue(1).setMaxValue(720).setRequired(true))),
  new SlashCommandBuilder().setName('panel').setDescription('Publier un panel').addStringOption(o => o.setName('type').setDescription('Panel').setRequired(true).addChoices({ name: 'Tickets', value: 'tickets' }, { name: 'Produits', value: 'products' })),
  new SlashCommandBuilder().setName('product').setDescription('Gérer les produits')
    .addSubcommand(s => s.setName('add').setDescription('Ajouter/modifier un produit').addStringOption(o => o.setName('id').setDescription('Identifiant unique').setRequired(true)).addStringOption(o => o.setName('nom').setDescription('Nom').setRequired(true)).addStringOption(o => o.setName('prix').setDescription('Prix').setRequired(true)).addStringOption(o => o.setName('description').setDescription('Description').setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('Emoji')))
    .addSubcommand(s => s.setName('remove').setDescription('Supprimer un produit').addStringOption(o => o.setName('id').setDescription('Identifiant').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Lister les produits')),
  new SlashCommandBuilder().setName('giveaway').setDescription('Créer un giveaway').addStringOption(o => o.setName('duree').setDescription('Ex: 10m, 2h, 1d').setRequired(true)).addStringOption(o => o.setName('prix').setDescription('Lot').setRequired(true)).addIntegerOption(o => o.setName('gagnants').setDescription('Nombre de gagnants').setMinValue(1).setMaxValue(20).setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('kick').setDescription('Expulser un membre').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison')).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('timeout').setDescription('Mettre un membre en timeout').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(o => o.setName('duree').setDescription('Ex: 10m, 2h, 1d').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison')).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warn').setDescription('Avertir un membre').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true)),
  new SlashCommandBuilder().setName('warnings').setDescription('Voir les avertissements').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Supprimer des messages').addIntegerOption(o => o.setName('nombre').setDescription('1 à 100').setMinValue(1).setMaxValue(100).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(c => c.toJSON());

module.exports = commands;
