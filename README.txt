CWG2 Leaderboard (Cloudflare Workers + D1)
==========================================

The site (page, CSS, JS, map data) and the API run on Cloudflare. Saves are stored in a
Cloudflare D1 (SQLite) database. Nothing runs on your PC once it's deployed.

Requirements: a free Cloudflare account and Node.js 20+ (only for the deploy tool, wrangler).

Deploy (one time)
  1. npm install
  2. npx wrangler login                 (opens the browser to sign in to Cloudflare)
  3. npm run db:create                  (creates the D1 database "cwg2")
     Copy the database_id it prints into wrangler.jsonc, replacing REPLACE_WITH_YOUR_DATABASE_ID.
  4. npm run db:migrate                 (creates the tables in D1)
  5. npm run deploy                     (prints your public URL, e.g. https://cwg2-leaderboard.<you>.workers.dev)

Update later
  Change files, then run: npm run deploy
  New files in migrations/ are applied with: npm run db:migrate

Try it locally first (optional)
  npm run dev        then open http://localhost:8787   (uses a local copy of D1, not the real one)

Files
  wrangler.jsonc          Worker settings, static assets folder and the D1 binding
  src/worker.js           API: uploads and the leaderboard query (D1)
  src/parse.js            Reads CWG2 HERO_ .pld save files
  migrations/0001_init.sql  D1 tables
  public/index.html       Page markup
  public/css/style.css    Styles
  public/js/app.js        Save viewer + leaderboard front end (ES module)
  public/data/            Map lookups and item/unit names, tooltips and icons

API
  GET  /api/leaderboard?stat=primary|str|agi|int
  POST /api/upload   body: {"files": {"HERO_08_123.pld": {"text": "...", "mtime": 0}, ...}}

How it works
  My saves     Load a CWG2 folder to view heroes, then "Submit to leaderboard".
  Leaderboard  One combined board. Each player appears once, with their character that has
               the highest main stat, ranked highest first. "Ranked by" can switch to
               Strength / Agility / Intelligence.

  Players are identified by the account number in their save file names, and named by the
  BattleTag in their ACCOUNT_/ENTITLEMENTS_/LEGACY_ file names.
  Re-uploading replaces that player's hero for each class. A save with a lower in-game
  save count than the one already stored is ignored, so a hero can't be rolled back.

Database (D1 "cwg2")
    players     one row per account (user_hash, battletag, first_seen, updated_at)
    heroes      one row per account + class, with stats, tier, items, save count
    save_files  the latest raw .pld text of every uploaded file
  Look at it with: npx wrangler d1 execute cwg2 --remote --command "SELECT * FROM players"
  Same tables as the earlier SQLite version.

Note: the server checks that files are real CWG2 saves from one account, but it does not
verify the game's internal save signature, so edited saves could still be submitted.
