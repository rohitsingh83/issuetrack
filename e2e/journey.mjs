import { chromium } from 'playwright';
import fs from 'fs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR ?? new URL('../docs/screenshots/e2e', import.meta.url).pathname;
const ts = Date.now();
const ownerEmail = `e2e.owner.${ts}@test.dev`;
const memberEmail = `e2e.member.${ts}@test.dev`;
const outsiderEmail = `e2e.outsider.${ts}@test.dev`;
const PASSWORD = 'Password123!';
const PROJECT_KEY = `E${String(ts).slice(-6)}`;
const PROJECT_NAME = `E2E Nebula ${String(ts).slice(-4)}`;
const results = [];
fs.mkdirSync(SHOTS, { recursive: true });

function log(...args) { console.log(...args); }
async function step(name, fn) {
  const started = Date.now();
  try {
    const value = await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    log(`✅ ${name} (${Date.now() - started}ms)`);
    return value;
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    log(`❌ ${name} → ${error.message}`);
    throw error;
  }
}

async function register(page, { name, email }) {
  await page.goto(`${WEB}/register`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: false }).first().fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(`${WEB}/`, { timeout: 15000 });
  await page.getByRole('heading', { name: /good to see you/i }).waitFor({ timeout: 15000 });
}

async function signIn(page, email) {
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: false }).first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function login(page, email) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: false }).first().fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(`${WEB}/`, { timeout: 15000 });
  await page.getByRole('heading', { name: /good to see you/i }).waitFor({ timeout: 15000 });
}

