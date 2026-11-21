/**
 * Records the full IssueTrack explainer video (~8 minutes).
 *
 *   cd e2e && npm install --no-save playwright-core && npx playwright-core install ffmpeg
 *   node explainer.mjs [baseUrl]
 *
 * Slides (goal, stack, architecture, data model, security, tests, deployment) are
 * interleaved with a live tour of every feature and a code walkthrough on GitHub.
 * Output: docs/demo/issuetrack-explainer.webm. Demo data it creates is removed.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] ?? 'https://issuetrack-eight.vercel.app').replace(/\/$/, '');
const REPO = 'https://github.com/rohitsingh83/issuetrack';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'docs/demo');
const tmpDir = path.join(outDir, '.raw-explainer');
fs.mkdirSync(tmpDir, { recursive: true });

const SIZE = { width: 1280, height: 720 };
const PROJECT_NAME = 'ShopEasy Checkout';
const PROJECT_KEY = 'SHOP';
const PASSWORD = 'Password123!';
// FAST=1 → quick rehearsal at ~8x speed, written to a separate file.
const FAST = Boolean(process.env.FAST);
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms * 0.12, 600) : ms));
const started = Date.now();
const log = (...a) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s]`, ...a);

// ─── API helpers (setup / cleanup only) ────────────────────────────────────
async function apiLogin(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await r.json()).data?.token;
}
async function deleteDemoProjects() {
  const token = await apiLogin('owner@demo.dev');
  const h = { authorization: `Bearer ${token}` };
  const res = await (await fetch(`${BASE}/api/projects`, { headers: h })).json();
  const list = Array.isArray(res.data) ? res.data : res.data?.projects ?? [];
  for (const p of list.filter((p) => p.key === PROJECT_KEY)) {
    await fetch(`${BASE}/api/projects/${p.id}`, { method: 'DELETE', headers: h });
    log('removed leftover project', p.key);
  }
}

await deleteDemoProjects();

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmpDir, size: SIZE } });
const page = await context.newPage();
page.setDefaultTimeout(20000);

// ─── Presentation helpers ──────────────────────────────────────────────────
async function caption(text, ms = 5000) {
  await page
    .evaluate((t) => {
      let el = document.getElementById('__demo_caption');
      if (!el) {
        el = document.createElement('div');
        el.id = '__demo_caption';
        Object.assign(el.style, {
          position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)',
          zIndex: '2147483647', background: 'rgba(15,23,42,0.93)', color: '#fff',
          font: '600 19px/1.4 Inter, Segoe UI, system-ui, sans-serif', padding: '12px 22px',
          borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,.35)', maxWidth: '88%',
          textAlign: 'center', pointerEvents: 'none',
        });
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text)
    .catch(() => {});
  await sleep(ms);
}

async function chapterBadge(n, title) {
  await page
    .evaluate(
      ([num, t]) => {
        let el = document.getElementById('__demo_chapter');
        if (!el) {
          el = document.createElement('div');
          el.id = '__demo_chapter';
          Object.assign(el.style, {
            position: 'fixed', right: '18px', top: '64px', zIndex: '2147483647',
            background: '#4f46e5', color: '#fff', font: '700 14px/1 Segoe UI, system-ui, sans-serif',
            padding: '9px 14px', borderRadius: '999px', boxShadow: '0 6px 18px rgba(79,70,229,.4)',
            pointerEvents: 'none',
          });
          document.body.appendChild(el);
        }
        el.textContent = `Chapter ${num} · ${t}`;
      },
      [n, title],
    )
    .catch(() => {});
}

const SLIDE_CSS = `
  *{box-sizing:border-box;margin:0}
  html{height:100%;overflow:hidden;background:#0b1020}
  body{min-height:100%;overflow:hidden;font-family:'Segoe UI',Inter,system-ui,sans-serif;
       background:radial-gradient(1200px 600px at 85% -10%,#4338ca55,transparent),#0b1020;color:#e2e8f0;padding:64px 80px}
  h1{font-size:46px;color:#fff;letter-spacing:-.5px} h2{font-size:34px;color:#fff;margin-bottom:26px}
  .kicker{color:#a5b4fc;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:14px;margin-bottom:14px}
  ul{list-style:none;padding:0} li{font-size:22px;margin:12px 0;padding-left:34px;position:relative;line-height:1.35}
  li:before{content:'✓';position:absolute;left:0;color:#34d399;font-weight:800}
  .grid{display:grid;gap:18px} .card{background:#ffffff0d;border:1px solid #ffffff1f;border-radius:16px;padding:18px 20px}
  .card b{color:#fff;font-size:20px;display:block;margin-bottom:6px} .card span{font-size:16px;color:#cbd5e1;line-height:1.45}
  .muted{color:#94a3b8} code{font-family:Consolas,monospace;color:#c7d2fe}
  .box{background:#1e293b;border:2px solid #6366f1;border-radius:14px;padding:16px;text-align:center;font-size:18px;color:#fff}
  .arrow{color:#818cf8;font-size:30px;text-align:center;align-self:center}
`;

async function slide(html, ms) {
  await page.setContent(`<!doctype html><html><head><style>${SLIDE_CSS}</style></head><body>${html}</body></html>`);
  await sleep(ms);
}

function img64(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : '';
}

/** Wait for the page to load without requiring an idle network (Clerk keeps polling). */
async function settle(ms = 1200) {
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await sleep(ms);
}

