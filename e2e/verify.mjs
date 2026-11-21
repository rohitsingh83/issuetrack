/**
 * Extended browser verification — roles, permissions, project settings, profile,
 * pagination/sorting, keyboard drag & drop and mobile creation.
 *
 * Usage (API + web dev servers running):
 *   WEB_URL=http://localhost:5173 node verify.mjs
 */
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const PASSWORD = 'Password123!';
const ts = Date.now();
const results = [];
const problems = [];

const log = (...args) => console.log(...args);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    log(`✅ ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    log(`❌ ${name} → ${error.message}`);
  }
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function newPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[pageerror ${page.url()}] ${e.message}`));
  return page;
}

/** Registers a user through the API in a throwaway session, returns the DTO + id. */
async function createAccount(name, email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.request.post(`${WEB}/api/auth/register`, {
    data: { name, email, password: PASSWORD },
  });
  assert(res.status() === 201, `register ${email} failed: ${res.status()} ${await res.text()}`);
  const user = (await res.json()).data.user;
  await ctx.close();
  return user;
}

async function api(page, method, url, data) {
  const res = await page.request.fetch(`${WEB}/api${url}`, {
    method,
    data,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

/** Signs in, or just returns home when the session is already authenticated. */
async function signIn(page, email) {
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  const emailField = page.getByLabel('Email address');
  const alreadyIn = await emailField
    .waitFor({ timeout: 4000 })
    .then(() => false)
    .catch(() => true);
  if (alreadyIn) {
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  } else {
    await emailField.fill(email);
    await page.getByLabel('Password', { exact: false }).first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await page.getByRole('heading', { name: /good to see you/i }).waitFor({ timeout: 20000 });
}

/** Reads the dnd-kit live region text (used to debug keyboard drags). */
const liveAnnouncements = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[aria-live]')]
      .map((node) => (node.textContent ?? '').trim())
      .filter((text) => text && text !== 'Live'),
  );

/** Polls the API until `predicate(body)` is true (UI writes are optimistic). */
async function waitForApi(page, url, predicate, label) {
  const deadline = Date.now() + 12000;
  let last;
  while (Date.now() < deadline) {
    const res = await api(page, 'GET', url);
    last = res.body?.data;
    if (predicate(last)) return last;
    await page.waitForTimeout(400);
  }
  throw new Error(
    `${label} — last payload: ${JSON.stringify(last)?.slice(0, 240)}`,
  );
}

const ownerPage = await newPage();
const adminPage = await newPage();
const memberPage = await newPage();
const viewerPage = await newPage();

const ownerEmail = `v.owner.${ts}@test.dev`;
const adminEmail = `v.admin.${ts}@test.dev`;
const memberEmail = `v.member.${ts}@test.dev`;
const viewerEmail = `v.viewer.${ts}@test.dev`;
const PROJECT_KEY = `V${String(ts).slice(-6)}`;

let projectId;
let ownerIssue;
let memberIssue;
let ownerUser;
let adminUser;
let memberUser;
let viewerUser;

await step('0. Seed users, project, members and two issues through the API', async () => {
  ownerUser = await createAccount('Verify Owner', ownerEmail);
  adminUser = await createAccount('Verify Admin', adminEmail);
  memberUser = await createAccount('Verify Member', memberEmail);
  viewerUser = await createAccount('Verify Viewer', viewerEmail);

  await signIn(ownerPage, ownerEmail);
  const projectRes = await api(ownerPage, 'POST', '/projects', {
    name: `Verify Project ${String(ts).slice(-4)}`,
    key: PROJECT_KEY,
    description: 'Extended verification project',
  });
  assert(projectRes.status === 201, `project create failed: ${JSON.stringify(projectRes.body)}`);
  projectId = (projectRes.body.data.project ?? projectRes.body.data).id;

  for (const [email, role] of [
    [adminEmail, 'admin'],
    [memberEmail, 'member'],
    [viewerEmail, 'viewer'],
  ]) {
    const res = await api(ownerPage, 'POST', `/projects/${projectId}/members`, { email, role });
    assert(res.status === 201, `add member ${email} failed: ${res.status}`);
  }

  const issueA = await api(ownerPage, 'POST', `/projects/${projectId}/issues`, {
    title: 'Owner reported issue for permission checks',
    description: 'Only the reporter or an admin may delete this issue.',
    type: 'bug',
    priority: 'high',
    labels: ['permissions'],
  });
  assert(issueA.status === 201, 'issue A create failed');
  ownerIssue = issueA.body.data.issue ?? issueA.body.data;

  await signIn(memberPage, memberEmail);
  const issueB = await api(memberPage, 'POST', `/projects/${projectId}/issues`, {
    title: 'Member reported issue that its reporter may delete',
    type: 'task',
    priority: 'low',
  });
  assert(issueB.status === 201, 'issue B create failed (member must be signed in separately)');
  memberIssue = issueB.body.data.issue ?? issueB.body.data;
});

await step('1. Viewer is read-only in the UI and blocked by the API', async () => {
  await signIn(viewerPage, viewerEmail);
  await viewerPage.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
  await viewerPage.getByTestId(/issue-card-/).first().waitFor({ timeout: 20000 });

  assert(
    (await viewerPage.getByRole('button', { name: 'New issue' }).count()) === 0,
    'viewer sees a New issue button',
  );
  assert(
    (await viewerPage.getByRole('button', { name: /^Drag /, disabled: false }).count()) === 0,
    'viewer cards expose an enabled drag handle',
  );

  const patch = await api(viewerPage, 'PATCH', `/issues/${ownerIssue.id}/status`, {
    status: 'in-progress',
  });
  assert(patch.status === 403, `expected 403 for viewer status change, got ${patch.status}`);

  const create = await api(viewerPage, 'POST', `/projects/${projectId}/issues`, {
    title: 'Viewer should not be able to create this',
  });
  assert(create.status === 403, `expected 403 for viewer create, got ${create.status}`);

  await viewerPage.goto(`${WEB}/projects/${projectId}/issues/${ownerIssue.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await viewerPage.getByRole('heading', { name: ownerIssue.title }).waitFor({ timeout: 20000 });
  assert(
    (await viewerPage.getByRole('button', { name: 'Edit issue' }).count()) === 0,
    'viewer sees Edit issue',
  );
  assert(
    (await viewerPage.locator('#detail-status').count()) === 0,
    'viewer gets an editable status control',
  );
});

await step('2. Member creates/edits own issues, cannot delete another reporter’s issue', async () => {
  await signIn(memberPage, memberEmail);
  await memberPage.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
  await memberPage.getByTestId(/issue-card-/).first().waitFor({ timeout: 20000 });

  await memberPage.getByRole('button', { name: 'New issue' }).first().click();
  const dialog = memberPage.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel('Title').fill('Member created issue from the board');
  await dialog.getByLabel('Description').fill('Created through the modal in the extended run.');
  await dialog.getByRole('button', { name: 'Create issue' }).click();
  await memberPage.getByText('Member created issue from the board').first().waitFor({ timeout: 15000 });

  const deleteOther = await api(memberPage, 'DELETE', `/issues/${ownerIssue.id}`);
  assert(
    deleteOther.status === 403,
    `expected 403 deleting another reporter's issue, got ${deleteOther.status}`,
  );

  const deleteOwn = await api(memberPage, 'DELETE', `/issues/${memberIssue.id}`);
  assert(deleteOwn.status === 200, `expected 200 deleting own issue, got ${deleteOwn.status}`);

  const addMember = await api(memberPage, 'POST', `/projects/${projectId}/members`, {
    email: 'nobody@test.dev',
    role: 'member',
  });
  assert(addMember.status === 403, `expected 403 adding members as a member, got ${addMember.status}`);
});

await step('3. Admin manages members: add by email, change role, remove', async () => {
  const extraEmail = `v.extra.${ts}@test.dev`;
  const extraUser = await createAccount('Verify Extra', extraEmail);

  await signIn(adminPage, adminEmail);
  await adminPage.goto(`${WEB}/projects/${projectId}/settings`, { waitUntil: 'domcontentloaded' });
  await adminPage.getByRole('heading', { name: 'Team members' }).waitFor({ timeout: 20000 });

  await adminPage.getByLabel('Add member by email').fill(extraEmail);
  await adminPage.getByRole('button', { name: 'Add', exact: true }).click();
  await adminPage.getByText(extraEmail).first().waitFor({ timeout: 15000 });

  const demote = await api(adminPage, 'PATCH', `/projects/${projectId}/members/${extraUser.id}`, {
    role: 'viewer',
  });
  assert(demote.status === 200, `expected 200 changing a member role, got ${demote.status}`);

  const remove = await api(adminPage, 'DELETE', `/projects/${projectId}/members/${extraUser.id}`);
  assert(remove.status === 200, `expected 200 removing a member, got ${remove.status}`);

  const removeOwner = await api(adminPage, 'DELETE', `/projects/${projectId}/members/${ownerUser.id}`);
  assert(
    removeOwner.status === 400 || removeOwner.status === 403,
    `owner must not be removable (got ${removeOwner.status})`,
  );

  const selfPromote = await api(adminPage, 'PATCH', `/projects/${projectId}/members/${adminUser.id}`, {
    role: 'owner',
  });
  assert(selfPromote.status === 400, `promoting yourself must fail (got ${selfPromote.status})`);
});

await step('4. Owner renames the project; the key stays immutable', async () => {
  await ownerPage.goto(`${WEB}/projects/${projectId}/settings`, { waitUntil: 'domcontentloaded' });
  await ownerPage.getByRole('heading', { name: 'General' }).waitFor({ timeout: 20000 });

  const newName = `Renamed Verify ${String(ts).slice(-4)}`;
  await ownerPage.getByLabel('Project name').fill(newName);
  await ownerPage.getByRole('button', { name: /save/i }).first().click();
  await ownerPage.getByText('Project updated').first().waitFor({ timeout: 15000 });
  await ownerPage.getByRole('heading', { name: newName }).first().waitFor({ timeout: 15000 });
  assert(await ownerPage.getByLabel('Project key').isDisabled(), 'project key must not be editable');
});

await step('5. Profile: rename the account and change the password', async () => {
  const newPassword = 'NewPassword456!';
  await ownerPage.goto(`${WEB}/profile`, { waitUntil: 'domcontentloaded' });
  await ownerPage.getByRole('heading', { name: 'Profile' }).first().waitFor({ timeout: 20000 });

  await ownerPage.getByLabel('Full name').fill('Verify Owner Renamed');
  await ownerPage.getByRole('button', { name: 'Save profile' }).click();
  await ownerPage.getByText('Profile updated').first().waitFor({ timeout: 15000 });

  await ownerPage.getByLabel('Current password').fill(PASSWORD);
  await ownerPage.locator('#new-password').fill(newPassword);
  await ownerPage.locator('#confirm-password').fill(newPassword);
  await ownerPage.getByRole('button', { name: 'Update password' }).click();
  await ownerPage.getByText('Password changed').first().waitFor({ timeout: 15000 });

  const oldLogin = await ownerPage.request.post(`${WEB}/api/auth/login`, {
    data: { email: ownerEmail, password: PASSWORD },
  });
  assert(oldLogin.status() === 401, `old password still works (${oldLogin.status()})`);
  const newLogin = await ownerPage.request.post(`${WEB}/api/auth/login`, {
    data: { email: ownerEmail, password: newPassword },
  });
  assert(newLogin.status() === 200, `new password rejected (${newLogin.status()})`);

  const restore = await ownerPage.request.patch(`${WEB}/api/users/me`, {
    data: { currentPassword: newPassword, newPassword: PASSWORD },
  });
  assert(restore.status() === 200, `password restore failed: ${restore.status()}`);
});

await step('6. Pagination, label filter, search and URL state survive a reload', async () => {
  for (let i = 0; i < 23; i += 1) {
    const res = await api(ownerPage, 'POST', `/projects/${projectId}/issues`, {
      title: `Bulk verification issue ${String(i + 1).padStart(2, '0')}`,
      priority: ['low', 'medium', 'high', 'critical'][i % 4],
      type: ['bug', 'task', 'story'][i % 3],
      labels: [i % 2 === 0 ? 'bulk-even' : 'bulk-odd'],
    });
    assert(res.status === 201, `bulk issue ${i} failed: ${res.status}`);
  }

  const total = (await api(ownerPage, 'GET', `/projects/${projectId}/issues?limit=1`)).body.meta.pagination
    .total;
  assert(total >= 25, `expected at least 25 issues, found ${total}`);

  await ownerPage.goto(`${WEB}/projects/${projectId}/issues?sort=priority&page=1`, {
    waitUntil: 'domcontentloaded',
  });
  await ownerPage.getByRole('table').waitFor({ timeout: 20000 });
  const summary = await ownerPage.getByTestId('pagination-summary').innerText();
  assert(
    summary.replace(/\s+/g, ' ').includes(`1–20 of ${total}`),
    `unexpected pagination summary: ${summary}`,
  );

  await ownerPage.getByRole('button', { name: 'Next page' }).click();
  await ownerPage.waitForURL(/page=2/, { timeout: 15000 });
  await ownerPage.waitForFunction(
    (expected) =>
      (document.querySelector('[data-testid="pagination-summary"]')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .includes(expected),
    `21–${total} of ${total}`,
    { timeout: 15000 },
  );

  await ownerPage.reload({ waitUntil: 'domcontentloaded' });
  await ownerPage.getByRole('table').waitFor({ timeout: 20000 });
  assert(/page=2/.test(ownerPage.url()), 'page param lost after reload');

  const evenTotal = (
    await api(ownerPage, 'GET', `/projects/${projectId}/issues?label=bulk-even&limit=1`)
  ).body.meta.pagination.total;
  await ownerPage.goto(`${WEB}/projects/${projectId}/issues?label=bulk-even&sort=oldest`, {
    waitUntil: 'domcontentloaded',
  });
  await ownerPage.getByRole('table').waitFor({ timeout: 20000 });
  const labelSummary = await ownerPage.getByTestId('pagination-summary').innerText();
  assert(
    labelSummary.replace(/\s+/g, ' ').includes(`of ${evenTotal}`),
    `label filter wrong: ${labelSummary}`,
  );

  await ownerPage.goto(`${WEB}/projects/${projectId}/issues?search=Bulk%20verification%20issue%2001`, {
    waitUntil: 'domcontentloaded',
  });
  await ownerPage.getByRole('table').waitFor({ timeout: 20000 });
  const rows = await ownerPage.getByRole('table').getByRole('row').count();
  assert(rows === 2, `expected a header row + 1 result, got ${rows}`);
});

await step('7. Keyboard drag moves a card; the per-card status menu works as fallback', async () => {
  await ownerPage.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
  await ownerPage.getByTestId(/issue-card-/).first().waitFor({ timeout: 20000 });

  const card = ownerPage.getByTestId('kanban-column-todo').getByTestId(/issue-card-/).first();
  const issueId = (await card.getAttribute('data-testid')).replace('issue-card-', '');
  await card.getByRole('button', { name: /^Drag / }).focus();
  await ownerPage.keyboard.press('Space');
  await ownerPage.waitForTimeout(350);
  log('   dnd after Space:', JSON.stringify(await liveAnnouncements(ownerPage)));
  await ownerPage.keyboard.press('ArrowRight');
  await ownerPage.waitForTimeout(450);
  log('   dnd after ArrowRight:', JSON.stringify(await liveAnnouncements(ownerPage)));
  await ownerPage.keyboard.press('Space');
  await ownerPage.waitForTimeout(300);

  await waitForApi(
    ownerPage,
    `/issues/${issueId}`,
    (data) => data?.status === 'in-progress',
    'keyboard drag did not persist a status change',
  );

  const other = ownerPage.getByTestId('kanban-column-todo').getByTestId(/issue-card-/).first();
  const otherId = (await other.getAttribute('data-testid')).replace('issue-card-', '');
  await other.getByRole('button', { name: /Open actions/ }).click();
  await ownerPage.getByRole('menuitem', { name: 'Move to Done' }).click();

  await waitForApi(
    ownerPage,
    `/issues/${otherId}`,
    (data) => data?.status === 'done',
    'card menu status change did not persist',
  );
});

await step('8. Issue detail: assign, unassign and reject unsupported attachments', async () => {
  await ownerPage.goto(`${WEB}/projects/${projectId}/issues/${ownerIssue.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await ownerPage.getByRole('heading', { name: ownerIssue.title }).waitFor({ timeout: 20000 });

  await ownerPage.getByLabel('Assignee').selectOption({ label: memberUser.name });
  await waitForApi(
    ownerPage,
    `/issues/${ownerIssue.id}`,
    (data) => data?.assignee?.id === memberUser.id,
    'assignee change did not persist',
  );

  await ownerPage.getByLabel('Assignee').selectOption({ label: 'Unassigned' });
  await waitForApi(
    ownerPage,
    `/issues/${ownerIssue.id}`,
    (data) => data?.assignee === null,
    'unassign did not persist',
  );

  const before = (await api(ownerPage, 'GET', `/issues/${ownerIssue.id}`)).body.data.attachments;
  const input = ownerPage.locator('input[type="file"]').first();
  if ((await input.count()) > 0) {
    await input.setInputFiles({
      name: 'verification.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('unsupported type'),
    });
    await ownerPage.waitForTimeout(1500);
    const after = (await api(ownerPage, 'GET', `/issues/${ownerIssue.id}`)).body.data.attachments;
    assert(after.length === before.length, 'an unsupported file type was accepted');
  }
});

await step('9. Comments: author edits, admin deletes, other members are blocked', async () => {
  const commentRes = await api(ownerPage, 'POST', `/issues/${ownerIssue.id}/comments`, {
    content: 'Owner comment used for permission checks.',
  });
  assert(commentRes.status === 201, 'comment create failed');
  const commentId = (commentRes.body.data.comment ?? commentRes.body.data).id;

  const memberEdit = await api(memberPage, 'PATCH', `/issues/${ownerIssue.id}/comments/${commentId}`, {
    content: 'member must not be able to edit this',
  });
  assert(memberEdit.status === 403, `expected 403 editing another author’s comment, got ${memberEdit.status}`);

  const memberDelete = await api(memberPage, 'DELETE', `/issues/${ownerIssue.id}/comments/${commentId}`);
  assert(memberDelete.status === 403, `expected 403 deleting another author’s comment, got ${memberDelete.status}`);

  const ownerEdit = await api(ownerPage, 'PATCH', `/issues/${ownerIssue.id}/comments/${commentId}`, {
    content: 'Owner comment edited for permission checks.',
  });
  assert(ownerEdit.status === 200, `expected 200 editing own comment, got ${ownerEdit.status}`);

  const adminDelete = await api(adminPage, 'DELETE', `/issues/${ownerIssue.id}/comments/${commentId}`);
  assert(adminDelete.status === 200, `expected admin to delete any comment, got ${adminDelete.status}`);
});

await step('10. Owner deletes a project; it disappears for everyone', async () => {
  const tempKey = `T${String(ts).slice(-5)}`;
  const created = await api(ownerPage, 'POST', '/projects', { name: `Temp ${tempKey}`, key: tempKey });
  assert(created.status === 201, 'temp project create failed');
  const tempId = (created.body.data.project ?? created.body.data).id;

  await ownerPage.goto(`${WEB}/projects/${tempId}/settings`, { waitUntil: 'domcontentloaded' });
  await ownerPage.getByRole('heading', { name: 'Danger zone' }).waitFor({ timeout: 20000 });
  await ownerPage.getByRole('button', { name: 'Delete project' }).first().click();
  const dialog = ownerPage.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Delete project' }).click();
  await ownerPage.waitForURL(/\/projects$/, { timeout: 20000 });

  const gone = await api(ownerPage, 'GET', `/projects/${tempId}`);
  assert(gone.status === 404, `deleted project still readable (${gone.status})`);
});

await step('11. 404 route renders; wrong credentials surface an error', async () => {
  await memberPage.goto(`${WEB}/this/route/does/not/exist`, { waitUntil: 'domcontentloaded' });
  await memberPage.getByText('Page not found').first().waitFor({ timeout: 15000 });

  const ctx = await browser.newContext();
  const loginPage = await ctx.newPage();
  await loginPage.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await loginPage.getByLabel('Email address').fill(memberEmail);
  await loginPage.getByLabel('Password', { exact: false }).first().fill('WrongPassword1!');
  await loginPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await loginPage.getByText(/invalid email or password/i).first().waitFor({ timeout: 15000 });
  await ctx.close();
});

await step('12. Mobile (390px): create an issue from the board', async () => {
  const mobile = await newPage({ width: 390, height: 844 });
  await signIn(mobile, ownerEmail);
  await mobile.goto(`${WEB}/projects/${projectId}/board`, { waitUntil: 'domcontentloaded' });
  await mobile.getByTestId(/issue-card-/).first().waitFor({ timeout: 20000 });

  const headerButton = mobile.getByRole('button', { name: 'New issue' });
  if ((await headerButton.count()) > 0 && (await headerButton.first().isVisible())) {
    await headerButton.first().click();
  } else {
    await mobile.getByRole('button', { name: 'Create issue in To Do' }).click();
  }
  const dialog = mobile.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel('Title').fill('Mobile created issue at 390px');
  await dialog.getByRole('button', { name: 'Create issue' }).click();
  await mobile.getByText('Mobile created issue at 390px').first().waitFor({ timeout: 15000 });
  await mobile.context().close();
});

await browser.close();

const failed = results.filter((r) => !r.ok);
log('\n————— Extended verification —————');
log(`${results.length - failed.length}/${results.length} steps passed`);
if (problems.length) {
  log('\nPage errors:');
  [...new Set(problems)].slice(0, 10).forEach((p) => log(' •', p));
}
process.exit(failed.length ? 1 : 0);
