const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embed');

function productPanel(config) {
  return {
    embeds: [baseEmbed(config)
      .setTitle('🛍️ Catalogue produits')
      .setDescription('## Appuyez sur le bouton **Produits** pour consulter le catalogue.\nLa liste et les prix seront visibles uniquement par vous.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('products:open').setLabel('Produits').setEmoji('🛒').setStyle(ButtonStyle.Primary)
    )]
  };
}

function productSelector(config) {
  const products = config.products.filter(p => p.available !== false).slice(0, 25);
  const select = new StringSelectMenuBuilder().setCustomId('products:select').setPlaceholder('Choisissez un produit')
    .addOptions(products.map(p => ({ label: p.name.slice(0, 100), value: p.id, description: `${p.price} • ${p.description}`.slice(0, 100), emoji: p.emoji || '📦' })));
  return {
    embeds: [baseEmbed(config).setTitle('📦 Produits disponibles').setDescription('Sélectionnez un produit pour afficher son prix et sa description.')],
    components: [new ActionRowBuilder().addComponents(select)]
  };
}

function productDetails(config, id) {
  const product = config.products.find(p => p.id === id);
  if (!product) return null;
  return {
    embeds: [baseEmbed(config).setTitle(`${product.emoji || '📦'} ${product.name}`).setDescription(product.description).addFields({ name: 'Prix', value: `**${product.price}**`, inline: true }, { name: 'Disponibilité', value: product.available === false ? '🔴 Indisponible' : '🟢 Disponible', inline: true })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`products:buy:${product.id}`).setLabel('Acheter / Ouvrir un ticket').setEmoji('💳').setStyle(ButtonStyle.Success)
    )]
  };
}

module.exports = { productPanel, productSelector, productDetails };
