// Reads CWG2 .pld save files (Warcraft III Preload format).

import L from "../public/data/lookups.json";
const FAMNAME = Object.fromEntries(Object.entries(L.famname).map(([k, v]) => [Number(k), v]));
const PRIMARY = Object.fromEntries(Object.entries(L.ps).map(([k, v]) => [Number(k), v]));
const TIER = L.tier;

const CHAR_MAGIC = 2431702;
const CHAR_SCHEMA = 3;
const REG = /Player\(27\),(\d+),(-?\d+)\)/g;
const HERO_RE = /^HERO_(\d{2})_(\d+)\.pld$/i;
const TAG_RE = /^(?:ENTITLEMENTS|ACCOUNT|LEGACY)_(.+?)_(\d+)(?:_\d)?\.pld$/i;

// Integer -> Warcraft rawcode ("H0GG"), or "" when it isn't one.
function i2raw(v) {
  if (!v || v < 0x30000000) return "";
  let s = "";
  for (let i = 3; i >= 0; i--) s += String.fromCharCode((v >>> (i * 8)) & 255);
  return /^[A-Za-z][A-Za-z0-9]{3}$/.test(s) ? s : "";
}

function keyValues(text) {
  const t = new Map();
  for (const m of text.matchAll(REG)) t.set(Number(m[1]), Number(m[2]));
  return t;
}

// Returns the leaderboard row for one HERO_ file, or null if it isn't a valid CWG2 character save.
function parseHero(text) {
  const t = keyValues(text);
  if (t.get(4000) !== CHAR_MAGIC || t.get(4001) !== CHAR_SCHEMA) return null;
  const n = t.get(4006) || 0;
  if (n < 19 || n > 1001) return null;
  const b = Array.from({ length: n }, (_, i) => t.get(4100 + i) || 0);
  const fam = t.get(4003) || 0;
  if (!FAMNAME[fam]) return null;
  const hid = i2raw(t.get(4004) || 0);
  const stat = PRIMARY[fam] || "";
  const vals = { Strength: b[16], Agility: b[17], Intelligence: b[18] };
  return {
    user_hash: t.get(4002), family: fam, class_name: FAMNAME[fam], hero_id: hid,
    tier: TIER[hid] ?? null, generation: t.get(4005) || 0,
    exp: b[13], gold: b[14], lum: b[15],
    strength: b[16], agility: b[17], intelligence: b[18],
    primary_stat: stat, primary_value: vals[stat] || 0,
    items: JSON.stringify([0, 1, 2, 3, 4, 5].map(k => i2raw(b[1 + 2 * k]))),
  };
}

export { parseHero, HERO_RE, TAG_RE, FAMNAME };
