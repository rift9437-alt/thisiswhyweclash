# Keep Clash — Online Multiplayer Setup (Render)

This is a tiny WebSocket relay server. It doesn't run any game logic — it just
pairs two browsers into a "room" by 5-letter code and forwards their moves to
each other. The actual battle simulation still runs locally in each player's
browser (as it already does today).

## 1. Push this folder to GitHub

Create a new repo (can be called anything, e.g. `card-clash-server`) containing
just the two files in this folder: `server.js` and `package.json`. Commit and
push it.

## 2. Deploy on Render

1. Go to https://dashboard.render.com → **New** → **Web Service**.
2. Connect the GitHub repo you just made.
3. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free is fine to start.
4. Click **Create Web Service**. Render will build and deploy it — this takes
   a minute or two.
5. Once it's live, copy the URL it gives you, something like:
   `https://card-clash-server-xxxx.onrender.com`

## 3. Point the game at your server

Open `card-clash.html`, find this line near the top of the `<script>` block:

```js
const SERVER_HOST = "card-clash-server.onrender.com";
```

Replace the value with **just the host** from your Render URL — no `https://`,
no trailing slash:

```js
const SERVER_HOST = "card-clash-server-xxxx.onrender.com";
```

Save the file. That's it — "Host Online Match" and "Join with Code" will now
talk to your server.

## 4. Where to put the HTML file itself

The `card-clash.html` game file can be hosted anywhere that serves static
files — GitHub Pages, Render's own "Static Site" service, Netlify, or even
just opened as a local file. It only needs internet access to reach your
relay server over WebSocket (`wss://`), which works fine from a local file or
any host, since the browser initiates the connection itself.

## Notes on Render's free tier

- Free Web Services spin down after ~15 minutes of no traffic. The next
  connection can take 20–50 seconds to "wake up" — the game shows a
  "waking up" message during this wait, so it's not broken, just slow to
  start. Upgrading to a paid instance removes this delay.
- The server keeps room state only in memory. If it restarts (e.g. after
  spinning down), any in-progress room codes are lost — just host/join again.
- This has no persistence, accounts, or matchmaking beyond room codes by
  design, matching how the original PartyKit scaffold worked.
