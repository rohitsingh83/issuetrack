# IssueTrack API reference

Base URL (local): `http://localhost:4000/api`
Machine-readable spec: [`openapi.yaml`](./openapi.yaml)

---

## Conventions

### Success envelope

```json
{
  "success": true,
  "data": { },
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNextPage": true, "hasPrevPage": false } }
}
```

`meta` is only present on paginated list endpoints (`/projects/:projectId/issues`, `/issues`).

### Error envelope

```json
{
  "success": false,
  "error": {
    "message": "You do not have access to this project",
    "code": "FORBIDDEN",
    "details": { "title": ["Title must be at least 3 characters"] }
  }
}
```

`details` (field → messages) is only returned for validation failures. Status codes used:

| Status | Meaning |
| ------ | ------- |
| 200 | OK (read/update/delete) |
| 201 | Created |
| 400 | Validation error (`VALIDATION_ERROR`), malformed id (`INVALID_ID`), bad state (`BAD_REQUEST`) |
| 401 | Missing/expired session (`UNAUTHORIZED`), bad credentials (`INVALID_CREDENTIALS`) |
| 403 | Authenticated but not allowed (`FORBIDDEN`) |
| 404 | Not found (`NOT_FOUND`) |
| 409 | Duplicate key/email (`DUPLICATE_KEY`) |
| 413 | Upload too large (`PAYLOAD_TOO_LARGE`) |
| 429 | Rate limited (`RATE_LIMITED`) |
| 500 | Unexpected error — message is always generic, stack traces are never sent |

### Authentication

* Browser clients: `POST /api/auth/login` sets an **httpOnly** cookie (`it_token`, `SameSite=Lax` by default, `Secure` in production). Send it with every request (`withCredentials: true`).
* Non-browser clients: pass `Authorization: Bearer <token>` (the same JWT).
* The JWT payload contains `sub` (user id), `email`, `name`; it is signed with `JWT_SECRET` and expires after `JWT_EXPIRES_IN` (default `7d`).

### Rate limits

* `/api/auth/register`, `/api/auth/login`: `AUTH_RATE_LIMIT_MAX` requests per `AUTH_RATE_LIMIT_WINDOW_MINUTES` per IP (default 30 / 15 min).
* Everything under `/api`: `API_RATE_LIMIT_MAX` per window (default 2000 / 15 min).

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/register` | – | Create an account, signs the user in (201) |
| POST | `/login` | – | Sign in (200) |
| POST | `/logout` | – | Clears the auth cookie (200) |
| GET | `/me` | ✔ | Current user |

**POST /register**

```json
{ "name": "Avery Chen", "email": "avery@example.com", "password": "Password123!" }
```

Rules: name 2–80 chars, valid email (normalised to lowercase), password 8–72 chars with at least one letter and one digit.

```json
{
  "success": true,
  "data": {
    "user": { "id": "652f…", "name": "Avery Chen", "email": "avery@example.com", "avatarUrl": null },
    "token": "eyJhbGciOi…"
  }
}
```

**GET /me** → `{ "success": true, "data": { "user": { … } } }`

---

## Users — `/api/users`

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/me` | ✔ | Profile of the signed-in user |
| PATCH | `/me` | ✔ | Update `name` / `avatarUrl`, or change password with `currentPassword` + `newPassword` |
| GET | `/lookup?email=…` | ✔ | Exact email lookup used by "add member" → `{ user }` (`user: null` when unknown) |
| GET | `/search?q=…` | ✔ | `{ users: [...] }` — up to 8 users matching name/email (min 2 chars) |

Passwords are stored as bcrypt hashes and are **never** returned by any endpoint.

---

## Projects — `/api/projects`

| Method | Path | Min role | Description |
| ------ | ---- | -------- | ----------- |
| GET | `/` | member of ≥1 | Projects the caller belongs to (owner + members), newest first |
| POST | `/` | any authenticated | Create a project — caller becomes owner |
| GET | `/:projectId` | viewer | Project with members |
| PATCH | `/:projectId` | admin | Rename / edit description (key is immutable) |
| DELETE | `/:projectId` | **owner** | Deletes the project, its issues, comments, activity and uploaded files |
| GET | `/:projectId/stats` | viewer | Status/priority/type counts, member count, overdue count |
| GET | `/:projectId/activity` | viewer | Project audit log (`?limit`, default 30, max 100) |
| GET | `/:projectId/labels` | viewer | Distinct labels used in the project |

**POST /projects**

```json
{ "name": "Nebula Web App", "key": "WEB", "description": "Customer-facing app" }
```

`key`: 2–10 chars, `A–Z0–9`, must start with a letter, globally unique, stored uppercase (409 `DUPLICATE_KEY` otherwise).

**Project object**

