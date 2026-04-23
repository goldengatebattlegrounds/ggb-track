const { EmbedBuilder } = require('discord.js');
const { LEADERBOARD_URL } = require('./scraper');

const COLOR_GOLD = 0xf5a623;
const COLOR_BLUE = 0x4a90d9;
const RANK_EMOJI = { 1: '🥇', 2: '🥈', 3: '🥉' };

function progressBar(pts, maxPts, length = 22) {
  if (!maxPts) return '░'.repeat(length);
  const filled = Math.round((pts / maxPts) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function formatWeekOf() {
  return new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

// ---------------------------------------------------------------------------
// Weekly top-8 embed
// ---------------------------------------------------------------------------
function buildTop8Embed(players, season, count) {
  const top8   = players.slice(0, 8);
  const maxPts = top8[0]?.points ?? 1;

  const lines = top8.map(p => {
    const badge = RANK_EMOJI[p.rank] ?? `**${p.rank}.**`;
    const pts   = p.points != null ? `**${p.points}** pts` : '—';
    const bar   = progressBar(p.points ?? 0, maxPts);
    return `${badge}  **${p.name}** · ${pts}\n\`${bar}\``;
  });

  const subtitle = [count, 'Updated Monday'].filter(Boolean).join(' • ');

  return new EmbedBuilder()
    .setColor(COLOR_GOLD)
    .setTitle(`🏆 ${season ?? 'GGB'} — Weekly Top 8`)
    .setDescription(`*${subtitle}*\n\n${lines.join('\n\n')}`)
    .setFooter({ text: `GGB Track • ${LEADERBOARD_URL}` })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Player profile embed
// ---------------------------------------------------------------------------
function buildProfileEmbed(leaderboardPlayer, profile, allPlayers, season) {
  const isInTop8  = leaderboardPlayer.rank <= 8;
  const eighth    = allPlayers[7];
  const ptsNeeded = (!isInTop8 && eighth && leaderboardPlayer.points != null)
    ? Math.max(0, eighth.points - leaderboardPlayer.points + 1)
    : 0;

  const displayName = profile?.foundName ?? leaderboardPlayer.name;

  // Description: store + faction badges
  const descParts = [
    profile?.store   ? profile.store            : null,
    profile?.faction ? `⚔️ ${profile.faction}` : null,
  ].filter(Boolean);

  // Season stats line
  const seasonStats = leaderboardPlayer.points != null
    ? isInTop8
      ? `Rank **#${leaderboardPlayer.rank}** · **${leaderboardPlayer.points} pts** · 🏆 Top 8`
      : `Rank **#${leaderboardPlayer.rank}** · **${leaderboardPlayer.points} pts** · ${ptsNeeded} Battle Point${ptsNeeded !== 1 ? 's' : ''} from top 8`
    : `Rank **#${leaderboardPlayer.rank}**`;

  // Lifetime stats line
  const lifetimeParts = [
    profile?.totalPoints ? `**${profile.totalPoints}** Total Points` : null,
    profile?.ranking     ? `**${profile.ranking}** Ranking`          : null,
    profile?.events      ? `**${profile.events}** Events`            : null,
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor(isInTop8 ? COLOR_GOLD : COLOR_BLUE)
    .setTitle(displayName);

  if (profile?.avatar) embed.setThumbnail(profile.avatar);
  if (profile?.banner) embed.setImage(profile.banner);
  if (descParts.length) embed.setDescription(descParts.join('  ·  '));

  embed.addFields({ name: season ?? 'Season', value: seasonStats, inline: false });

  if (lifetimeParts.length) {
    embed.addFields({ name: 'Lifetime', value: lifetimeParts.join('  ·  '), inline: false });
  }

  embed.setFooter({ text: `GGB Track • Lifetime • ${LEADERBOARD_URL}` }).setTimestamp();
  return embed;
}

module.exports = { buildTop8Embed, buildProfileEmbed };
