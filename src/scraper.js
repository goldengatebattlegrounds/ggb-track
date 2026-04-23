const puppeteer = require('puppeteer');

const LEADERBOARD_URL = 'https://ggb-leaderboard.web.app/';
const CACHE_TTL        = parseInt(process.env.CACHE_TTL_MS)      || 5  * 60 * 1000;
const PROFILE_CACHE_TTL = parseInt(process.env.PROFILE_CACHE_TTL_MS) || 10 * 60 * 1000;

let leaderboardCache = { data: null, season: null, fetchedAt: 0 };
const profileCache = new Map(); // playerName (lower) -> { data, fetchedAt }

// ---------------------------------------------------------------------------
// Browser helper
// ---------------------------------------------------------------------------
function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Leaderboard scrape
// ---------------------------------------------------------------------------
async function scrapeLeaderboard() {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(LEADERBOARD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.space-y-2 button', { timeout: 15000 });

    return await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.space-y-2 button'));

      const players = buttons.map((btn) => {
        const rankEl   = btn.querySelector('.rounded-lg');
        const nameEl   = btn.querySelector('p.truncate');
        const pointsEl = btn.querySelector('span.font-bold');

        const rank   = rankEl   ? parseInt(rankEl.textContent.trim(),   10) : NaN;
        const name   = nameEl   ? nameEl.textContent.trim()                 : 'Unknown';
        const points = pointsEl ? parseInt(pointsEl.textContent.trim(), 10) : null;

        return { rank, name, points };
      }).filter(p => !isNaN(p.rank));

      const seasonEl = document.querySelector('.bg-white .font-bold.text-gray-900.text-lg');
      const season   = seasonEl ? seasonEl.textContent.trim() : 'Current Season';

      const countEl  = document.querySelector('.bg-white .text-sm.text-gray-500');
      const count    = countEl  ? countEl.textContent.trim()  : '';

      return { players, season, count };
    });
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Player profile scrape — clicks a leaderboard row, waits for page navigation
// to /players/[id], then extracts data using exact selectors from the DOM.
// ---------------------------------------------------------------------------
async function scrapePlayerProfile(targetName) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(LEADERBOARD_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.space-y-2 button', { timeout: 15000 });

    const words = targetName.toLowerCase().split(/\s+/).filter(Boolean);

    // Click the matching player row — React Router will navigate to /players/[id]
    const clickedName = await page.evaluate((words) => {
      for (const btn of document.querySelectorAll('.space-y-2 button')) {
        const nameEl = btn.querySelector('p.truncate');
        if (!nameEl) continue;
        if (words.every(w => nameEl.textContent.trim().toLowerCase().includes(w))) {
          btn.click();
          return nameEl.textContent.trim();
        }
      }
      return null;
    }, words);

    if (!clickedName) return null;

    // React Router uses client-side navigation (no real page load),
    // so waitForNavigation never fires. Poll for the URL change instead.
    await page.waitForFunction(
      () => window.location.pathname.includes('/players/'),
      { timeout: 30000 }
    );
    await page.waitForSelector('h1.text-2xl', { timeout: 30000 });

    const profile = await page.evaluate(() => {
      // Name
      const name = document.querySelector('h1.text-2xl')?.textContent.trim() ?? null;

      // Avatar — inside the w-24 h-24 rounded container; src is already absolute
      const avatar = document.querySelector('.w-24.h-24 img')?.src ?? null;

      const banner = null;

      // Store — amber pill badge: "🏠 King Kong Comics & Games"
      const store = document.querySelector('.bg-amber-100')?.textContent.trim() ?? null;

      // Faction / class — the rounded-full border pill inside the flex-wrap div
      // e.g. "Generic", "Brute", "Wizard" etc.
      const faction = document.querySelector('.flex.flex-wrap.gap-2 span.rounded-full')
        ?.textContent.trim() ?? null;

      // Lifetime stats — three-column grid, each card has p.text-3xl + p.text-sm
      const stats = { totalPoints: null, ranking: null, events: null };
      document.querySelectorAll('.grid.grid-cols-3.gap-3 > div').forEach(card => {
        const value = card.querySelector('p.text-3xl')?.textContent.trim();
        const label = card.querySelector('p.text-sm')?.textContent.trim().toLowerCase();
        if (!value || !label) return;
        if (label.includes('point')) stats.totalPoints = value;
        else if (label.includes('rank'))  stats.ranking    = value;
        else if (label.includes('event')) stats.events     = value;
      });

      return { name, avatar, banner, store, faction, ...stats };
    });

    return { ...profile, foundName: clickedName };
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function getLeaderboard(forceRefresh = false) {
  const stale = Date.now() - leaderboardCache.fetchedAt > CACHE_TTL;
  if (!forceRefresh && leaderboardCache.data && !stale) return leaderboardCache;

  console.log('[scraper] Fetching leaderboard…');
  const { players, season, count } = await scrapeLeaderboard();
  leaderboardCache = { data: players, season, count, fetchedAt: Date.now() };
  console.log(`[scraper] Cached ${players.length} players (${season}).`);
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

  console.log(`[scraper] Fetching profile for "${name}"…`);
  const data = await scrapePlayerProfile(name);
  if (data) profileCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

module.exports = { getLeaderboard, getPlayer, getPlayerProfile, LEADERBOARD_URL };
