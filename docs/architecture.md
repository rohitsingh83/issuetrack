# IssueTrack — architecture

```
┌──────────────────────────── browser ────────────────────────────┐
│  React 18 + TypeScript (Vite)                                   │
│  React Router · TanStack Query · RHF + Zod · Tailwind · dnd-kit │
│  Axios (cookie session) · Socket.io client · Sonner · Lucide    │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ HTTPS /api (cookies)        │ wss /socket.io
┌───────────────▼─────────────────────────────▼───────────────────┐
│  Express 4 + TypeScript                                         │
│  helmet · cors · rate-limit · compression · cookie-parser       │
│  routes → controllers → services → models (mongoose)            │
│  middleware: auth · projectAccess · validate (zod) · upload     │
│  realtime: Socket.io rooms per project + per user               │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ mongoose                    │ multer (disk)
        ┌───────▼────────┐            ┌───────▼────────┐
        │  MongoDB 7     │            │  uploads/      │
        │  (local/Atlas) │            │  (volume)      │
        └────────────────┘            └────────────────┘
```

## Layering (server)

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Config | `src/config/env.ts` | Zod-validated environment (`dotenv`). Fails fast on a bad/missing variable. |
| Constants | `src/constants/domain.ts` | Single source of truth for enums (`ISSUE_STATUSES`, `PROJECT_ROLES`, role ranking, badge metadata). |
| Models | `src/models/*` | Mongoose schemas, indexes, virtuals, `toJSON` transforms (no `passwordHash` escape hatch). |
| Validators | `src/validators/*` | Zod schemas for bodies, params and query strings. |
| Middleware | `src/middleware/*` | `requireAuth` / `optionalAuth`, `validate`, `loadProject` / `loadIssue`, `upload`, `errorHandler`. |
| Policies | `src/policies/permissions.ts` | Pure functions: role + resource + user → boolean. Used by controllers *and* mirrored in the client (`canEditIssue`, `canDeleteIssue`) so the UI hides what the API rejects. |
| Services | `src/services/*` | All business logic and persistence; the only place that touches Mongoose queries, activity logging and realtime emits. |
| Serializers | `src/serializers/*` | Model → DTO. Guarantees no `passwordHash`, `__v`, or internal fields leave the API. |
| Controllers | `src/controllers/*` | Thin HTTP adapters: read validated input, call a service, send the envelope. |
| Routes | `src/routes/*` | Wiring + middleware order (auth → validation → resource loader → handler). |
| Realtime | `src/realtime/*` | `setSocketServer`/`emitToProject`/`emitToUser` + the authenticated socket bootstrap. |

### Request lifecycle

```
request
  → helmet / cors / compression / json / cookie-parser / morgan
  → /api rate limiter
  → requireAuth (verify JWT from cookie or Bearer → attach req.user)
  → validate({ params, query, body })       (zod, 400 + field details)
  → loadProject('member') / loadIssue()     (resource + membership + role)
  → controller → service → model
  → realtime emit (project room / user room)
  → serializer → { success, data, meta }
  → errorHandler (centralized; sanitised messages, no stacks)
```

## Project isolation — the security spine

* `loadProject(minRole)` loads the project, resolves the caller's role
  (`owner` ⇒ implicit, otherwise the `members` entry), and **404s unknown projects, 403s non-members**
  before any handler runs. Nothing outside the membership can be read or mutated.
* `loadIssue()` does the same for issues by resolving the issue's project first.
* Issue-level rules live in `policies/permissions.ts`: `viewer` is read-only, `member` may create issues and
  edit/delete the ones they reported or are assigned to, `admin`/`owner` may manage everything, only the
  `owner` deletes the project or changes member roles of other admins.
* Socket rooms are joined from the same membership query, so realtime payloads cannot leak across projects.

## Data model

```
User      { name, email(unique, lowercase), passwordHash, avatarUrl, timestamps }
Project   { name, key(unique, uppercase), description, owner→User,
            members[{ user→User, role, addedAt }], issueCounter, timestamps }
Issue     { project→Project, issueNumber, issueKey(unique), title, description,
            type, priority, status, priorityRank, reporter→User, assignee→User?,
            labels[], dueDate?, attachments[{ _id, filename, originalName,
            mimeType, size, uploadedBy→User, createdAt }], timestamps }
Comment   { issue→Issue, author→User, content, editedAt?, timestamps }
Activity  { project→Project, issue→Issue?, actor→User, action, message,
            field?, from?, to?, timestamps }
```