async function typeSlow(locator, text, delay = 40) {
  await locator.click();
  await locator.pressSequentially(text, { delay });
}

async function signInAs(email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await settle();
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await settle();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(`${BASE}/`);
  await settle();
}

async function openProjectBoard() {
  await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' }); await settle();
  await page.getByRole('link', { name: new RegExp(PROJECT_NAME, 'i') }).first().click();
  await page.waitForURL(/\/projects\/[^/]+\/board/);
  await settle();
}

async function chapter(name, fn) {
  log('▶', name);
  try {
    await fn();
  } catch (error) {
    log('⚠ chapter failed, continuing:', name, String(error).split('\n').slice(0, 3).join(' | '));
    if (FAST) {
      await page
        .screenshot({ path: path.join(outDir, `.fail-${name.replace(/\W+/g, '-')}.png`) })
        .catch(() => {});
    }
  }
}

let projectBoardUrl = null;
const createdIssueTitles = [
  { title: 'Payment fails when card has 3-D Secure', type: 'bug', priority: 'critical', labels: ['payments', 'checkout'] },
  { title: 'Show order summary before payment', type: 'story', priority: 'medium', labels: ['ux'] },
  { title: 'Add unit tests for coupon service', type: 'task', priority: 'low', labels: ['testing'] },
];

