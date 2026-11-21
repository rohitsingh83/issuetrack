import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Captures the documentation screenshots from the seeded demo dataset.
// Usage: node screenshots.mjs   (API + web dev servers and seeded DB required)
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const OUT = process.env.SHOTS_DIR ?? new URL('../docs/screenshots', import.meta.url).pathname;
const BOARD_SHOT = path.join(OUT, '04-kanban-board.png');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const tallShot = async (name, height = 1500) => {
  await page.setViewportSize({ width: 1440, height });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name) });
  await page.setViewportSize({ width: 1440, height: 900 });
  console.log('📸', name);
};

const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('📸', name);
};

await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: /sign in to issuetrack/i }).waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, '01-login.png') });
console.log('📸 01-login.png');

await page.getByLabel('Email address').fill('owner@demo.dev');
await page.getByLabel('Password', { exact: false }).first().fill('Password123!');
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.getByRole('heading', { name: /good to see you/i }).waitFor();
await page.waitForTimeout(1200);
await tallShot('02-dashboard.png');

await page.goto(`${WEB}/projects`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
await shot('03-projects.png');

// Pick the richest demo project (WEB) straight from the API
const projects = await page.evaluate(async () => {
  const res = await fetch('/api/projects', { credentials: 'include' });
  return (await res.json()).data;
});
const demo = projects.find((p) => p.key === 'WEB') ?? projects[0];
const projectId = demo.id;

// Project board
await page.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
await page.getByTestId(/issue-card-/).first().waitFor({ timeout: 20000 });
await shot('04-kanban-board.png');

// Issues list with filters + search
await page.goto(`${WEB}/projects/${projectId}/issues?status=todo,in-progress&priority=high,critical&sort=priority&search=a`, {
  waitUntil: 'domcontentloaded',
});
await page.getByRole('table').waitFor();
await shot('05-issue-list-filters.png');

// All issues explorer
await page.goto(`${WEB}/issues`, { waitUntil: 'domcontentloaded' });
await page.getByRole('table').waitFor();
await shot('06-all-issues.png');

// Issue detail (open the WEB-1 card from the board)
await page.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('kanban-column-todo').waitFor();
const card = page.getByTestId(/issue-card-/).filter({ hasText: 'Login form fails on Safari' }).first();
const hasCard = (await card.count()) > 0;
const target = hasCard ? card : page.getByTestId(/issue-card-/).first();
const issueLink = target.getByRole('link').last();
await issueLink.click();
await page.getByRole('heading', { level: 1 }).waitFor();
await page.getByRole('button', { name: 'Edit issue' }).waitFor();
await shot('07-issue-detail.png');

// Add a comment + attachment so the collaboration section has content
await page.keyboard.press('Escape');
const COMMENT_TEXT =
  'Confirmed on Safari 17.2: the order request never leaves the browser, so the button handler is not firing at all.';
const already = await page.getByText(COMMENT_TEXT, { exact: false }).count();
const commentBox = page.getByLabel('Add a comment');
if (already === 0 && (await commentBox.count()) > 0) {
  await commentBox.fill(COMMENT_TEXT);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await page.waitForTimeout(1500);
}
const existingAttachment = await page.getByText('04-kanban-board.png', { exact: false }).count();
const fileInput = page.locator('input[type="file"]').first();
if (existingAttachment === 0 && (await fileInput.count()) > 0) {
  await fileInput.setInputFiles(BOARD_SHOT);
  await page.waitForTimeout(2000);
}
await page.keyboard.press('Escape');
await page.getByText(COMMENT_TEXT, { exact: false }).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1000);
await tallShot('08-comments-attachments.png', 1700);

// Drag a card between columns
await page.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
await page.getByTestId(/issue-card-/).first().waitFor({ timeout: 20000 });
const statuses = ['todo', 'in-progress', 'done'];
const counts = {};
for (const st of statuses) {
  counts[st] = await page.getByTestId(`kanban-column-${st}`).getByTestId(/issue-card-/).count();
}
console.log('column counts', counts);
const from = statuses.find((st) => counts[st] > 0);
const to = statuses.find((st) => st !== from);
const dragCard = page.getByTestId(`kanban-column-${from}`).getByTestId(/issue-card-/).first();
const draggedTestId = await dragCard.getAttribute('data-testid');
const draggedIssueId = draggedTestId.replace('issue-card-', '');
const grip = await dragCard.getByRole('button', { name: /Drag / }).first().boundingBox();
const column = await page.getByTestId(`kanban-column-${to}`).boundingBox();
await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
await page.mouse.down();
await page.mouse.move(grip.x + grip.width / 2 + 30, grip.y + grip.height / 2 + 30, { steps: 6 });
await page.mouse.move(column.x + column.width / 2, column.y + 160, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '09-kanban-drag.png') });
console.log('📸 09-kanban-drag.png');

// Restore the dragged card so the demo dataset stays pristine
await page.evaluate(
  async ({ id, status }) => {
    await fetch(`/api/issues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
  },
  { id: draggedIssueId, status: from },
);
console.log('↩️  restored', draggedIssueId, 'to', from);

// Project settings
await page.goto(`${WEB}/projects/${projectId}/settings`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'General' }).waitFor();
await page.waitForTimeout(900);
await tallShot('10-project-settings.png', 1600);

// Mobile dashboard + board
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
await mobile.getByRole('heading', { name: /good to see you/i }).waitFor();
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: path.join(OUT, '11-mobile-dashboard.png') });
console.log('📸 11-mobile-dashboard.png');
await mobile.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
await mobile.getByTestId('kanban-column-todo').waitFor();
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: path.join(OUT, '12-mobile-board.png') });
console.log('📸 12-mobile-board.png');

await browser.close();
console.log('done', projectId);
