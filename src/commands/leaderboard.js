const { SlashCommandBuilder } = require('discord.js');
const { getLeaderboard } = require('../scraper');
const { buildTop8Embed } = require('../embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the current GGB Season top 8'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data: players, season, count } = await getLeaderboard();
      const embed = buildTop8Embed(players, season, count);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[/leaderboard] Error:', err);
      await interaction.editReply('⚠️ Failed to fetch leaderboard data. Please try again in a moment.');
    }
  },
};