async function createIssue(page, { title, description, priority = 'medium', type = 'bug', labels = [], dueDate }) {
  await page.getByRole('button', { name: 'New issue' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel('Title').fill(title);
  if (description) await dialog.getByLabel('Description').fill(description);
  await dialog.getByLabel('Priority').selectOption(priority);
  await dialog.getByLabel('Type').selectOption(type);
  if (dueDate) await dialog.getByLabel('Due date').fill(dueDate);
  for (const label of labels) {
    await dialog.getByLabel('Add a label').fill(label);
    await dialog.getByLabel('Add a label').press('Enter');
  }
  await dialog.getByRole('button', { name: 'Create issue' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  await page.getByText(title, { exact: false }).first().waitFor({ timeout: 15000 });
}

let pageA, pageB, pageC, browser;
async function dumpDiagnostics(page) {
  try {
    log('\n--- DIAGNOSTICS ---');
    log('URL:', page.url());
    log('BODY:', (await page.locator('body').innerText()).slice(0, 1500));
    log('ERRORS:', [...new Set(errors)].slice(0, 10).join('\n'));
  } catch (e) { log('dump failed', e.message); }
}

browser = await chromium.launch({ args: ['--no-sandbox'] });
const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const contextB = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const contextC = await browser.newContext({ viewport: { width: 390, height: 844 } });
pageA = await contextA.newPage();
pageB = await contextB.newPage();
pageC = await contextC.newPage();
const errors = [];
for (const [label, page] of [['A', pageA], ['B', pageB], ['C', pageC]]) {
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
}

let projectId = '';

try {
await step('1. Register a new user (owner)', async () => {
  await register(pageA, { name: 'E2E Owner', email: ownerEmail });
  await pageA.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: false });
});

await step('2. Dashboard shows empty-state projects', async () => {
  await pageA.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
  await pageA.getByText(/no projects yet/i).first().waitFor();
});

await step('3. Register the second (team member) user', async () => {
  await register(pageB, { name: 'E2E Member', email: memberEmail });
});

await step('4. Create a project', async () => {
  await pageA.getByRole('link', { name: /new project/i }).first().click();
  const dialog = pageA.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel('Project name').fill(PROJECT_NAME);
  await dialog.getByLabel('Project key').fill(PROJECT_KEY);
  await dialog.getByLabel('Description').fill('End-to-end verification project');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await pageA.waitForURL(/\/projects\/[0-9a-f]{24}\/board/, { timeout: 15000 });
  projectId = pageA.url().split('/projects/')[1].split('/')[0];
  await pageA.getByRole('heading', { name: PROJECT_NAME }).waitFor();
  await pageA.screenshot({ path: `${SHOTS}/02-empty-board.png` });
});

await step('5. Add the second user as a project member', async () => {
  await pageA.getByRole('link', { name: 'Settings', exact: true }).click();
  await pageA.getByLabel('Add member by email').fill(memberEmail);
  await pageA.getByLabel('Role', { exact: true }).selectOption('member');
  await pageA.getByRole('button', { name: 'Add', exact: true }).click();
  await pageA.getByText('E2E Member').first().waitFor({ timeout: 15000 });
  await pageA.screenshot({ path: `${SHOTS}/09-project-settings.png` });
});

await step('6. Create three issues on the board', async () => {
  await pageA.getByRole('link', { name: 'Board', exact: true }).click();
  await createIssue(pageA, {
    title: 'Checkout button does nothing on Safari',
    description: 'Repro: Safari 17, autofill enabled.\nExpected: order submits.\nActual: nothing happens.',
    priority: 'critical',
    labels: ['checkout', 'safari'],
    dueDate: '2026-12-01',
  });
  await createIssue(pageA, {
    title: 'Add CSV export to the issue list',
    description: 'Export the currently filtered issue list.',
    priority: 'medium',
    type: 'story',
    labels: ['reporting'],
  });
  await createIssue(pageA, {
    title: 'Comment timestamps should be relative',
    description: 'Show “3 minutes ago” with an absolute tooltip.',
    priority: 'low',
    type: 'task',
    labels: ['ui'],
  });
  await pageA.getByTestId('kanban-column-todo').getByTestId(/issue-card-/).first().waitFor();
  await pageA.screenshot({ path: `${SHOTS}/03-kanban-board.png` });
});

await step('7. Open an issue and assign it to the team member', async () => {
  await pageA.getByRole('link', { name: 'Checkout button does nothing on Safari' }).click();
  await pageA.waitForURL(/\/issues\/[0-9a-f]{24}$/);
  await pageA.getByLabel('Assignee').selectOption({ label: 'E2E Member' });
  await pageA.getByText('E2E Member').first().waitFor();
  await pageA.screenshot({ path: `${SHOTS}/04-issue-detail.png` });
});

await step('8. Add, edit and delete a comment', async () => {
  const input = pageA.getByLabel('Add a comment');
  await input.fill('Reproduced on Safari 17.4 — picking this up.');
  await pageA.getByRole('button', { name: 'Comment', exact: true }).click();
  await pageA.getByText('Reproduced on Safari 17.4 — picking this up.').waitFor({ timeout: 15000 });

  await pageA.getByRole('button', { name: 'Edit comment' }).first().click();
  const editArea = pageA.getByLabel('Edit comment');
  await editArea.fill('Reproduced on Safari 17.4 — fix in progress.');
  await pageA.getByRole('button', { name: 'Save', exact: true }).click();
  await pageA.getByText('Reproduced on Safari 17.4 — fix in progress.').waitFor({ timeout: 15000 });
  await pageA.getByText('edited', { exact: true }).first().waitFor();

  await pageA.getByRole('button', { name: 'Delete comment' }).last().click();
  await pageA.getByRole('dialog').getByRole('button', { name: 'Delete comment' }).click();
  await pageA.getByText(/no comments yet/i).waitFor({ timeout: 15000 });
});

await step('9. Upload and remove a screenshot attachment', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC',
    'base64',
  );
  fs.writeFileSync('/tmp/e2e/screenshot.png', png);
  await pageA.getByLabel('Upload attachments').setInputFiles('/tmp/e2e/screenshot.png');
  await pageA.getByRole('img', { name: 'screenshot.png' }).waitFor({ timeout: 20000 });
  await pageA.screenshot({ path: `${SHOTS}/05-attachments-and-comments.png` });

  await pageA.getByRole('button', { name: 'Delete screenshot.png' }).click();
  await pageA.getByRole('dialog').getByRole('button', { name: 'Delete attachment' }).click();
  await pageA.getByText(/no attachments/i).waitFor({ timeout: 15000 });
});

await step('10. Search and filter on the issue list (URL state)', async () => {
  await pageA.getByRole('link', { name: 'Issues', exact: true }).click();
  await pageA.getByRole('table').waitFor();
  await pageA.getByLabel('Search issues').fill('safari');
  await pageA.waitForURL(/search=safari/, { timeout: 15000 });
  await pageA.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="result-count"]');
      return el && /1 issue match/.test(el.textContent ?? '');
    },
    undefined,
    { timeout: 15000 },
  );
  await pageA.getByRole('button', { name: /^Filters/ }).click();
  await pageA.getByLabel('Priority').selectOption('critical');
  await pageA.waitForURL(/priority=critical/, { timeout: 15000 });
  await pageA.screenshot({ path: `${SHOTS}/06-issue-list-filters.png` });
  await pageA.getByRole('button', { name: /clear filters/i }).first().click();
  await pageA.waitForURL((url) => !url.search.includes('search='), { timeout: 15000 });
  await pageA.getByRole('cell', { name: /Checkout button/i }).waitFor();
});

await step('11. Team member sees the project in their sidebar', async () => {
  await pageB.goto(`${WEB}/projects`, { waitUntil: 'domcontentloaded' });
  await pageB.getByRole('link', { name: new RegExp(PROJECT_NAME) }).first().click();
  await pageB.waitForURL(/\/projects\/[0-9a-f]{24}\/board/);
  await pageB.getByTestId('kanban-column-todo').getByText('Checkout button does nothing on Safari').waitFor({ timeout: 15000 });
});

