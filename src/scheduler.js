const cron = require('node-cron');
const { getLeaderboard } = require('./scraper');
const { buildTop8Embed } = require('./embeds');

// "0 9 * * 1" = every Monday at 09:00 in the timezone below
const CRON_SCHEDULE = '0 9 * * 1';
const TIMEZONE = 'America/Los_Angeles';

function startScheduler(client) {
  cron.schedule(
    CRON_SCHEDULE,
    async () => {
      console.log('[scheduler] Firing weekly leaderboard post…');

      const channelId = process.env.WEEKLY_CHANNEL_ID;
      if (!channelId) {
        console.error('[scheduler] WEEKLY_CHANNEL_ID not set — skipping post.');
        return;
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.error(`[scheduler] Could not find channel ${channelId}.`);
        return;
      }

      try {
        // Force a fresh scrape for the weekly post
        const { data: players, season, count } = await getLeaderboard(true);
        const embed = buildTop8Embed(players, season, count);
        await channel.send({ embeds: [embed] });
        console.log('[scheduler] Weekly leaderboard posted successfully.');
      } catch (err) {
        console.error('[scheduler] Failed to post weekly leaderboard:', err);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`[scheduler] Weekly post scheduled — every Monday 9am PST (${CRON_SCHEDULE})`);
}

module.exports = { startScheduler };