```json
{
  "id": "652f…",
  "name": "Nebula Web App",
  "key": "WEB",
  "description": "Customer-facing app",
  "owner": { "id": "…", "name": "Avery Chen", "email": "…", "avatarUrl": null },
  "members": [
    { "id": "…", "name": "Priya Nair", "email": "…", "avatarUrl": null, "role": "member", "addedAt": "2026-11-01T09:00:00.000Z" }
  ],
  "memberCount": 4,
  "role": "owner",
  "createdAt": "2026-11-01T09:00:00.000Z",
  "updatedAt": "2026-11-02T10:12:00.000Z"
}
```

`role` is the caller's own role and only appears on responses that are scoped to the caller.

### Members — `/api/projects/:projectId/members`

| Method | Path | Min role | Description |
| ------ | ---- | -------- | ----------- |
| GET | `/` | viewer | `{ owner, members, canManage }` |
| POST | `/` | admin | Add a **registered** user by email (`{ "email": "…", "role": "member" }`) |
| PATCH | `/:userId` | admin | Change a member's role (`owner` \| `admin` \| `member` \| `viewer`) |
| DELETE | `/:userId` | admin (self-removal allowed) | Remove a member; the owner cannot be removed |

Rules enforced server-side: only admins/owners manage members; nobody can change the **owner's** role; promoting yourself is rejected (`400 BAD_REQUEST`); demoting yourself is rejected; non-admin attempted role change → `403`.

---

## Issues — `/api/projects/:projectId/issues` and `/api/issues`

| Method | Path | Min role / rule | Description |
| ------ | ---- | --------------- | ----------- |
| GET | `/api/projects/:projectId/issues` | viewer | Paginated, filterable, sortable list |
| GET | `/api/projects/:projectId/issues/board` | viewer | All issues of a project grouped by status (Kanban) |
| POST | `/api/projects/:projectId/issues` | member | Create an issue (auto `issueKey`, e.g. `WEB-12`) |
| GET | `/api/issues` | member of ≥1 | Cross-project explorer (same filters + `project` filter) |
| GET | `/api/issues/:issueId` | viewer | Single issue with attachments |
| PATCH | `/api/issues/:issueId` | reporter/assignee or admin | Update any issue field (per-field activity entries) |
| PATCH | `/api/issues/:issueId/status` | reporter/assignee or admin | Change status (used by Kanban drag & drop) |
| PATCH | `/api/issues/:issueId/assignee` | reporter/assignee or admin | Assign (`{ "assignee": "<userId>" }`) or unassign (`null`) |
| DELETE | `/api/issues/:issueId` | reporter or admin/owner | Delete the issue and its comments/attachments |

**Create body**

```json
{
  "title": "Checkout button does nothing on Safari",
  "description": "Repro: Safari 17, autofill enabled…",
  "type": "bug",
  "priority": "critical",
  "status": "todo",
  "assignee": "652f…",          // optional, must be a project member
  "labels": ["checkout", "safari"],
  "dueDate": "2026-12-01"       // optional, ISO date or datetime
}
```

Rules: title 3–200, description ≤ 20 000, `type` ∈ `bug|task|story`, `priority` ∈ `low|medium|high|critical`, `status` ∈ `todo|in-progress|done`, max 10 labels (1–30 chars each), assignee must belong to the project.

**List query parameters** (all optional):

| Param | Values | Notes |
| ----- | ------ | ----- |
| `search` | free text | Matches title, description, `issueKey` and labels |
| `status` | `todo,in-progress,done` (repeatable or CSV) | |
| `priority` | `low,medium,high,critical` | |
| `type` | `bug,task,story` | |
| `assignee` | user id, `unassigned`, `me` | |
| `reporter` | user id, `me` | |
| `label` | label name (repeatable) | |
| `project` | project id | `/api/issues` only |
| `dueDateFrom` / `dueDateTo` | ISO date | Inclusive range |
| `sort` | `newest` (default), `oldest`, `priority`, `dueDate`, `recentlyUpdated` | |
| `page` / `limit` | 1-based page, 1–100 (default 20) | |

**Issue object**

```json
{
  "id": "652f…",
  "projectId": "652e…",
  "projectKey": "WEB",
  "issueNumber": 12,
  "issueKey": "WEB-12",
  "title": "…",
  "description": "…",
  "type": "bug",
  "priority": "critical",
  "status": "in-progress",
  "reporter": { "id": "…", "name": "Avery Chen", "email": "…", "avatarUrl": null },
  "assignee": { "id": "…", "name": "Marcus Webb", "email": "…", "avatarUrl": null },
  "labels": ["checkout"],
  "dueDate": "2026-12-01T00:00:00.000Z",
  "attachments": [
    {
      "id": "…",
      "originalName": "screenshot.png",
      "mimeType": "image/png",
      "size": 48123,
      "url": "/api/issues/652f…/attachments/653a…?token=eyJ…",
      "uploadedBy": { "id": "…", "name": "…", "email": "…", "avatarUrl": null },
      "createdAt": "…"
    }
  ],
  "commentCount": 3,
  "createdAt": "…",
  "updatedAt": "…"
}
```