Indexes: `Project.key` unique; `Issue.issueKey` unique, `Issue { project, status }`, `{ project, updatedAt }`,
`{ project, assignee }`, text-ish search via regex on title/issueKey; `Comment { issue, createdAt }`;
`Activity { project, createdAt }`, `{ issue, createdAt }`.

`issueNumber` comes from an atomic `$inc` on `Project.issueCounter`, so `WEB-12` is allocated once even
under concurrent requests; the unique `issueKey` index is the backstop.

## Auth & session flow

1. `POST /api/auth/register|login` → bcrypt compare (cost 12) → sign JWT (`sub`, `email`, `name`) →
   `Set-Cookie: it_token=…; HttpOnly; SameSite=Lax|None; Secure(prod); Path=/; Max-Age=7d`.
2. Every request: cookie (or `Authorization: Bearer`) → `verifyAuthToken` → `req.user`.
3. The SPA bootstraps with `GET /api/auth/me`; a 401 renders the public routes, 200 renders the app shell.
4. `logout` clears the cookie; the client clears the TanStack cache so no stale data survives a user switch.

## Client architecture

```
main.tsx
 └ ErrorBoundary → QueryClientProvider → BrowserRouter → AuthProvider → RealtimeProvider → App
     ├ ProtectedRoute / PublicOnlyRoute (auth gate + redirect back to `from`)
     └ AppLayout (sidebar, project switcher, header, mobile drawer)
         └ ProjectLayout (breadcrumbs + project tabs, provides ProjectContext role/permissions)
```

* **Server state**: TanStack Query only — no Redux. `queryKeys.ts` centralises key shapes so a single
  `invalidateQueries` in the realtime provider refreshes boards, lists, detail views and dashboard.
* **Forms**: React Hook Form + `zodResolver` with schemas in `lib/schemas.ts` that mirror the server
  validators, so users see the same messages before a request is made (server remains authoritative).
* **API layer**: `lib/api.ts` — one Axios instance (`withCredentials`), typed `request<T>` helper that unwraps
  `{ success, data }`, converts failures into `ApiError` (status/code/details) and surfaces friendly toasts.
* **URL state**: filters, sort, page and search live in the query string (`lib/filterParams.ts`), so any view
  is shareable and survives reload/back-forward.
* **Optimistic updates**: Kanban drag & drop moves the card immediately (with rollback on error), and
  comment create/edit/delete patch the cache before the server confirms.
* **Accessibility**: semantic landmarks, `aria-label`led icon buttons, labelled form controls from one
  `FormField` component, focus-visible rings, keyboard-operable dialogs (Esc + focus trap), dnd-kit
  keyboard sensor with a fallback status select on every card so drag & drop is never the only path,
  and status/priority badges that pair an icon with text (never colour alone).

## Realtime strategy

* One socket per signed-in browser, authenticated with the session cookie.
* Server joins `project:<id>` rooms for every project the user belongs to (`user:<id>` for personal events).
* Each mutation emits the serialised entity; the client invalidates the affected query keys rather than
  patching structures it cannot see (works for lists, boards, dashboards, activity and comments alike).
* Reconnection is automatic (8 attempts, 1.5 s delay) and a connection indicator (`Live` / `Offline`) sits in
  the sidebar footer.

## File uploads

* `multer` disk storage, random 16-hex filenames, extension preserved for content sniffing.
* MIME allow-list (PNG/JPEG/WEBP/GIF/PDF), 5 MB per file (`MAX_UPLOAD_MB`), max 5 files per request.
* Downloads do not rely on cookies: `serializeAttachment` embeds a 15-minute signed token, so
  `<img src>` works across origins without weakening the session.
* Deleting an issue/attachment/project removes the files from disk (`safeUnlink`, path-traversal guarded).

## Testing strategy

| Suite | Tool | Covers |
| ----- | ---- | ------ |
| `server/tests` | Jest + Supertest + mongodb-memory-free (real test database `issuetrack_test`) | auth (register/login/invalid/tampered token/rate-limit-safe), project roles, member management, issue CRUD + filters/search/sort/pagination, status transitions, comments & attachments permissions, activity log |
| `client/src/**/__tests__` | Vitest + React Testing Library (jsdom) | login validation, protected-route behaviour, create-issue validation, Kanban status change (optimistic + rollback), hook error handling, loading/empty/error UI states |
| `e2e/journey.mjs` | Playwright (optional) | the full 18-step user journey in a real browser, including two-session realtime and mobile layout |

The API tests boot `createApp()` against a real MongoDB (no in-memory binary download), truncating
collections between specs, so behaviour matches production for indexes, `$inc`, aggregation and text search.
