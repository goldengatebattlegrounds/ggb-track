const admin = require('firebase-admin');

const LEADERBOARD_URL   = 'https://ggb-leaderboard.web.app/';
const STORAGE_BUCKET    = 'ggb-leaderboard.appspot.com';
const DB_URL            = 'https://ggb-leaderboard-default-rtdb.firebaseio.com';

const CACHE_TTL         = parseInt(process.env.CACHE_TTL_MS)         || 5  * 60 * 1000;
const PROFILE_CACHE_TTL = parseInt(process.env.PROFILE_CACHE_TTL_MS) || 10 * 60 * 1000;

let leaderboardCache = { data: null, season: null, count: '', fetchedAt: 0 };
const profileCache   = new Map();

let _db = null;
function db() {
  if (!_db) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: DB_URL,
    });
    _db = admin.database();
  }
  return _db;
}

function storageUrl(path) {
  if (!path) return null;
  const clean = path.replace(/^\//, '');
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(clean)}?alt=media`;
}

function toLabel(str) {
  if (!str) return null;
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ---------------------------------------------------------------------------
// Firebase fetchers
// ---------------------------------------------------------------------------
async function fetchLeaderboard() {
  // Active season
  const seasonSnap = await db().ref('Season')
    .orderByChild('status').equalTo('active').once('value');

  let seasonName = 'Current Season';
  let seasonId   = null;
  seasonSnap.forEach(child => {
    const s  = child.val();
    seasonName = s.name;
    seasonId   = child.key;
  });
  if (!seasonId) throw new Error('No active season found');

  // All leaderboard entries for this season
  const entrySnap = await db().ref('LeaderboardEntry')
    .orderByChild('season_id').equalTo(seasonId).once('value');

  // Aggregate points per player
  const map = new Map();
  entrySnap.forEach(child => {
    const { player_name: name, points = 0 } = child.val();
    map.set(name, (map.get(name) ?? 0) + points);
  });

  const players = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, points], i) => ({ rank: i + 1, name, points }));

  return { players, season: seasonName, count: `${players.length} players` };
}

async function fetchProfile(nameQuery) {
  const words = nameQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const snap  = await db().ref('PlayerProfileData').once('value');

  let profile = null;
  snap.forEach(child => {
    if (profile) return;
    const d = child.val();
    const storedName = (d.player_name ?? '').toLowerCase();
    if (!words.every(w => storedName.includes(w))) return;

    const stats = d.cached_stats ?? {};

    // Store: pick the one with the most events
    let store = null;
    if (stats.storeEventCounts) {
      const top = Object.entries(stats.storeEventCounts).sort((a, b) => b[1] - a[1])[0];
      if (top) store = `🏠 ${top[0]}`;
    }

    // Factions
    const factions = [
      d.favorite_class  ? toLabel(d.favorite_class)  : null,
      d.favorite_format ? toLabel(d.favorite_format) : null,
      d.fabrary_url     ? 'Fabrary'                  : null,
    ].filter(Boolean);

    // Total events
    let totalEvents = null;
    if (stats.eventTypeCounts) {
      totalEvents = Object.values(stats.eventTypeCounts).reduce((s, n) => s + n, 0);
    }

    profile = {
      foundName:   d.display_name ?? d.player_name,
      avatar:      storageUrl(d.avatar_url),
      store,
      factions,
      totalPoints: stats.lifetimePoints ?? null,
      ranking:     stats.lifetimeRank != null ? `#${stats.lifetimeRank}` : null,
      events:      totalEvents,
    };
  });

  return profile;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function getLeaderboard(forceRefresh = false) {
  const stale = Date.now() - leaderboardCache.fetchedAt > CACHE_TTL;
  if (!forceRefresh && leaderboardCache.data && !stale) return leaderboardCache;

  console.log('[firebase] Fetching leaderboard…');
  const { players, season, count } = await fetchLeaderboard();
  leaderboardCache = { data: players, season, count, fetchedAt: Date.now() };
  console.log(`[firebase] Cached ${players.length} players (${season}).`);
  return leaderboardCache;
}

async function getPlayer(name) {
  const { data: players } = await getLeaderboard();
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  return players.find(p => words.every(w => p.name.toLowerCase().includes(w))) || null;
}

async function getPlayerProfile(name, forceRefresh = false) {
  const key   = name.toLowerCase();
  const entry = profileCache.get(key);
  const stale = !entry || (Date.now() - entry.fetchedAt > PROFILE_CACHE_TTL);

  if (!forceRefresh && entry && !stale) return entry.data;

  console.log(`[firebase] Fetching profile for "${name}"…`);
  const data = await fetchProfile(name);
  if (data) profileCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

module.exports = { getLeaderboard, getPlayer, getPlayerProfile, LEADERBOARD_URL };
