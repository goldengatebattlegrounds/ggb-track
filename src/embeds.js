const { EmbedBuilder } = require('discord.js');
const { LEADERBOARD_URL } = require('./scraper');

const COLOR_GOLD = 0xf5a623;
const COLOR_BLUE = 0x4a90d9;

function progressBar(pts, maxPts, length = 20) {
  if (!maxPts) return '░'.repeat(length);
  const filled = Math.round((pts / maxPts) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// ---------------------------------------------------------------------------
// Weekly top-8 embed
// ---------------------------------------------------------------------------
function buildTop8Embed(players, season, count) {
  const top8   = players.slice(0, 8);
  const maxPts = top8[0]?.points ?? 1;

  const lines = top8.map(p => {
    const rank = `**${p.rank}.**`;
    const pts  = p.points != null ? `**${p.points}** pts` : '—';
    const bar  = progressBar(p.points ?? 0, maxPts);
    return `${rank} **${p.name}** · ${pts}\n${bar}`;
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

  // Description: store + factions
  const descParts = [
    profile?.store ?? null,
    ...(profile?.factions?.length ? profile.factions.map(f => `⚔️ ${f}`) : []),
  ].filter(Boolean);

  // Season stats
  const seasonStats = leaderboardPlayer.points != null
    ? isInTop8
      ? `Rank **#${leaderboardPlayer.rank}** · **${leaderboardPlayer.points} pts** · 🏆 Top 8`
      : `Rank **#${leaderboardPlayer.rank}** · **${leaderboardPlayer.points} pts** · ${ptsNeeded} Battle Point${ptsNeeded !== 1 ? 's' : ''} from top 8`
    : `Rank **#${leaderboardPlayer.rank}**`;

  const embed = new EmbedBuilder()
    .setColor(isInTop8 ? COLOR_GOLD : COLOR_BLUE)
    .setAuthor(
      profile?.avatar
        ? { name: displayName, iconURL: profile.avatar }
        : { name: displayName }
    );

  if (profile?.avatar) embed.setThumbnail(profile.avatar);
  if (descParts.length) embed.setDescription(descParts.join('  ·  '));

  embed.addFields({ name: season ?? 'Season', value: seasonStats, inline: false });

  const lifetimeFields = [
    profile?.totalPoints != null ? { name: 'Total Points', value: `**${profile.totalPoints}**`, inline: true } : null,
    profile?.ranking             ? { name: 'Ranking',      value: `**${profile.ranking}**`,     inline: true } : null,
    profile?.events   != null    ? { name: 'Events',       value: `**${profile.events}**`,       inline: true } : null,
  ].filter(Boolean);

  if (lifetimeFields.length) {
    embed.addFields({ name: 'Lifetime', value: '\u200b', inline: false });
    embed.addFields(...lifetimeFields);
  }

  embed.setFooter({ text: `GGB Track • ${LEADERBOARD_URL}` }).setTimestamp();
  return embed;
}

module.exports = { buildTop8Embed, buildProfileEmbed };