await step('12. Drag a card between Kanban columns and persist it', async () => {
  await pageA.getByRole('link', { name: 'Board', exact: true }).click();
  const card = pageA.getByTestId('kanban-column-todo').getByTestId(/issue-card-/).filter({ hasText: 'Checkout button does nothing on Safari' }).first();
  await card.waitFor();
  const source = await card.boundingBox();
  const target = await pageA.getByTestId('kanban-column-in-progress').boundingBox();
  const grip = await card.getByRole('button', { name: /Drag E/ }).boundingBox();
  await pageA.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await pageA.mouse.down();
  await pageA.mouse.move(grip.x + grip.width / 2 + 20, grip.y + grip.height / 2 + 20, { steps: 8 });
  await pageA.mouse.move(target.x + target.width / 2, target.y + 140, { steps: 20 });
  await pageA.mouse.up();

  await pageA.getByTestId('kanban-column-in-progress').getByText('Checkout button does nothing on Safari').waitFor({ timeout: 15000 });
  await pageA.screenshot({ path: `${SHOTS}/07-kanban-after-drag.png` });

  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.getByTestId('kanban-column-in-progress').getByText('Checkout button does nothing on Safari').waitFor({ timeout: 20000 });
});

await step('13. Real-time: member board updates without a manual refresh', async () => {
  await pageB.getByTestId('kanban-column-in-progress').getByText('Checkout button does nothing on Safari').waitFor({ timeout: 20000 });
});

await step('14. Real-time: member sees a new comment instantly', async () => {
  await pageA.getByTestId('kanban-column-in-progress').getByText('Checkout button does nothing on Safari').click();
  await pageA.waitForURL(/\/issues\/[0-9a-f]{24}$/);
  await pageA.getByLabel('Add a comment').fill('Ship it once QA signs off.');
  await pageA.getByRole('button', { name: 'Comment', exact: true }).click();
  await pageA.getByText('Ship it once QA signs off.').waitFor();

  await pageB.getByTestId('kanban-column-in-progress').getByText('Checkout button does nothing on Safari').click();
  await pageB.getByText('Ship it once QA signs off.').waitFor({ timeout: 15000 });
});

await step('15. Outsider cannot access the project', async () => {
  await register(pageC, { name: 'E2E Outsider', email: outsiderEmail });
  await pageC.setViewportSize({ width: 1280, height: 860 });
  await pageC.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
  await pageC.getByText(/project unavailable/i).waitFor({ timeout: 15000 });
  const sidebar = await pageC.getByRole('navigation', { name: 'Main navigation' }).innerText();
  if (sidebar.includes(PROJECT_NAME)) throw new Error('outsider can see the project in navigation');
  const issueApi = await pageC.evaluate(async (id) => {
    const res = await fetch(`/api/projects/${id}/issues`, { credentials: 'include' });
    return res.status;
  }, projectId);
  if (issueApi !== 403) throw new Error(`expected API 403 for outsider, got ${issueApi}`);
});

await step('16. Mobile layout: drawer navigation works at 390px', async () => {
  await pageC.setViewportSize({ width: 390, height: 844 });
  await pageC.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
  await pageC.getByRole('heading', { name: /good to see you/i }).waitFor();
  await pageC.screenshot({ path: `${SHOTS}/08-mobile-dashboard.png` });
  await pageC.getByRole('button', { name: 'Open navigation menu' }).click();
  await pageC.getByRole('navigation', { name: 'Main navigation' }).waitFor();
  await pageC.getByRole('button', { name: 'Close navigation' }).waitFor();
  await pageC.getByRole('link', { name: 'Projects', exact: true }).click();
  await pageC.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
  const drawerVisible = await pageC.getByRole('button', { name: 'Close navigation' }).isVisible().catch(() => false);
  if (drawerVisible) throw new Error('mobile drawer stayed open after navigation');
});

await step('17. Logout returns to the login screen', async () => {
  await pageA.getByRole('button', { name: /open account menu/i }).click();
  await pageA.getByRole('menuitem', { name: 'Sign out' }).click();
  await pageA.waitForURL(`${WEB}/login`, { timeout: 15000 });
  await pageA.getByRole('heading', { name: /sign in to issuetrack/i }).waitFor();
});

await step('18. Redirect back to the requested page after re-login', async () => {
  await pageA.goto(`${WEB}/projects/${projectId}/issues`, { waitUntil: 'domcontentloaded' });
  await pageA.waitForURL(/\/login/, { timeout: 15000 });
  await signIn(pageA, ownerEmail);
  await pageA.waitForURL(new RegExp(`/projects/${projectId}/issues`), { timeout: 15000 });
  await pageA.getByRole('table').waitFor({ timeout: 15000 });
});

} catch (error) {
  await dumpDiagnostics(pageA ?? pageB);
  await browser.close();
  log('\nJOURNEY ABORTED:', error.message);
  process.exit(1);
}

await browser.close();

const failed = results.filter((r) => !r.ok);
log('\n————— E2E summary —————');
log(`${results.length - failed.length}/${results.length} steps passed`);
if (errors.length) {
  log('\nBrowser console/page errors:');
  [...new Set(errors)].slice(0, 20).forEach((e) => log(' •', e));
}
fs.writeFileSync(
  new URL('./results.json', import.meta.url).pathname,
  JSON.stringify({ results, errors, projectId }, null, 2),
);
process.exit(failed.length ? 1 : 0);
