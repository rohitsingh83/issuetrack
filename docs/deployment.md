# Deploying IssueTrack

Three supported targets, all driven by files in this repository:

| Piece | Target | Config file |
| ----- | ------ | ----------- |
| Database | MongoDB Atlas (free M0 is enough) | — |
| API | Render (Blueprint) or Railway | `render.yaml`, `server/Dockerfile` |
| Web client | Vercel (or any static host) | `client/vercel.json`, `client/Dockerfile` |
| Everything locally | Docker Compose | `docker-compose.yml` |

> Nothing in this repository contains real credentials. Every value marked
> **“set in dashboard”** must be provided at deploy time.

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (any region close to your API).
2. **Database Access → Add New Database User** → password authentication, role `readWrite` on the app database.
   Use a generated password and store it in your password manager.
3. **Network Access → Add IP Address** → `0.0.0.0/0` for Render/Railway/Vercel-style platforms
   (they use shared egress IPs). For a static egress IP, allow only that range instead.
4. **Cluster → Connect → Drivers** and copy the SRV string:

   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/issuetrack?retryWrites=true&w=majority
   ```

   URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, …).
5. `MONGODB_URI` = that string. Indexes are created automatically on first boot by Mongoose
   (`autoIndex` stays on; the seed script also calls `syncIndexes()`).

Optional: seed the demo dataset once from your machine with the Atlas URI:

```bash
cd server
MONGODB_URI="mongodb+srv://…/issuetrack" SEED_DEMO_PASSWORD="<strong-password>" npm run seed
```

---

## 2. API on Render

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. `render.yaml` is detected automatically.
3. Fill the values marked `sync: false`:
   * `MONGODB_URI` — the Atlas SRV string
   * `CLIENT_ORIGIN` — the Vercel URL, e.g. `https://issuetrack.vercel.app` (comma-separate multiple origins)
4. Deploy. Render generates `JWT_SECRET`, mounts a 1 GB disk at `/opt/render/project/src/uploads`
   (matching `UPLOAD_DIR`) and health-checks `/api/health`.

### Option B — manual Web Service

| Setting | Value |
| ------- | ----- |
| Root directory | `server` |
| Runtime | Node 20 |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Disk | 1 GB mounted at `/opt/render/project/src/uploads` |

