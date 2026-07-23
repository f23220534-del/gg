const { PermissionFlagsBits } = require('discord.js');

function isAdmin(member, config) {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some(role => role.name === config.adminRoleName);
}

function isTicketStaff(member, config) {
  return isAdmin(member, config) || Boolean(config.ticketStaffRoleId && member.roles.cache.has(config.ticketStaffRoleId));
}

module.exports = { isAdmin, isTicketStaff };
