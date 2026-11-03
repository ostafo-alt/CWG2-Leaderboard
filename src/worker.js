// CWG2 leaderboard: Cloudflare Worker + D1.
// Static files in ./public are served by Workers Static Assets; this Worker handles /api/*.
import { parseHero, HERO_RE, TAG_RE } from "./parse.js";

const STATS = { str: "strength", agi: "agility", int: "intelligence" };
const MAX_BODY = 4 * 1024 * 1024; // a whole CWG2 folder is well under this

class UploadError extends Error {}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const basename = name => String(name).split(/[\\/]/).pop();

// files: { filename: { text, mtime } }
async function upload(db, files) {
  const now = Date.now();
  const heroes = [], skipped = [], hashes = new Set();
  let tag = null;
  for (const [name, f] of Object.entries(files)) {
    const base = basename(name);
    let m = base.match(HERO_RE);
    if (m) {
      const h = parseHero(f.text);
      if (!h || String(h.user_hash) !== m[2] || h.family !== Number(m[1])) { skipped.push(base); continue; }
      h.file_mtime = f.mtime || null;
      heroes.push(h);
      hashes.add(h.user_hash);
      continue;
    }
    m = base.match(TAG_RE);
    if (m) { tag = tag || m[1]; hashes.add(Number(m[2])); }
  }
  if (!heroes.length) throw new UploadError("No valid HERO_ save files found in the upload.");
  if (hashes.size !== 1) throw new UploadError("The files come from more than one account. Upload one player's CWG2 folder at a time.");
  const uh = [...hashes][0];

  // Current state for this player, read first so the writes below can go in one atomic batch.
  const [{ results: playerRows }, { results: oldRows }] = await db.batch([
    db.prepare("SELECT battletag FROM players WHERE user_hash=?").bind(uh),
    db.prepare("SELECT family, generation FROM heroes WHERE user_hash=?").bind(uh),
  ]);
  const existing = new Map(oldRows.map(r => [r.family, r.generation]));

  const stmts = [
    db.prepare(`INSERT INTO players(user_hash,battletag,first_seen,updated_at) VALUES(?1,?2,?3,?3)
                ON CONFLICT(user_hash) DO UPDATE SET updated_at=?3, battletag=COALESCE(?2, battletag)`).bind(uh, tag, now),
  ];
  const replaced = [], keptNewer = [];
  for (const h of heroes) {
    const old = existing.get(h.family);
    if (old !== undefined && old > h.generation) { keptNewer.push(h.class_name); continue; } // never roll a hero back
    if (old !== undefined) replaced.push(h.class_name);
    h.uploaded_at = now;
    const cols = Object.keys(h);
    stmts.push(db.prepare(`INSERT OR REPLACE INTO heroes(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`)
      .bind(...cols.map(k => h[k] ?? null)));
  }
  for (const [name, f] of Object.entries(files)) {
    const base = basename(name);
    if (/\.pld$/i.test(base) && (HERO_RE.test(base) || TAG_RE.test(base) || /^SETTINGS_/i.test(base)))
      stmts.push(db.prepare("INSERT OR REPLACE INTO save_files VALUES(?,?,?,?,?)").bind(uh, base, f.text, f.mtime || null, now));
  }
  await db.batch(stmts); // D1 runs a batch as a single transaction

  const player = tag || playerRows[0]?.battletag;
  return { player: player || `Player ${uh}`, user_hash: uh, heroes: heroes.length - keptNewer.length,
           replaced, kept_newer: keptNewer, skipped };
}

// One combined board: each player appears once, with their highest character for the stat.
async function leaderboard(db, stat, limit = 200) {
  const col = STATS[stat] || "primary_value";
  const { results } = await db.prepare(`
    SELECT * FROM (
      SELECT h.*, COALESCE(p.battletag, 'Player ' || p.user_hash) AS player,
             (SELECT COUNT(*) FROM heroes x WHERE x.user_hash = h.user_hash) AS hero_count,
             ROW_NUMBER() OVER (PARTITION BY h.user_hash ORDER BY h.${col} DESC, h.exp DESC) AS pick
      FROM heroes h JOIN players p USING(user_hash))
    WHERE pick = 1 ORDER BY ${col} DESC, exp DESC LIMIT ?`).bind(limit).all();
  return results.map(({ pick, ...r }) => ({ ...r, items: JSON.parse(r.items) }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (request.method === "POST" && url.pathname === "/api/upload") {
        if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) throw new UploadError("Upload is too large.");
        const text = await request.text();
        if (text.length > MAX_BODY) throw new UploadError("Upload is too large.");
        const data = JSON.parse(text);
        if (!data || typeof data.files !== "object") throw new UploadError("Upload format not recognised.");
        const files = {};
        for (const [k, v] of Object.entries(data.files)) files[String(k)] = { text: String(v?.text ?? ""), mtime: Number(v?.mtime) || 0 };
        return json(await upload(env.DB, files));
      }
      if (request.method === "GET" && url.pathname === "/api/leaderboard") {
        const stat = url.searchParams.get("stat") || "primary";
        if (stat !== "primary" && !STATS[stat]) return json({ error: "Unknown stat." }, 400);
        return json({ stat, rows: await leaderboard(env.DB, stat) });
      }
      return json({ error: "Not found." }, 404);
    } catch (e) {
      if (e instanceof UploadError) return json({ error: e.message }, 400);
      if (e instanceof SyntaxError) return json({ error: "Upload format not recognised." }, 400);
      console.error(e);
      return json({ error: "Server error." }, 500);
    }
  },
};