Environment variables: see the table in [§5](#5-environment-variables).

> **Free instances sleep.** The first request after idling can take ~30 s; attachments live on the disk,
> not in the ephemeral filesystem, so uploads survive restarts.

### API on Railway (alternative)

1. **New Project → Deploy from GitHub repo** → set **Root Directory** = `server`.
2. Railway auto-detects Node; set
   * Build: `npm ci && npm run build`
   * Start: `npm start`
3. Add a **Volume** mounted at `/app/uploads` and set `UPLOAD_DIR=/app/uploads`.
4. Add the environment variables from [§5](#5-environment-variables) (Railway injects `PORT`, the API reads it).
5. Generate a public domain → **Settings → Networking → Generate Domain**. Note the API URL,
   e.g. `https://issuetrack-api.up.railway.app`.
6. Alternatively deploy the same repo with `server/Dockerfile` selected as the builder.

---

## 3. Web client on Vercel

1. **Add New → Project** → import the repo → **Root Directory = `client`**.
2. Framework preset **Vite** (build `npm run build`, output `dist`) — already encoded in `client/vercel.json`,
   which also adds SPA rewrites and security headers.
3. Environment variable (Production + Preview):

   ```
   VITE_API_URL=https://<your-api-host>/api
   ```

   Vite inlines this at build time, so redeploy after changing it.
4. Deploy, then copy the site URL into the API's `CLIENT_ORIGIN`.

### Cross-site cookies (required for Vercel + Render/Railway)

The API and the SPA are different sites, so the session cookie must be `SameSite=None; Secure`:

```
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
CLIENT_ORIGIN=https://issuetrack.vercel.app
```

Both hosts are HTTPS, so browsers accept the cookie. If you prefer a single-origin setup, deploy
`client/Dockerfile` somewhere with nginx (it proxies `/api` and `/socket.io`), or add Vercel rewrites for
`/api/*` to the API host and leave `VITE_API_URL` empty — the SPA then calls its own origin and cookies stay
first-party. Note that Vercel's rewrite proxy does **not** support WebSocket upgrades, so keep
`VITE_API_URL` pointing at the API host to keep realtime working.

---

## 4. Docker Compose (whole stack, one command)

```bash
cp .env.example .env          # set JWT_SECRET (openssl rand -hex 48) and SEED_DEMO_PASSWORD
docker compose up --build -d
docker compose exec api npm run seed     # optional demo data
```

| Service | URL |
| ------- | --- |
| Web client (nginx) | http://localhost:8080 |
| API | http://localhost:4000/api/health |
| MongoDB | `mongodb://localhost:27017/issuetrack` |

The nginx container proxies `/api` and `/socket.io` to the `api` container, so the browser talks to a single
origin and cookies stay first-party. Data and uploads persist in the `mongo-data` / `uploads` volumes.

```bash
docker compose logs -f api     # tail API logs
docker compose down            # stop (add -v to also delete volumes)
```

---

## 5. Environment variables

### API (`server/.env`, Render/Railway dashboard)

| Variable | Required | Default | Notes |
| -------- | -------- | ------- | ----- |
| `NODE_ENV` | ✔ | `development` | `production` enables secure cookies and generic 500 messages |
| `PORT` | ✔ | `4000` | Platforms usually inject this |
| `MONGODB_URI` | ✔ | — | Atlas SRV string or local URI |
| `JWT_SECRET` | ✔ | — | ≥ 32 chars, `openssl rand -hex 48`, **never commit** |
| `JWT_EXPIRES_IN` | – | `7d` | Session length |
| `FILE_TOKEN_EXPIRES_IN` | – | `15m` | Attachment download token lifetime |
| `COOKIE_NAME` | – | `it_token` | |
| `COOKIE_SECURE` | – | `false` | `true` in production (HTTPS) |
| `COOKIE_SAME_SITE` | – | `lax` | `none` for cross-site SPA (requires `COOKIE_SECURE=true`) |
| `CLIENT_ORIGIN` | ✔ | — | Comma-separated allowed browser origins |
| `CLIENT_ORIGIN_PATTERNS` | – | — (`https://*.e2b.app` in dev) | Wildcard origin patterns, e.g. `https://*.vercel.app`; `*` matches one label |
| `UPLOAD_DIR` | – | `./uploads` | Must be a persistent disk in production |
| `MAX_UPLOAD_MB` | – | `5` | Per-file limit |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` / `AUTH_RATE_LIMIT_MAX` | – | `15` / `30` | Login + register limiter |
| `API_RATE_LIMIT_WINDOW_MINUTES` / `API_RATE_LIMIT_MAX` | – | `15` / `2000` | Global API limiter |
| `SEED_DEMO_PASSWORD` | – | `Password123!` | Dev-only demo accounts; ignored unless you run the seed |
| `MONGODB_URI_TEST` | – | `…/issuetrack_test` | Used by `npm test` |

The API validates its environment with Zod at boot and exits with a readable message if a required variable
is missing or malformed.

### Client (`client/.env.local`, Vercel dashboard)

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `VITE_API_URL` | ✔ in production | Full API base including `/api`; empty in dev to use the Vite proxy |
| `VITE_PROXY_TARGET` | – | Dev proxy target, default `http://localhost:4000` |

---

## 6. Post-deploy checklist

- [ ] `GET https://<api>/api/health` returns `{ "success": true }`
- [ ] Register → session cookie appears with `HttpOnly`, `Secure`, `SameSite=None`
- [ ] No `CORS_NOT_ALLOWED` in the API logs — if you see one, add that origin (or a `CLIENT_ORIGIN_PATTERNS` wildcard) and redeploy
- [ ] Create a project, add a member by email, create an issue (key increments)
- [ ] Drag a card between columns in two browsers — the second browser updates without refresh
- [ ] Upload a screenshot (verify the file lands on the persistent disk)
- [ ] Signed-out user hitting `/projects/...` is redirected to `/login`, then returned after signing in
- [ ] A non-member gets `403` from the API and “Project unavailable” in the UI
- [ ] `COOKIE_SECURE=true`, `JWT_SECRET` rotated, `CLIENT_ORIGIN` restricted to your real domain
