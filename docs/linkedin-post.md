# LinkedIn post (draft)

Attach `docs/demo/issuetrack-walkthrough.webm` (convert to MP4 first if LinkedIn rejects WebM — e.g. upload it to
https://cloudconvert.com/webm-to-mp4 or open it in Clipchamp, which ships with Windows 11, and export as MP4).

---

🐛 I built **IssueTrack** — a Jira-style bug & issue tracker on the MERN stack.

Teams can create projects, report bugs as tickets, assign them to teammates, drag them across a Kanban board
(To Do → In Progress → Done), discuss them in comment threads, and search/filter across everything.

What's inside:
✅ React + TypeScript + Tailwind CSS, dnd-kit drag-and-drop, TanStack Query
✅ Node.js + Express REST API with MongoDB (Mongoose)
✅ JWT auth (bcrypt) in httpOnly cookies + Google sign-in via Clerk, verified server-side
✅ Role-based access — Owner, Admin, Member, Viewer — enforced in the API, not just the UI
✅ Comments, activity history, screenshot attachments, URL-shareable filters
✅ Helmet, CORS allow-list, rate limiting, Zod validation on every request
✅ 84 automated tests (Jest + Supertest, Vitest + Testing Library)
✅ Deployed on Vercel with MongoDB Atlas

🔗 Live demo: https://issuetrack-eight.vercel.app (one-click demo accounts on the sign-in page)
💻 Code: https://github.com/rohitsingh83/issuetrack

Biggest lessons: designing permission checks that hold up against direct API calls, keeping optimistic
drag-and-drop in sync with the server, and making a serverless deployment seed its demo data safely when
several instances cold-start at once.

#MERN #ReactJS #NodeJS #MongoDB #WebDevelopment #FullStack #JavaScript #TypeScript
