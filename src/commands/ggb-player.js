const { SlashCommandBuilder } = require('discord.js');
const { getPlayer, getPlayerProfile, getLeaderboard } = require('../scraper');
const { buildProfileEmbed } = require('../embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ggb-player')
    .setDescription('Look up a player on the GGB leaderboard')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Player name to search for').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('name');

    try {
      const leaderboardPlayer = await getPlayer(query);

      if (!leaderboardPlayer) {
        await interaction.editReply(
          `❌ No player found matching **${query}**. Check the spelling or try a partial name.`
        );
        return;
      }

      // Fetch full profile (clicks through to player detail page) and leaderboard context in parallel
      const [profile, { data: allPlayers, season }] = await Promise.all([
        getPlayerProfile(leaderboardPlayer.name),
        getLeaderboard(),
      ]);

      const embed = buildProfileEmbed(leaderboardPlayer, profile, allPlayers, season);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[/ggb-player] Error:', err);
      await interaction.editReply('⚠️ Failed to fetch leaderboard data. Please try again in a moment.');
    }
  },
};