try {
  // ── 1. Intro slides ────────────────────────────────────────────────────
  await chapter('intro', async () => {
    // A real navigation first: slides rendered on the initial about:blank page are letterboxed.
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await settle(500);
    await slide(
      `<div style="display:flex;flex-direction:column;justify-content:center;height:100%">
        <div class="kicker">MERN stack · project walkthrough</div>
        <h1 style="font-size:64px">IssueTrack</h1>
        <p style="font-size:28px;color:#c7d2fe;margin-top:14px">A Jira-style bug &amp; issue tracker for software teams</p>
        <p class="muted" style="font-size:20px;margin-top:40px">React · Tailwind CSS · dnd-kit · Node.js · Express · MongoDB · JWT · Clerk</p>
        <p class="muted" style="font-size:18px;margin-top:10px">Live: ${BASE.replace('https://', '')} &nbsp;·&nbsp; Code: github.com/rohitsingh83/issuetrack</p>
      </div>`,
      9000,
    );
    await slide(
      `<div class="kicker">The goal</div><h2>What teams can do with IssueTrack</h2>
       <ul>
        <li>Create and manage projects, and invite team members</li>
        <li>Report bugs, stories and tasks as tickets inside a project</li>
        <li>Assign tickets to members of the same project</li>
        <li>Move tickets across a Kanban board: To Do → In Progress → Done</li>
        <li>Discuss tickets in comment threads, with a full activity history</li>
        <li>Filter, search and sort issues by status, priority, assignee or keyword</li>
        <li>Role-based access (Owner, Admin, Member, Viewer) and screenshot attachments</li>
       </ul>`,
      16000,
    );
    await slide(
      `<div class="kicker">Tech stack</div><h2>Built with the MERN stack, TypeScript end to end</h2>
       <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="card"><b>Frontend</b><span>React 18 + TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, dnd-kit drag &amp; drop, Sonner toasts</span></div>
        <div class="card"><b>Backend</b><span>Node.js + Express REST API, Mongoose ODM, JWT in httpOnly cookies, bcrypt password hashing, Zod validation, Multer uploads, Socket.io</span></div>
        <div class="card"><b>Platform</b><span>MongoDB Atlas, Vercel (static SPA + serverless API), Clerk for Google sign-in, Helmet, CORS, rate limiting, Jest, Vitest</span></div>
       </div>
       <p class="muted" style="font-size:19px;margin-top:28px">Global state lives in React Context (auth, current project) and TanStack Query (server data) — the PDF's "Context API / Redux" requirement.</p>`,
      16000,
    );
    await slide(
      `<div class="kicker">Architecture</div><h2>How a request flows through the app</h2>
       <div style="display:grid;grid-template-columns:1fr 50px 1.25fr 50px 1fr;gap:10px;margin-top:20px">
        <div class="box">React SPA<br><span class="muted" style="font-size:14px">pages · hooks · TanStack Query</span></div>
        <div class="arrow">→</div>
        <div class="box">Express API <code>/api</code><br><span class="muted" style="font-size:14px">validate → auth → load project/role → controller → service → serializer</span></div>
        <div class="arrow">→</div>
        <div class="box">MongoDB<br><span class="muted" style="font-size:14px">users · projects · issues · comments · activity</span></div>
       </div>
       <ul style="margin-top:34px">
        <li>The browser sends a JWT in an httpOnly cookie; the API verifies it on every protected route</li>
        <li>Each project route first resolves the caller's role — non-members get 403, unknown ids 404</li>
        <li>Services enforce business rules, write the activity log and broadcast realtime events</li>
       </ul>`,
      18000,
    );
    await slide(
      `<div class="kicker">Data model</div><h2>MongoDB collections and relationships</h2>
       <div class="grid" style="grid-template-columns:repeat(5,1fr)">
        <div class="card"><b>User</b><span>name, email, passwordHash (bcrypt), avatar</span></div>
        <div class="card"><b>Project</b><span>name, unique key (e.g. WEB), description, owner, members[ user + role ]</span></div>
        <div class="card"><b>Issue</b><span>key WEB-12, title, description, type, priority, status, assignee, reporter, labels, due date, attachments</span></div>
        <div class="card"><b>Comment</b><span>issue, author, content, edited flag, timestamps</span></div>
        <div class="card"><b>Activity</b><span>who did what to which issue — the audit trail</span></div>
       </div>
       <ul style="margin-top:26px">
        <li>Many-to-one: many issues belong to one project; one-to-many: an issue has many comments</li>
        <li>Indexes on project + status and a per-project counter give fast boards and readable keys</li>
       </ul>`,
      17000,
    );
  });

  // ── 2. Registration & sign-in ──────────────────────────────────────────
  await chapter('auth', async () => {
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' }); await settle();
    await chapterBadge(1, 'Authentication');
    await caption('Chapter 1 — Authentication. New users register with name, email and password.', 6000);
    await typeSlow(page.locator('#register-name'), 'Riya Sharma');
    await typeSlow(page.locator('#register-email'), `riya.demo${Date.now() % 100000}@example.com`);
    await typeSlow(page.locator('#register-password'), 'short');
    await page.locator('#register-confirm').click();
    await caption('Validation runs in the browser (React Hook Form + Zod) and again on the server', 5500);
    await page.locator('#register-password').fill('');
    await typeSlow(page.locator('#register-password'), 'Riya2026secure');
    await typeSlow(page.locator('#register-confirm'), 'Riya2026secure');
    await caption('Passwords are hashed with bcrypt — they are never stored or returned in plain text', 5000);
    await page.getByRole('button', { name: /^create account$/i }).click();
    await page.waitForURL(`${BASE}/`);
    await settle();
    await chapterBadge(1, 'Authentication');
    await caption('Signed in: the API set a JWT in an httpOnly cookie, so JavaScript can never read the token', 6500);
    await caption('A brand-new user starts with an empty workspace — projects appear once they create or join one', 5500);
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await settle();
    await chapterBadge(1, 'Authentication');
    await caption('The sign-in page: email + password, Google sign-in through Clerk, and one-click demo accounts', 6500);
    await caption('Protected routes redirect anonymous visitors here and send them back after login', 5000);
    await page.locator('#login-email').fill('');
    await typeSlow(page.locator('#login-email'), 'owner@demo.dev');
    await typeSlow(page.locator('#login-password'), PASSWORD, 30);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(`${BASE}/`);
    await settle();
  });

  // ── 3. Dashboard ───────────────────────────────────────────────────────
  await chapter('dashboard', async () => {
    await chapterBadge(2, 'Dashboard');
    await caption('Chapter 2 — Dashboard. Signed in as Avery, the owner of the demo workspace.', 5500);
    await caption('Counters for assigned, reported, overdue and completed issues — computed by one aggregated API call', 6500);
    await page.mouse.wheel(0, 450);
    await caption('Your open issues, every project you belong to, and a breakdown by priority and status', 6000);
    await page.mouse.wheel(0, 450);
    await caption('Recent activity across all projects — every change is recorded in the activity log', 6000);
    await page.mouse.wheel(0, -900);
    await sleep(1000);
  });

  // ── 4. Create a project ────────────────────────────────────────────────
  await chapter('create project', async () => {
    await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' }); await settle();
    await chapterBadge(3, 'Projects');
    await caption('Chapter 3 — Project management. The projects page lists every project you are a member of.', 6000);
    await page.getByRole('button', { name: /new project/i }).first().click();
    await page.locator('#project-name').waitFor();
    await typeSlow(page.locator('#project-name'), PROJECT_NAME);
    const key = page.locator('#project-key');
    await key.fill('');
    await typeSlow(key, PROJECT_KEY, 90);
    await typeSlow(page.locator('#project-description'), 'Checkout and payments for the ShopEasy store.', 25);
    await caption('Every project has a unique short key — its issues are numbered SHOP-1, SHOP-2, …', 5500);
    await page.getByRole('button', { name: /^create project$/i }).click();
    await page.waitForURL(/\/projects\/[^/]+/);
    await settle();
    projectBoardUrl = page.url();
    await chapterBadge(3, 'Projects');
    await caption('The creator becomes the project Owner automatically', 5000);
  });

  // ── 5. Members & roles ─────────────────────────────────────────────────
  await chapter('members', async () => {
    await page.getByRole('link', { name: /^settings$/i }).first().click();
    await settle();
    await chapterBadge(4, 'Team & roles');
    await caption('Chapter 4 — Team members. Owners and admins invite registered users by email and pick a role.', 6500);
    const members = [
      ['admin@demo.dev', 'admin'],
      ['member@demo.dev', 'member'],
      ['viewer@demo.dev', 'viewer'],
    ];
    const email = page.locator('#member-email');
    await email.scrollIntoViewIfNeeded();
    for (const [address, role] of members) {
      await email.fill('');
      await typeSlow(email, address, 35);
      await page.locator('#member-role').selectOption(role);
      await page.getByRole('button', { name: /^add$/i }).click();
      // Wait until the new member is actually listed before adding the next one.
      await page.locator('#members-heading').locator('xpath=ancestor::section[1]').getByText(address).waitFor({ timeout: 20000 });
      await sleep(1500);
    }
    await caption('Admin manages the team, Member works on issues, Viewer can only read', 6500);
    await caption('Roles are checked by the API on every request — hiding a button is never the only protection', 6500);
    await caption('Admins can change a role or remove a member at any time from this list', 4500);
  });

  // ── 6. Create issues ───────────────────────────────────────────────────
  await chapter('issues', async () => {
    await openProjectBoard();
    projectBoardUrl = page.url();
    await chapterBadge(5, 'Tickets');
    await caption('Chapter 5 — Tickets. Let’s report a bug and add a few more items for the team.', 5500);
    let first = true;
    for (const item of createdIssueTitles) {
      await page.getByRole('button', { name: /^new issue$/i }).first().click();
      await page.locator('#issue-title').waitFor();
      if (first) await caption('Title, description, type (bug / story / task), priority, status, assignee, due date, labels', 5000);
      await typeSlow(page.locator('#issue-title'), item.title, first ? 40 : 15);
      if (first) {
        await typeSlow(
          page.locator('#issue-description'),
          'Steps: add item → checkout → pay with a 3-D Secure card. Expected: payment succeeds. Actual: spinner forever.',
          15,
        );
      }
      await page.locator('#issue-type').selectOption(item.type);
      await page.locator('#issue-priority').selectOption(item.priority);
      const options = await page.locator('#issue-assignee option').evaluateAll((os) =>
        os.map((o) => ({ v: o.value, t: o.textContent ?? '' })).filter((o) => o.v),
      );
      const pick = options.find((o) => /marcus/i.test(o.t)) ?? options[0];
      if (pick) await page.locator('#issue-assignee').selectOption(pick.v);
      if (first) {
        const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
        await page.locator('#issue-due').fill(due);
      }
      const labels = page.locator('#issue-labels');
      for (const l of item.labels) {
        await typeSlow(labels, l, 30);
        await labels.press('Enter');
      }
      if (first) await caption('Only members of this project can be chosen as the assignee', 4500);
      await page.getByRole('dialog').getByRole('button', { name: /^create issue$/i }).click();
      await page.locator(`[aria-label*="${item.title}"]`).first().waitFor();
      await sleep(first ? 2500 : 1200);
      first = false;
    }
    await caption('Each card shows key, type, priority, labels, assignee, due date and comment count', 6000);
  });

  // ── 7. Kanban ──────────────────────────────────────────────────────────
  await chapter('kanban', async () => {
    await chapterBadge(6, 'Kanban board');
    await caption('Chapter 6 — Kanban. Drag a card to another column to change its status.', 5000);
    const drag = async (title, columnLabel) => {
      const card = page.locator(`[aria-label*="${title}"]`).first();
      await card.scrollIntoViewIfNeeded();
      const handle = card.locator('[aria-label^="Drag "]').first();
      const from = await handle.boundingBox();
      const to = await page.locator(`[aria-label^="${columnLabel} column"]`).first().boundingBox();
      if (!from || !to) return;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + 25, from.y + 12, { steps: 6 });
      await page.mouse.move(to.x + to.width / 2, to.y + 130, { steps: 35 });
      await sleep(500);
      await page.mouse.up();
      await sleep(2200);
    };
    await drag(createdIssueTitles[0].title, 'In Progress');
    await caption('The card moves instantly (optimistic update) and the new status is saved through the API', 6000);
    await drag(createdIssueTitles[2].title, 'Done');
    await caption('If the save fails, the card snaps back and a toast explains why', 5000);
    const card = page.locator(`[aria-label*="${createdIssueTitles[1].title}"]`).first();
    const key = (await card.getAttribute('aria-label'))?.split(':')[0];
    await caption('Drag & drop is never the only way: every card has a menu with “Move to …” for keyboard users', 5500);
    if (key) {
      await page.getByRole('button', { name: `Open actions for ${key}` }).click();
      await sleep(1800);
      await page.getByRole('menuitem', { name: /move to in progress/i }).click();
      await sleep(2000);
    }
    await caption('Column counters update immediately, and other teammates see the change too', 5000);
  });

  // ── 8. Issue detail ────────────────────────────────────────────────────
  await chapter('issue detail', async () => {
    await page.locator(`a:has-text("${createdIssueTitles[0].title}")`).first().click();
    await page.waitForURL(/\/issues\//);
    await settle();
    await chapterBadge(7, 'Issue detail');
    await caption('Chapter 7 — Issue detail. Everything about one ticket on a single page.', 5000);
    await page.locator('#detail-priority').selectOption('high');
    await caption('Status, priority and assignee can be changed inline from the side panel', 5000);
    await page.getByRole('button', { name: /^edit issue$/i }).click();
    const title = page.locator('#issue-title');
    await title.waitFor();
    await title.press('End');
    await page.keyboard.type(' (Safari only)', { delay: 45 });
    await caption('The edit modal updates title, description, labels and dates — permission-checked by the API', 5500);
    await page.getByRole('button', { name: /^save changes$/i }).click();
    await sleep(2500);
    // Attachments are stored on the API host's disk; on serverless hosting a file can land on a
    // different instance than the one serving it, so the video shows the panel instead of uploading.
    await page.locator('#attachments-heading').scrollIntoViewIfNeeded();
    await caption('Attachments: drag & drop or upload screenshots (PNG, JPG, WEBP, GIF, PDF up to 5 MB) to clarify bug reports', 6500);
    const box = page.getByPlaceholder(/write a comment/i);
    await box.scrollIntoViewIfNeeded();
    await typeSlow(box, 'Reproduced on Safari 17 with a test card. Looks like the 3-D Secure popup is blocked.', 30);
    await page.getByRole('button', { name: /^comment$/i }).click();
    await sleep(2200);
    await caption('Comment threads let the team collaborate; authors can edit or delete their own comments', 6000);
    await page.mouse.wheel(0, -300);
    await caption('The activity timeline records who created, assigned, moved, edited and commented — the audit trail', 6500);
  });

  // ── 9. Filters & search ────────────────────────────────────────────────
  await chapter('filters', async () => {
    await page.goto(projectBoardUrl.replace(/\/board.*/, '/issues'), { waitUntil: 'domcontentloaded' }); await settle();
    await chapterBadge(8, 'Search & filters');
    await caption('Chapter 8 — Filter & search. The issue list is a sortable, paginated table.', 5500);
    await typeSlow(page.getByRole('searchbox', { name: /search issues/i }), 'payment', 60);
    await page.waitForURL(/search=payment/);
    await caption('Keyword search matches title, key, description and labels — done on the server', 5500);
    await page.getByRole('searchbox', { name: /search issues/i }).fill('');
    await sleep(1500);
    await page.getByRole('button', { name: /^in progress$/i }).first().click();
    await sleep(1800);
    await caption('Quick status filters, plus more filters for priority, type, assignee, label and due date', 5500);
    await page.getByLabel(/sort issues/i).first().selectOption({ index: 2 }).catch(() => {});
    await sleep(1500);
    await caption('Every filter is stored in the URL, so a filtered view can be bookmarked or shared', 5500);
    await page.goto(`${BASE}/issues`, { waitUntil: 'domcontentloaded' }); await settle();
    await chapterBadge(8, 'Search & filters');
    await caption('“All issues” searches across every project you can access', 5500);
  });

  // ── 10. Role-based access in action ────────────────────────────────────
  await chapter('roles', async () => {
    await signInAs('viewer@demo.dev');
    await openProjectBoard();
    await chapterBadge(9, 'Role-based access');
    await caption('Chapter 9 — Roles in action. Now signed in as Sofia, a Viewer on this project.', 6000);
    await caption('No “New issue” button, no drag handles, no edit menu — a viewer can read but not change anything', 7000);
    await caption('Even a hand-crafted request is refused: the API answers 403 Forbidden for viewers', 6000);
    await signInAs('member@demo.dev');
    await openProjectBoard();
    await chapterBadge(9, 'Role-based access');
    await caption('Signed in as Marcus, a Member: he can create issues and work on his own or assigned tickets', 6500);
    await caption('Only owners and admins manage members, and only the owner can delete the project', 5500);
  });

  // ── 11. Code walkthrough on GitHub ────────────────────────────────────
  await chapter('code', async () => {
    const show = async (url, text, ms = 7000, scroll = 0) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await sleep(1500);
      if (scroll) await page.mouse.wheel(0, scroll);
      await chapterBadge(10, 'Code walkthrough');
      await caption(text, ms);
    };
    await show(REPO, 'Chapter 10 — The code. The GitHub repo with README, screenshots and setup instructions.', 7000, 500);
    await show(`${REPO}/tree/main/server/src`, 'Backend: routes → controllers → services → models, plus middleware, validators and policies', 7500);
    await show(`${REPO}/blob/main/server/src/models/Issue.ts`, 'The Issue model: Mongoose schema with references to project, assignee and reporter, and indexes', 7500, 300);
    await show(`${REPO}/blob/main/server/src/middleware/auth.ts`, 'Auth middleware: reads the JWT from the cookie (or Bearer header), verifies it and loads the user', 7500, 200);
    await show(`${REPO}/blob/main/server/src/policies/permissions.ts`, 'Permission rules in one place: who can edit, delete, comment or manage members', 7500, 200);
    await show(`${REPO}/tree/main/client/src`, 'Frontend: pages, reusable components, hooks for data fetching, and shared types', 7000);
    await show(`${REPO}/blob/main/client/src/components/issues/KanbanBoard.tsx`, 'KanbanBoard.tsx: dnd-kit sensors for mouse, touch and keyboard, with optimistic status updates', 7500, 400);
    await show(`${REPO}/blob/main/api/index.ts`, 'api/index.ts runs the same Express app as a Vercel serverless function in production', 6500, 200);
  });

  // ── 12. Responsive, security, tests, deployment ───────────────────────
  await chapter('closing slides', async () => {
    const a = img64('docs/screenshots/11-mobile-dashboard.png');
    const b = img64('docs/screenshots/12-mobile-board.png');
    await slide(
      `<div class="kicker">Responsive design</div><h2>Works on phones, tablets and desktops</h2>
       <div style="display:flex;gap:40px;align-items:flex-start">
        ${a ? `<img src="${a}" style="height:470px;border-radius:18px;border:1px solid #ffffff22">` : ''}
        ${b ? `<img src="${b}" style="height:470px;border-radius:18px;border:1px solid #ffffff22">` : ''}
        <ul style="flex:1"><li>Tailwind breakpoints and a slide-in navigation drawer</li><li>Touch-friendly drag &amp; drop on the board</li><li>Loaders, skeletons, empty states and toast messages</li><li>Accessible dialogs, labels and keyboard navigation</li></ul>
       </div>`,
      15000,
    );
    await slide(
      `<div class="kicker">Security</div><h2>Built safely from the start</h2>
       <ul>
        <li>bcrypt password hashing; JWT stored in an httpOnly, Secure, SameSite cookie</li>
        <li>Google sign-in via Clerk: the server verifies Clerk's session token before trusting any email</li>
        <li>Zod validation on every body, query and route parameter — unknown fields are stripped</li>
        <li>Project membership and role resolved before every handler; rules re-checked in services</li>
        <li>Helmet security headers, strict CORS allow-list, rate limiting on auth and API routes</li>
        <li>Upload type and size limits; no stack traces or secrets ever sent to the browser</li>
       </ul>`,
      17000,
    );
    await slide(
      `<div class="kicker">Testing &amp; quality</div><h2>86 automated tests</h2>
       <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card"><b>52 API tests · Jest + Supertest</b><span>Registration and login, protected routes, project roles, member management, issue CRUD, filters/search/sort/pagination, comment and attachment permissions, Clerk token checks, activity log</span></div>
        <div class="card"><b>34 UI tests · Vitest + Testing Library</b><span>Login validation, demo sign-in, protected routes, create-issue form, Kanban status change with rollback, project-role cache, loading/empty/error states</span></div>
       </div>
       <p class="muted" style="font-size:19px;margin-top:26px">Plus TypeScript strict mode, ESLint and Prettier in both packages, and an end-to-end browser journey with Playwright.</p>`,
      15000,
    );
    await slide(
      `<div class="kicker">Deployment</div><h2>Live on Vercel with MongoDB Atlas</h2>
       <ul>
        <li>One Vercel project: the React build is served as static files, the API runs as a serverless function at <code>/api</code></li>
        <li>Same origin for site and API — no cross-site cookie problems</li>
        <li>MongoDB Atlas free cluster connected through the Vercel Storage integration</li>
        <li>Secrets live in Vercel environment variables, never in the repository</li>
        <li>Every push to <code>main</code> on GitHub redeploys automatically</li>
        <li>Demo data is seeded once on first start, guarded against concurrent cold starts</li>
       </ul>`,
      15000,
    );
  });

  // ── 13. Clean up + outro ───────────────────────────────────────────────
  await chapter('cleanup', async () => {
    await signInAs('owner@demo.dev');
    await openProjectBoard();
    await page.getByRole('link', { name: /^settings$/i }).first().click();
    await settle();
    await page.getByRole('button', { name: /^delete project$/i }).scrollIntoViewIfNeeded();
    await chapterBadge(11, 'Wrap-up');
    await caption('Finally, the owner-only danger zone: deleting a project removes its issues, comments and activity', 6000);
    await page.getByRole('button', { name: /^delete project$/i }).click();
    await sleep(1800);
    await page.getByRole('dialog').getByRole('button', { name: /^delete project$/i }).click();
    await page.waitForURL(/\/projects$/);
    await sleep(2500);
  });

  await slide(
    `<div style="display:flex;flex-direction:column;justify-content:center;height:100%">
      <div class="kicker">Thanks for watching</div>
      <h1 style="font-size:56px">IssueTrack</h1>
      <p style="font-size:26px;color:#c7d2fe;margin-top:16px">Projects · Tickets · Assignments · Kanban · Comments · Filters · Roles · Attachments</p>
      <p style="font-size:22px;margin-top:40px">🔗 Live demo: <b>${BASE.replace('https://', '')}</b></p>
      <p style="font-size:22px;margin-top:10px">💻 Source code: <b>github.com/rohitsingh83/issuetrack</b></p>
      <p class="muted" style="font-size:18px;margin-top:30px">Try it with the one-click demo accounts on the sign-in page.</p>
    </div>`,
    10000,
  );
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const raw = video ? await video.path() : null;
  if (raw && fs.existsSync(raw)) {
    const dest = path.join(outDir, FAST ? '.rehearsal.webm' : 'issuetrack-explainer.webm');
    fs.copyFileSync(raw, dest);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    log('Saved', dest, `${(fs.statSync(dest).size / 1e6).toFixed(1)} MB`);
  }
  await deleteDemoProjects().catch(() => {});
}
