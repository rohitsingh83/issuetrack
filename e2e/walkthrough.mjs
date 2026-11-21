/**
 * Records a narrated walkthrough video of IssueTrack.
 *
 *   cd e2e && npm install --no-save playwright-core && node walkthrough.mjs [baseUrl]
 *
 * Uses the system Microsoft Edge (no browser download). The video is written to
 * docs/demo/issuetrack-walkthrough.webm. The issue it creates is deleted at the end.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] ?? 'https://issuetrack-eight.vercel.app').replace(/\/$/, '');
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../docs/demo');
const tmpDir = path.join(outDir, '.raw');
fs.mkdirSync(tmpDir, { recursive: true });

const SIZE = { width: 1280, height: 720 };
const TITLE = 'Login page crashes on Safari 17';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: tmpDir, size: SIZE },
});
const page = await context.newPage();

/** Bottom caption bar so the video explains itself without a voice-over. */
async function caption(text, ms = 2600) {
  await page.evaluate((t) => {
    let el = document.getElementById('__demo_caption');
    if (!el) {
      el = document.createElement('div');
      el.id = '__demo_caption';
      Object.assign(el.style, {
        position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
        zIndex: '2147483647', background: 'rgba(15,23,42,0.92)', color: '#fff',
        font: '600 20px/1.35 Inter, system-ui, sans-serif', padding: '12px 22px',
        borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,.35)', maxWidth: '86%',
        textAlign: 'center', pointerEvents: 'none', transition: 'opacity .25s',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = '1';
  }, text);
  await sleep(ms);
}

async function typeSlow(locator, text) {
  await locator.click();
  await locator.pressSequentially(text, { delay: 45 });
}

let createdIssueUrl = null;

try {
  // 1 — Sign in
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await caption('IssueTrack — a Jira-style bug tracker built with the MERN stack', 3200);
  await caption('Sign in with email & password, Google (Clerk), or a one-click demo account', 3000);
  await page.getByRole('button', { name: /sign in as avery chen, owner/i }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  // 2 — Dashboard
  await caption('Dashboard: assigned work, overdue issues, completion and recent activity', 3200);
  await page.mouse.wheel(0, 420);
  await sleep(1200);
  await page.mouse.wheel(0, -420);
  await sleep(600);

  // 3 — Project board
  await page.getByRole('link', { name: /nebula web app/i }).first().click();
  await page.waitForURL(/\/board$/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await caption('Each project has a Kanban board: To Do → In Progress → Done', 3000);

  // 4 — Create an issue
  await page.getByRole('button', { name: /^new issue$/i }).first().click();
  await page.locator('#issue-title').waitFor();
  await caption('Report a bug: title, description, type, priority, assignee, labels, screenshots', 2400);
  await typeSlow(page.locator('#issue-title'), TITLE);
  await typeSlow(
    page.locator('#issue-description'),
    'Clicking "Sign in" on Safari 17 shows a blank page. Works on Chrome.',
  );
  await page.locator('#issue-type').selectOption('bug');
  await page.locator('#issue-priority').selectOption('high');
  const assigneeOptions = await page.locator('#issue-assignee option').evaluateAll((os) =>
    os.map((o) => o.value).filter(Boolean),
  );
  if (assigneeOptions[1]) await page.locator('#issue-assignee').selectOption(assigneeOptions[1]);
  await sleep(700);
  await page.getByRole('button', { name: /^create issue$/i }).click();
  const card = page.locator(`[aria-label*="${TITLE}"]`).first();
  await card.waitFor({ timeout: 20000 });
  await caption('The new ticket gets an auto-numbered project key (WEB-…) and lands in To Do', 2600);

  // 5 — Drag and drop to In Progress
  await caption('Drag & drop to change status — saved to the API instantly', 1800);
  const handle = card.locator('[aria-label^="Drag "]').first();
  await card.scrollIntoViewIfNeeded();
  const column = page.locator('[aria-label^="In Progress column"]').first();
  const from = await handle.boundingBox();
  const to = await column.boundingBox();
  if (from && to) {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 10, { steps: 6 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 30 });
    await sleep(400);
    await page.mouse.up();
  }
  await sleep(2200);

  // 6 — Issue detail + comment
  await page.locator(`a:has-text("${TITLE}")`).first().click();
  await page.waitForURL(/\/issues\//, { timeout: 20000 });
  createdIssueUrl = page.url();
  await page.waitForLoadState('networkidle');
  await caption('Issue detail: edit status, priority and assignee inline; full activity history', 3000);
  const commentBox = page.getByPlaceholder(/write a comment/i);
  await commentBox.scrollIntoViewIfNeeded();
  await typeSlow(commentBox, 'Reproduced on macOS 14 — looks like a cookie SameSite issue. On it!');
  await page.getByRole('button', { name: /^comment$/i }).click();
  await sleep(1500);
  await caption('Teammates collaborate in comment threads on every ticket', 2600);

  // 7 — Search & filter
  await page.goto(`${BASE}/issues`, { waitUntil: 'networkidle' });
  await caption('Search and filter across all projects by status, priority, assignee or keyword', 2400);
  await typeSlow(page.getByRole('searchbox', { name: /search issues/i }), 'login');
  await page.waitForURL(/search=login/, { timeout: 15000 });
  await page.getByText(/\d+ issues? match/).first().waitFor();
  await sleep(2000);
  await page.getByRole('button', { name: /^in progress$/i }).first().click();
  await page.waitForURL(/status=/, { timeout: 15000 });
  await sleep(2200);
  await caption('Filters live in the URL, so any view can be shared', 2600);

  // 8 — Members & roles
  await page.getByRole('link', { name: /nebula web app/i }).first().click();
  await page.waitForURL(/\/projects\//, { timeout: 15000 });
  await page.getByRole('link', { name: /^settings$/i }).first().click();
  await page.waitForLoadState('networkidle');
  await caption('Invite members and assign roles: Owner, Admin, Member, Viewer', 2800);
  await page.mouse.wheel(0, 500);
  await caption('Permissions are enforced by the API (JWT + role checks), not just hidden in the UI', 3200);

  await caption('IssueTrack — React · Tailwind · dnd-kit · Node · Express · MongoDB · JWT · Clerk', 3500);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const raw = video ? await video.path() : null;
  if (raw && fs.existsSync(raw)) {
    const dest = path.join(outDir, 'issuetrack-walkthrough.webm');
    fs.copyFileSync(raw, dest);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('Saved', dest, `${(fs.statSync(dest).size / 1e6).toFixed(1)} MB`);
  }
}

// Clean up the demo ticket so the live dataset stays tidy.
if (createdIssueUrl) {
  const issueId = createdIssueUrl.split('/issues/')[1]?.split(/[/?#]/)[0];
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@demo.dev', password: 'Password123!' }),
  });
  const token = (await login.json()).data?.token;
  if (token && issueId) {
    const del = await fetch(`${BASE}/api/issues/${issueId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    console.log('Cleanup: deleted demo issue', del.status);
  }
}
