require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const ggbCommand         = require('./commands/ggb-player');
const leaderboardCommand = require('./commands/ggb-leaderboard');
const { startScheduler } = require('./scheduler');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
client.commands.set(ggbCommand.data.name, ggbCommand);
client.commands.set(leaderboardCommand.data.name, leaderboardCommand);

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  startScheduler(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[interactionCreate] Unhandled error in /${interaction.commandName}:`, err);
    const msg = { content: '⚠️ Something went wrong. Please try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