`issueNumber` is allocated atomically per project (`Project.issueCounter` via `$inc`), so concurrent creates never collide.

---

## Comments — `/api/issues/:issueId/comments`

| Method | Path | Rule |
| ------ | ---- | ---- |
| GET | `/` | Any project member (viewer included) |
| POST | `/` | `member` or above — `{ "content": "…" }` (1–5000 chars) |
| PATCH | `/:commentId` | Author only |
| DELETE | `/:commentId` | Author, or project admin/owner |

Comments carry `edited` / `editedAt` once updated. Every change writes an activity entry.

---

## Attachments — `/api/issues/:issueId/attachments`

| Method | Path | Rule |
| ------ | ---- | ---- |
| POST | `/` | `member` or above; `multipart/form-data`, field name `files` (max 5 per request) |
| DELETE | `/:attachmentId` | Uploader, reporter/assignee, or admin/owner |
| GET | `/:attachmentId?token=…` | **Not cookie-gated** — requires a short-lived signed file token (15 min) that is embedded in `attachment.url` |

Limits: `MAX_UPLOAD_MB` per file (default 5 MB) and 5 files per request; MIME allow-list is **PNG, JPEG, WEBP, GIF, PDF** (`400 INVALID_FILE_TYPE` otherwise). Files are stored with random names, the original name is preserved only in the database, and every download URL carries a 15-minute signed token.

---

## Activity / audit log — `/api/issues/:issueId/activity`

`GET /` → array of entries, newest first:

```json
{
  "id": "…",
  "action": "issue.status.changed",
  "message": "Avery Chen moved WEB-12 to In Progress",
  "field": "status",
  "from": "todo",
  "to": "in-progress",
  "actor": { "id": "…", "name": "Avery Chen", "email": "…", "avatarUrl": null },
  "issueId": "652f…",
  "createdAt": "…"
}
```

Recorded actions: `project.created`, `project.updated`, `project.member.added`, `project.member.role_changed`, `project.member.removed`, `issue.created`, `issue.updated`, `issue.status.changed`, `issue.assigned`, `issue.unassigned`, `issue.priority.changed`, `issue.deleted`, `comment.added`, `comment.updated`, `comment.deleted`, `attachment.added`, `attachment.deleted`.

---

## Dashboard — `/api/dashboard`

Single aggregated call used by the dashboard page:

```json
{
  "success": true,
  "data": {
    "projects": [ /* Project objects the caller belongs to, newest activity first */ ],
    "stats": {
      "projectCount": 2,
      "totalIssues": 40,
      "openIssues": 18,
      "doneIssues": 22,
      "assignedToMe": 4,
      "reportedByMe": 9,
      "overdue": 1,
      "byStatus": { "todo": 9, "in-progress": 9, "done": 22 },
      "byPriority": { "low": 8, "medium": 12, "high": 14, "critical": 6 }
    },
    "myIssues": [ /* up to 6 open issues assigned to the caller, highest priority first */ ],
    "recentActivity": [ /* 12 latest audit entries across the caller's projects */ ]
  }
}
```

---

## Health

`GET /api/health` → `{ "success": true, "data": { "status": "ok", "uptime": 12.34 } }` (used by Docker/Render health checks).

---

## Socket.io

Same origin, path `/socket.io`, authenticated with the `it_token` cookie (or `auth.token`). Every authenticated socket joins:

* `user:<userId>` (personal room),
* one room per project the user owns or belongs to (`project:<projectId>`).

Client → server: `join:project(projectId)`, `leave:project(projectId)`.

Server → client events (payload always includes the serialised entity plus `projectId` where relevant):

| Event | When |
| ----- | ---- |
| `connected` | After handshake — `{ userId, projectIds }` |
| `issue:created` | Issue created |
| `issue:updated` | Issue edited, assigned, status or priority changed |
| `issue:deleted` | Issue deleted — `{ issueId, issueKey, projectId }` |
| `issue:list-changed` | Member removed → lists must refresh |
| `comment:created` / `comment:updated` / `comment:deleted` | Comment lifecycle |
| `attachment:added` / `attachment:deleted` | Uploads |
| `project:created` / `project:updated` / `project:deleted` | Project lifecycle |
| `project:members.updated` | Member added/removed/role changed |
| `activity:created` | New audit entry (drives live activity timelines) |

Rooms are only joined for projects the socket's user is a member of, so realtime data never crosses project boundaries.
