# Browser journey (optional)

A single Playwright script that drives the **real** stack — Vite dev server + Express API + MongoDB — through
the complete product journey in Chromium, including two live sessions for realtime and a 390 px mobile session.

It is intentionally **not** wired into `npm test`: it needs a running API/web pair and a Chromium download,
so CI runs the fast Jest/Vitest suites instead.

## Run it

```bash
# 1. backend + frontend must already be running
cd server && npm run dev          # :4000
cd client && npm run dev          # :5173

# 2. install the browser driver once
cd e2e && npm install && npx playwright install chromium

# 3. run the journey (screenshots are written to ../docs/screenshots)
npm run journey
# or: WEB_URL=http://localhost:5173 SHOTS_DIR=../docs/screenshots/e2e node journey.mjs
```

Journey screenshots land in `docs/screenshots/e2e/` so they never overwrite the curated
documentation images.

## Documentation screenshots

`npm run screenshots` re-captures the images used in the top-level README from the **seeded demo dataset**
(`owner@demo.dev`) and writes them to `docs/screenshots/`:

```bash
cd server && npm run seed          # pristine demo data
cd ../e2e && npm run screenshots
```

It shows the dashboard, project list, Kanban board, filtered issue list, cross-project explorer, issue detail,
comments + attachments, a drag & drop, project settings and two mobile viewports. The drag it performs is
reverted through the API afterwards, so the demo dataset stays clean.

The script prints one line per step and exits non-zero on the first failure, dumping the failing page's
URL, visible text and console errors.

## Steps covered

1. Register user A → empty dashboard
2. Register user B (second browser context)
3. Create a project (`E2E`-prefixed unique key)
4. Add user B as a member by email
5. Create three issues with different type/priority/labels/due date
6. Assign an issue, change priority/status
7. Open the issue detail page
8. Add → edit → delete a comment
9. Upload a screenshot attachment, then remove it
10. Search + filters write shareable URL state and update the result count
11. User B sees the project in their sidebar
12. Drag a card across Kanban columns (dnd-kit) and verify the status persists after reload
13. User B's board updates live with no refresh
14. User B sees a new comment instantly
15. A third user (outsider) gets “Project unavailable” and API `403`
16. Mobile viewport: hamburger drawer navigation works
17. Sign out returns to `/login`
18. Visiting a protected URL while signed out redirects to `/login` and returns you there after signing in
