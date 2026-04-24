/**
 * Run once to register slash commands with Discord:
 *   node src/deploy-commands.js
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const ggb         = require('./commands/ggb-player');
const leaderboard = require('./commands/ggb-leaderboard');

const commands = [ggb.data.toJSON(), leaderboard.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands…');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered successfully.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();
