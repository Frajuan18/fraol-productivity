# Two-User Collaboration — Architecture & Migration Plan

Status: **Draft for review — no code changes made.** Local JSON data (`storage/data.json`) is untouched.

This document is the approved-direction plan for adding a two-user collaboration system
(profiles, partner stats, shared plans, synchronized focus sessions, real-time chat,
webcam photos) on top of the existing dark, Apple-inspired productivity app.

---

## 1. Why local JSON storage cannot scale to collaboration

Current state (verified in this repo):

- `storage/data.json` is the single source of truth, read/written server-side in
  `app/api/data/route.ts` (GET/POST/DELETE) with atomic temp-file rename + `data.json.bak` fallback.
- The client pulls the **entire** `AppData` blob via `GET /api/data` into `useStorage`
  (debounced 400 ms auto-save via `POST /api/data`). `AppData = { plans, sessions, stats, user }`.
- `lib/plans/store.ts`, `lib/plans/files.ts`, `lib/plans/planFileApi.ts` implement plan CRUD,
  file constraints (25 MB, `pdf|doc|docx|txt`, PDF magic + page count), and client upload helpers.

Concrete blockers for two users:

| Limitation | Why it blocks collaboration |
| --- | --- |
| Single-user file | Two clients overwrite each other's writes — last-write-wins destroys the partner's data. |
| Full-blob read/write | No row-level updates; every save rewrites everything (race conditions, wasted bandwidth). |
| No identity | No way to know *who* is writing; cannot attribute plans/sessions/messages to a user. |
| No concurrency control | Debounced full-document saves make optimistic locking impossible. |
| No push channel | Presence, typing indicators, shared timers, and live chat require a realtime layer. |
| No query layer | "Give me my partner's last 30 days of stats" would require parsing JSON in memory. |
| No ACL | Anything that can reach `/api/data` can read and write everything. |

The JSON store is not thrown away — it becomes the **local-first seed** for the migration
(Phase C) and the **offline/cache layer** (Phase F).

---

## 2. Target architecture

```
 Browser A (User 1)                Browser B (User 2)
   │  UI components                  │  UI components
   │  (features/dashboard,           │  (features/dashboard,
   │   plans, sessions, chat)        │   plans, sessions, chat)
   ▼                                 ▼
 ┌───────────────────────────────┐  ┌───────────────────────────────┐
 │  Repository layer            │  │  Repository layer              │
 │  ProductivityRepository      │  │  ProductivityRepository        │
 │  (single interface the UI     │  │  (same interface)              │
 │   is allowed to talk to)      │  │                                │
 └───────────┬───────────────────┘  └───────────┬───────────────────┘
             │ REST / HTTP                     │ REST / HTTP
             ▼                                 ▼
      ┌─────────────────────────────────────────────┐
      │  Next.js Route Handlers (server)            │
      │  /api/... → repository adapter → Supabase   │
      │  (service-role key NEVER in the browser)    │
      └──────────────────────┬──────────────────────┘
                             ▼
      ┌─────────────────────────────────────────────┐
      │  Supabase                                          │
      │  • PostgreSQL (rows: profiles, plans, messages…)   │
      │  • Auth (email/OAuth → JWT, user identity)         │
      │  • Realtime (presence, chat, shared-timer events)  │
      │  • Storage (plan files, webcam photos)             │
      │  • Row Level Security (RLS) — per-user/partner ACL │
      └─────────────────────────────────────────────┘
                             │ (async, best-effort archive)
                             ▼
      ┌─────────────────────────────────────────────┐
      │  Google Drive (optional, long-term archive) │
      │  • Monthly chat + webcam-photo exports      │
      │  • NEVER used for live features             │
      └─────────────────────────────────────────────┘
```

- **Auth**: Supabase Auth (email/password first; OAuth later). JWT is sent with every request.
- **API boundary**: React components call only the repository abstraction, never Supabase directly.
  The browser holds the anon key; the server holds the service-role key for privileged operations
  (migration, archive).
- **Realtime**: Supabase Realtime channels (per conversation, per shared-focus room, per partnership).
- **Caching/offline**: a local cache (existing JSON file, later IndexedDB) mirrors the user's own rows;
  repository decides read-through-cache vs network.

---

## 3. Why Supabase (vs Firebase, Appwrite, or a custom backend)

| Concern | Supabase (chosen) | Firebase | Appwrite | Custom Node/Express |
| --- | --- | --- | --- | --- |
| Data model | Real PostgreSQL — tables, FKs, constraints, indexes | Firestore document store | PostgreSQL (works, but smaller ecosystem) | Full control, full burden |
| Auth | Supabase Auth (JWTs, built-in) | Firebase Auth (excellent) | Appwrite Auth | Build it yourself |
| Realtime | WebSocket channels via Postgres `LISTEN/NOTIFY` | Firestore realtime listeners | Realtime API | Build it yourself |
| RLS / row security | Native Postgres RLS — industry standard | Custom security rules | Document-level permissions | Hand-rolled middleware |
| Sync focus timer | Server timestamp + Postgres rows (authoritative) | Client timestamps (drift-prone) | Server time | Manual |
| Files/media | Supabase Storage (S3-backed) | Firebase Storage | Appwrite Storage | Manual S3 |
| Migrations | SQL migrations committed to repo | No SQL concept | SQL migrations | SQL migrations |
| Next.js integration | `@supabase/ssr` official, first-class | `firebase/auth` works, heavier | Community SDK | N/A |

**Decision**: Supabase. It gives real relational SQL + RLS + realtime in one managed stack with
official Next.js support, matching the app's need for server-authoritative shared timers and
partner-scoped data access. Firebase's document model and client-timestamp realtime model are a
poor fit for "one shared plan row with two members" and "server-authoritative `ends_at`".
Drive is kept **only** as an optional long-term archive (Section 11), never for live features.

---

## 4. Migration diagram

```
 storage/data.json (source of truth, NEVER deleted)
        │  1. snapshot + checksum
        ▼
 storage/backups/data-before-cloud-migration.json   (exact copy + metadata)
        │  2. validate structure (reuse isValidAppData)
        ▼
 Migration runner (server-side script, service role)
   - users:      single local profile  → 1 auth user + 1 profiles row
   - plans:      plans[]               → plans + plan_members + plan_activity
   - sessions:   sessions[]            → focus_sessions
   - stats:      stats, user           → daily_statistics (derived from focus_sessions)
   - files:      storage/uploads/plans/<id>/ → Supabase Storage (copy bytes, map paths)
        │  idempotent: upsert by stable key; skip rows that already exist
        ▼
 migrations table row inserted:
   migrationName: "local-json-to-supabase", version: 1,
   completedAt, sourceChecksum, rowCounts {users, plans, sessions, ...}
        │
        ▼
 Human-readable report (written to storage/backups/migration-report.json):
   "Users migrated: 1, Plans migrated: 12, Sessions migrated: 34,
    Files migrated: 3, Errors: 0"
        │
        ▼
 App runs in "cloud" mode (Phase D/E) with local JSON kept as read-only cache.
```

Rules (from spec, confirmed):
1. Create `storage/backups/` before anything runs.
2. Copy `data.json` → `data-before-cloud-migration.json` **first**, then run.
3. Every migrated row keeps its original `id` and all original timestamps where the schema
   allows (UUIDs for new DB ids; keep original `id` as a `legacy_id` column for audit).
4. Idempotent: re-running produces no duplicates (upsert on unique/legacy keys).
5. Never delete `storage/data.json` — it remains the offline/cache source and rollback artifact.
6. A `migration_version` record is required; if the checksum matches a prior successful run,
   abort with "already migrated".

---

## 5. Proposed database schema (PostgreSQL)

Naming: `snake_case`, UUID primary keys, `timestamptz` timestamps, soft-deletes where noted.

### profiles
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | = `auth.users.id` |
| display_name | text | from legacy `user.name` |
| email | text | from auth |
| avatar_url | text null | |
| status | text | `online\|offline\|focusing` (presence) |
| last_seen_at | timestamptz | |
| legacy_user_name | text null | pre-migration name |
| created_at / updated_at | timestamptz | |

### plans  (shared — one row, no per-user copies)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| title | text | |
| description | text | preserves `Sessions:` block convention |
| type | text | `weekly\|daily\|custom` (legacy enum) |
| status | text | `active\|completed\|paused` |
| date | date | |
| priority | text | `high\|medium\|low` |
| category | text | e.g. `Study` |
| owner_id | uuid FK → profiles | creator |
| file_id | uuid null FK → plan_files | optional uploaded file |
| legacy_id | int null | original `plans[].id` |
| created_at / updated_at | timestamptz | |

### plan_files
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| plan_id | uuid FK → plans | |
| original_name | text | |
| storage_path | text | Supabase Storage path |
| mime_type | text | |
| size | bigint | ≤ 25 MB enforced |
| page_count | int null | |
| uploaded_by | uuid FK → profiles | |
| created_at | timestamptz | |

### plan_members
| column | type | notes |
| --- | --- | --- |
| plan_id | uuid FK → plans | composite PK |
| user_id | uuid FK → profiles | composite PK |
| role | text | `owner\|member` |
| joined_at | timestamptz | |

### plan_activity
| column | type | notes |
| --- | --- | --- |
| id | bigint identity PK | |
| plan_id | uuid FK → plans | |
| user_id | uuid FK → profiles | |
| action | text | `created\|status_changed\|file_added\|member_added\|commented` |
| payload | jsonb | |
| created_at | timestamptz | |

### focus_sessions  (legacy + cloud sessions)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| task | text | legacy `session.task` |
| duration | text | legacy `HHh MMm` string (kept for compat) |
| duration_minutes | int | derived for stats |
| date | date | legacy `YYYY-MM-DD` |
| status | text | `completed\|cancelled` |
| shared_session_id | uuid null FK → shared_focus_sessions | |
| legacy_id | int null | |
| created_at | timestamptz | |

### daily_statistics  (cached/denormalized stats)
| column | type | notes |
| --- | --- | --- |
| user_id | uuid FK → profiles | composite PK with date |
| date | date | |
| focus_minutes | int | |
| sessions_completed | int | |
| plans_completed | int | |
| updated_at | timestamptz | |

### partnerships
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| user_a_id | uuid FK → profiles | normalized: `user_a_id < user_b_id` |
| user_b_id | uuid FK → profiles | |
| status | text | `pending\|active\|paused\|ended` |
| created_at / updated_at | timestamptz | |
| UNIQUE (user_a_id, user_b_id) | | prevents duplicate pairings |

### partner_privacy_settings
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| share_weekly_stats | boolean default true | |
| share_streak | boolean default true | |
| share_plans | boolean default true | |
| share_live_focus | boolean default true | |
| share_location | boolean default false | reserved; default off |
| updated_at | timestamptz | |

### shared_focus_sessions
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| partnership_id | uuid FK → partnerships | |
| status | text | `pending\|running\|paused\|ended` |
| duration_minutes | int | planned length |
| started_at | timestamptz | server-set |
| paused_at | timestamptz null | |
| total_paused_ms | bigint | accumulated pauses |
| ends_at | timestamptz | server-authoritative: `started_at + duration` |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |

### shared_focus_participants
| column | type | notes |
| --- | --- | --- |
| session_id | uuid FK → shared_focus_sessions | composite PK |
| user_id | uuid FK → profiles | composite PK |
| joined_at | timestamptz | |
| ended_at | timestamptz null | |
| completed | boolean | |

### conversations
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| partnership_id | uuid FK → partnerships | |
| type | text | `partner_dm` (one per partnership) |
| created_at | timestamptz | |
| UNIQUE (partnership_id) | | one DM per partnership |

### messages
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| conversation_id | uuid FK → conversations | |
| sender_id | uuid FK → profiles | |
| type | text | `text\|image\|plan_reference\|focus_session_reference\|system` |
| body | text null | text payload |
| media_path | text null | Supabase Storage path for `image` |
| media_mime / media_size | text / bigint null | |
| plan_id / shared_session_id | uuid null | for reference types |
| reply_to_id | uuid null | |
| read_at | timestamptz null | read receipt |
| created_at | timestamptz | |
| INDEX (conversation_id, created_at) | | chat pagination |
| INDEX (conversation_id, read_at) | | unread counts |

### chat_presence / typing (ephemeral — not a table)
- Realtime broadcast channel payloads only; never persisted.

### drive_archives  (bookkeeping for the optional Drive export)
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| conversation_id | uuid FK → conversations | |
| period | text | `YYYY-MM` |
| drive_file_id | text | Google Drive file id |
| message_count | int | |
| source_checksum | text | dedupe |
| archived_at | timestamptz | |

### migration_version
| column | type | notes |
| --- | --- | --- |
| id | int PK | version |
| migration_name | text | `local-json-to-supabase` |
| source_checksum | text | sha256 of `data.json` |
| completed_at | timestamptz | |
| row_counts | jsonb | users/plans/sessions/files migrated |

---

## 6. Row Level Security (RLS) strategy

Principle: **deny by default**; grant only to `auth.uid()` (the signed-in user) and the partner
where the partnership is `active`.

| table | policy | scope |
| --- | --- | --- |
| profiles | SELECT own row + partner's row (via active partnership) | read |
| profiles | UPDATE own row only | write |
| plans | SELECT if member of `plan_members`; UPDATE/DELETE if owner | read/write |
| plan_files | SELECT if member of the plan; INSERT if member | read/write |
| plan_members | SELECT if own membership; INSERT if inviting own partner | read/write |
| plan_activity | SELECT if member of plan; INSERT if member | read/write |
| focus_sessions | SELECT/INSERT/DELETE own rows only | read/write |
| daily_statistics | SELECT own + partner's (respecting `partner_privacy_settings.share_weekly_stats`) | read |
| partnerships | SELECT where user is A or B; UPDATE own side's status | read/write |
| partner_privacy_settings | SELECT own + partner's (partner must be able to know what's shared) | read |
| shared_focus_sessions | SELECT if participant; UPDATE if participant | read/write |
| shared_focus_participants | SELECT/INSERT if participant of the session | read/write |
| conversations | SELECT/INSERT if member of the partnership | read/write |
| messages | SELECT/INSERT if member of conversation; UPDATE `read_at` own-sender only | read/write |
| drive_archives | SELECT own partnership's archives | read |

Implementation notes:
- RLS helper function `is_partner_of(current_uid, other_uid)`:
  checks `partnerships` for `status = 'active'` and membership in either column.
- Service role bypasses RLS (used only by the migration runner and the Drive archiver).
- Privacy gating for partner stats lives in the RLS predicate via
  `partner_privacy_settings` — e.g., if `share_weekly_stats` is false, the partner's
  `daily_statistics` rows are not visible at all.
- The browser's anon key + JWT is the only identity the DB trusts.

---

## 7. Partner stats flow

```
 User A opens "Partner" panel
   → GET /api/partner/stats?for=<userB>
   → server resolves B's privacy settings (RLS)
   → if share_weekly_stats = false  → 403/empty (UI shows "hidden by partner")
   → if true → SELECT daily_statistics WHERE user_id=B AND date >= week_start
   → aggregate: focus_minutes, sessions_completed, streak, week-over-week change
   → return { stats, shared: { weekly:true, streak:true, liveFocus:true }, lastSeen }
```

- Aggregation reuses the existing logic in `src/utils/statistics.ts`
  (`calculateSuccessRate`, `focusMinutesThisWeek`, `calculateWeeklyChange`, `calculateStreak`)
  but runs **server-side** against Postgres rows for the partner's data.
- Streak is computed from `focus_sessions` (same algorithm), not from a stored counter.
- The partner sees only what `partner_privacy_settings` permits; changing a setting is
  immediately effective because RLS enforces it on every query.
- Presence (`online|focusing`) comes from Realtime presence, **not** from Drive (see Section 11).

---

## 8. Shared plan model

- Plans are stored **once**; ownership/membership is the join table `plan_members`.
- `owner_id` = creator; a second member is invited via the partnership:
  - `POST /api/plans/:id/members { userEmail }` → only a member may invite; only an `active`
    partner can be added.
- UI visibility: `plans` list query = `SELECT plans JOIN plan_members WHERE user_id = auth.uid()`.
- Status changes broadcast to members via the plan's realtime channel so both dashboards update live.
- File sharing reuses the existing upload constraints (25 MB, `pdf|doc|docx|txt`) in
  `lib/plans/files.ts`; bytes go to Supabase Storage, `plan_files.storage_path` holds the path.
- `plan_activity` gives a lightweight "who did what" audit for both members.
- Live cursor/selection presence (optional) rides the plan channel as ephemeral broadcasts.

---

## 9. Shared focus session design (server-authoritative timer)

Two users join one `shared_focus_sessions` row. The **server** is the source of truth for time.

```
 A starts shared focus (duration_minutes = 25)
   → POST /api/shared-focus   (server sets started_at = now(), ends_at = now() + 25m)
   → INSERT shared_focus_participants (A)
   → realtime broadcast to partnership channel: { type:'focus_started', sessionId, ends_at }

 B accepts/joins
   → POST /api/shared-focus/:id/join  → INSERT participant (B), broadcast focus_joined

 Both clients render countdown:
   remaining = ends_at - (serverNowFetched via NTP-ish /api/time on start) - elapsed
   // re-sync each second via realtime heartbeat event that carries authoritative ends_at
   // client never trusts its own clock for the countdown endpoint

 Pause (either user, co-required or any-user per design decision)
   → POST /api/shared-focus/:id/pause → server sets paused_at, accumulates total_paused_ms
   → ends_at extended by the pause; broadcast new ends_at

 Completion
   → POST /api/shared-focus/:id/complete → status='ended', participants.completed=true
   → INSERT focus_sessions per user (duration = actual) → stats update
   → broadcast focus_completed
```

- Timer arithmetic always uses the server timestamp: `ends_at`, `paused_at`, `total_paused_ms`.
- Clients show a countdown derived from `ends_at - serverNow`, re-synced via channel heartbeats,
  so both screens stay within ~1 s of each other.
- Both `shared_focus_participants` rows feed `daily_statistics` independently.
- If a user disconnects, their row stays; the session continues for the partner (or auto-pauses
  per a later decision — flagged as an open choice).

---

## 10. Chat architecture

- One DM conversation per partnership (`conversations` row created on partnership activation).
- **Send**: `POST /api/conversations/:id/messages`
  - validates membership + message type; `INSERT messages`; then push via realtime channel
    `chat:{conversationId}` so the partner receives it instantly.
- **Receive**: client subscribes to `chat:{conversationId}`; row insertions flow over WebSocket.
  Initial load = `SELECT ... WHERE created_at < cursor ORDER BY created_at DESC LIMIT 50` (pagination).
- **Types**: `text`, `image` (webcam/upload → Supabase Storage, message holds `media_path`),
  `plan_reference` (links a plan; click opens plan in both UIs), `focus_session_reference`,
  `system` (e.g. "A completed a shared focus session").
- **Typing indicators**: ephemeral broadcast on `chat:{conversationId}` channel payload
  `{ type:'typing', userId, at }`. Never persisted, never touches Drive.
- **Read receipts**: `messages.read_at` set by `POST /api/conversations/:id/read` on scroll;
  unread badge derives from `COUNT(*) WHERE read_at IS NULL AND sender_id != me`.
- **History/archive**: long-term copy flows to Drive monthly (Section 11); the DB keeps recent
  history, and `drive_archives` records where older months live.
- **Attachment rules**: reuse 25 MB cap; images restricted to `image/*`; PNG/JPEG from webcam.

---

## 11. Google Drive archive design (long-term only)

Drive is **never** used for typing, presence, partner status, shared timers, or live delivery.
It is a best-effort, async archive and export layer.

Layout:

```
Productivity Collaboration/
  conversations/<conversation-id>/
    2026-07.md          (monthly text transcript + metadata)
    2026-07-images/     (webcam/media for that month)
    2026-08.md
    ...
  plan-files/           (optional export of shared plan PDFs)
```

- A cron/trigger (or manual button) runs monthly: pull messages for `YYYY-MM`, render a markdown
  transcript (message id, sender, time, type, body/media link), upload the text and media blobs.
- Dedupe by `message_id` set per month; `source_checksum` recorded in `drive_archives` prevents
  re-archiving the same month twice.
- Backfill: archives history older than a retention window so the DB stays lean.
- Webcam photos intended as chat media are stored in Supabase Storage for live access and are
  mirrored to Drive only if the archive includes them.

---

## 12. Webcam photo storage design

Flow:
```
 1. Permission  → getUserMedia({video:true}) after explicit consent + permission rationale
 2. Preview     → <video> element preview (never uploaded raw)
 3. Capture     → draw frame to canvas (JPEG/PNG)
 4. Review      → user confirms or retakes
 5. Compress    → client-side: max dimension ~1600px, quality 0.8 → target < 2 MB
 6. Upload      → POST /api/messages (type:'image') or POST /api/chat/media
                   server receives blob → Supabase Storage bucket `chat-media`
                   path: chat-media/<conversationId>/<messageId>.jpg
 7. Reference   → message row stores media_path + thumbnail; realtime delivers the URL
```

- Storage bucket `chat-media`: private, RLS-scoped to conversation members.
- Access via signed URLs (short-lived, regenerated on demand) rather than public bucket URLs.
- Metadata (mime, size) recorded on the message; plan-file rules in `lib/plans/files.ts` reused
  as a base for the media guard (sizes/limits adjusted for images).

---

## 13. Repository abstraction (the UI's only data gateway)

```
interface ProductivityRepository {
  // auth
  signIn(email, password): Promise<SessionUser>
  signOut(): Promise<void>
  getCurrentUser(): Promise<SessionUser | null>

  // profile / partnership
  getMyProfile(): Promise<Profile>
  updateProfile(patch): Promise<Profile>
  getPartnerStats(partnerId): Promise<PartnerStats | null>   // respects privacy
  getPartnership(): Promise<Partnership | null>
  updatePrivacySettings(patch): Promise<PrivacySettings>

  // plans (shared)
  listPlans(): Promise<Plan[]>
  getPlan(id): Promise<Plan | null>
  createPlan(input): Promise<Plan>
  updatePlan(id, patch): Promise<Plan>
  deletePlan(id): Promise<void>
  addPlanMember(planId, email): Promise<void>
  uploadPlanFile(planId, file): Promise<PlanFile>

  // focus sessions (local + shared)
  addSession(input): Promise<Session>
  listSessions(): Promise<Session[]>
  startSharedFocus(durationMinutes): Promise<SharedFocus>
  joinSharedFocus(id): Promise<SharedFocus>
  pauseSharedFocus(id): Promise<SharedFocus>
  resumeSharedFocus(id): Promise<SharedFocus>
  completeSharedFocus(id): Promise<void>

  // chat
  listMessages(conversationId, cursor?): Promise<Message[]>
  sendMessage(conversationId, input): Promise<Message>
  markRead(conversationId): Promise<void>
  subscribeChat(conversationId, onEvent): () => void
  subscribePresence(partnershipId, onPresence): () => void
  subscribeSharedFocus(partnershipId, onEvent): () => void
}

class LocalJsonProductivityRepository implements ProductivityRepository {
  // adapts existing lib/plans/store.ts + /api/data (today's behavior)
}

class SupabaseProductivityRepository implements ProductivityRepository {
  // Supabase client + server helpers, realtime channels
}

class RepositoryFactory {
  static create(): ProductivityRepository {
    // env-driven: SUPABASE_URL present → Supabase; else LocalJson
    // in "hybrid" mode: LocalJson cache + Supabase network (Phase F)
  }
}
```

- Existing hooks (`useStorage`, `useDashboard`, `usePlans`, `useSessions`, `useStatistics`) are
  re-pointed at the repository interface with **zero component changes**; only the data-access
  seam changes.
- The repository is the contract that makes Phases A–F additive and rollback-safe.

---

## 14. Phased delivery plan

| Phase | Goal | Deliverable | Exit criteria |
| --- | --- | --- | --- |
| A | Local-first foundation | `ProductivityRepository` interface + `LocalJsonProductivityRepository` wrapping existing `dataService`/`planFileApi`; hooks rerouted through it | 85/85 tests green, build green, zero behavior change |
| B | Cloud connect (parallel) | Supabase project + schema migration SQL + `@supabase/supabase-js`, `@supabase/ssr`; Auth (email/password) wired; repository interface satisfied by a `SupabaseProductivityRepository` **behind a feature flag** | Sign-up/sign-in works in dev; schema applies; `next build` green |
| C | Migrate data | `scripts/migrate-local-to-supabase.ts` (backup → validate → upsert → `migration_version` → report); runs against service role | Report: Users 1, Plans 12, Sessions 34, Errors 0; idempotent re-run no-op; `data.json` intact |
| D | Cloud read | App reads via Supabase repository; local JSON remains the cache fallback | Dashboard, plans, sessions render from Postgres; offline fallback still works |
| E | Cloud write + realtime | All writes go through Supabase; Realtime channels for chat, presence, shared focus | Two browsers stay in sync live; shared timer keeps ~1 s parity |
| F | Cache + archive | IndexedDB cache layer + Drive monthly archiver + `drive_archives` bookkeeping | Cache serves reads on reconnect; archives dedupe correctly |

Each phase ships independently and is reversible (see Section 15).

---

## 15. Rollback plan

- **Per-phase rollback**: feature-flag the repository choice. Flipping `USE_CLOUD=false`
  reverts the app to `LocalJsonProductivityRepository` (current behavior) with no code revert.
- **Data safety**: `storage/data.json` and `storage/backups/data-before-cloud-migration.json`
  are never modified or deleted; the local file is the canonical rollback dataset.
- **Migration rollback**: if Phase C produces errors, nothing in Postgres is committed for the
  failed batch; re-run after fixing. A bad but successful migration is rolled back by re-running
  from the backup snapshot (row upserts are keyed, so re-run overwrites cleanly) or by truncating
  the migrated tables and re-running.
- **Auth rollback**: if Auth blocks the app, the flag reverts to local mode; no user data was
  destroyed because all writes stayed additive.
- **Realtime/chat rollback**: chat is disabled by flag; DB history remains readable via REST.
- **Drive rollback**: archives are append-only exports; deleting the Drive folder removes nothing
  from Postgres.

---

## 16. Verification plan

Post-migration and post-phase checks:

1. **Checksum**: `migration_version.source_checksum` must equal sha256 of `data.json`.
2. **Row parity**: for each legacy entity, `COUNT` in Postgres = count in backup snapshot
   (users 1, plans, sessions, files). Any mismatch → fail, do not flip the flag.
3. **Id preservation**: spot-check `legacy_id` for N plans/sessions equals original ids.
4. **Field parity**: sample plans/sessions compared field-by-field (title, date, status,
   priority, category, duration, task).
5. **File parity**: each migrated plan file exists in Supabase Storage with matching size/mime;
   signed URL opens.
6. **Idempotency**: run the migration a second time → "already migrated" no-op, no duplicate rows.
7. **Stats equivalence**: `useStatistics` output on migrated data equals the pre-migration values
   (focus minutes, streak, success rate) computed in `src/utils/statistics.ts`.
8. **Live checks (two browsers)**: plan add/edit appears in both; message arrives < 1 s; typing
   indicator shows; shared focus countdown parity within ~1 s; read receipts clear the badge.
9. **Privacy checks**: toggle `share_weekly_stats=false` → partner panel shows "hidden";
   RLS returns empty without error.
10. **Regression**: `npm run test`, `npm run lint`, `tsc`, `next build` all green each phase.

---

## 17. Environment variables

```
# .env.local (never committed)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<public anon key>          # safe in browser (RLS protects)
SUPABASE_SERVICE_ROLE_KEY=<service role key> # SERVER ONLY — never in frontend
GOOGLE_DRIVE_CLIENT_ID=<optional>
GOOGLE_DRIVE_CLIENT_SECRET=<optional>
GOOGLE_DRIVE_REFRESH_TOKEN=<optional>

# flags
NEXT_PUBLIC_USE_CLOUD=true                   # repo feature flag (local/supabase/hybrid)
NEXT_PUBLIC_ARCHIVE_ENABLED=true             # Drive archive toggle
NEXT_PUBLIC_CHAT_ENABLED=true                # chat toggle
```

Rules:
- `SUPABASE_SERVICE_ROLE_KEY` is referenced **only** in Route Handlers and the migration script —
  never in `src/` client code, never exposed through `NEXT_PUBLIC_`.
- Access via `process.env` at runtime; the migration script reads the same `.env.local`.
- Add an example `.env.example` documenting all variables.

---

## 18. Dependencies

Runtime (add to `package.json`):
- `@supabase/supabase-js` — client + server SDK (Postgres REST, realtime, storage, auth).
- `@supabase/ssr` — Next.js App Router auth cookie helpers (official, required by Next 16 conventions).
- `googleapis` — Drive archive (server-side only).

Dev/scripts:
- `tsx` — run `scripts/migrate-local-to-supabase.ts`.
- `@types/mime-types` or `mime-types` — media type guard for uploads (optional; can reuse existing
  magic-number checks in `lib/plans/files.ts`).

No new UI/fetch libraries — keep `fetch` + repository. `framer-motion`, `react-icons`, Tailwind v4
stay as-is. Nothing in the current runtime deps is removed.

---

## 19. API / realtime event catalogue

### REST (Route Handlers — all auth-gated, service role only server-side)
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | create user + profile |
| POST | `/api/auth/signin` | email/password sign-in |
| POST | `/api/auth/signout` | clear session |
| GET | `/api/profile` | own profile |
| PATCH | `/api/profile` | update own profile |
| GET | `/api/partner` | partner profile + presence + stats (privacy-filtered) |
| PATCH | `/api/privacy` | update `partner_privacy_settings` |
| GET/POST | `/api/data` | retained: local cache fallback (Phase A/D) |
| GET | `/api/plans` | list my shared plans |
| POST | `/api/plans` | create plan |
| GET/PATCH/DELETE | `/api/plans/:id` | plan detail/update/delete |
| POST | `/api/plans/:id/members` | invite partner |
| GET/POST | `/api/plans/:id/activity` | activity feed |
| POST | `/api/plans/:planId/file` | plan file upload (existing route, re-targeted) |
| GET | `/api/plans/:planId/file` | signed file URL (existing route, re-targeted) |
| GET | `/api/sessions` | my sessions |
| POST | `/api/sessions` | add completed/cancelled session |
| GET | `/api/stats` | my aggregated stats |
| POST | `/api/shared-focus` | start shared session |
| POST | `/api/shared-focus/:id/join` | join |
| POST | `/api/shared-focus/:id/pause` | pause (server re-computes `ends_at`) |
| POST | `/api/shared-focus/:id/resume` | resume |
| POST | `/api/shared-focus/:id/complete` | complete + emit `focus_sessions` |
| GET | `/api/conversations/:id/messages?cursor=` | paginated history |
| POST | `/api/conversations/:id/messages` | send message (text/image/reference) |
| POST | `/api/conversations/:id/read` | mark read (sets `read_at`) |
| GET | `/api/chat/media/:messageId` | signed media URL |
| POST | `/api/archive/drive/run` | trigger monthly Drive archive (admin/optional) |

### Realtime channels
| Channel | Broadcast payloads (ephemeral) | DB sync |
| --- | --- | --- |
| `presence:{partnershipId}` | `online/offline/focusing`, `typing`, `seen` | presence table not used |
| `chat:{conversationId}` | new message, typing, read | `messages` INSERT/UPDATE |
| `plan:{planId}` | status change, member added, activity | `plans`/`plan_activity` |
| `focus:{partnershipId}` | `focus_started{ends_at}`, `focus_joined`, `focus_paused{newEndsAt}`, `focus_completed` | `shared_focus_sessions` |

---

## 20. Testing requirements

- **Unit (vitest)**: repository adapters against a mocked Supabase client and against the existing
  JSON store; migration mapping (legacy → DB row) with fixture `AppData`; privacy-filter logic;
  shared-focus timer arithmetic (`ends_at`, pause/resume re-computation); message type guards;
  client-side webcam compress (canvas → blob) with size limits.
- **Integration**: `/api/*` handlers with a test Supabase project (or `supabase` local stack);
  RLS policy tests as SQL (`SET LOCAL role` assertions that a user cannot read the partner's
  private rows, and CAN read shared rows).
- **E2E (Playwright, two browser contexts)**: sign-up both users → partner each other → share a
  plan and see it live → run a shared focus and assert countdown parity → chat + read receipt →
  webcam capture + send image → toggle privacy and assert partner panel hides.
- **Migration**: dedicated test running the migration script against a temp `data.json` fixture;
  assert parity, idempotency, checksum, and the report file.
- **Regression gates each phase**: `npm run lint`, `prettier --check`, `tsc`, `npm run test`,
  `next build` (Next 16 with Turbopack) all green; 85/85 existing tests continue to pass.
- **Follow Next 16 docs** in `node_modules/next/dist/docs/` (per AGENTS.md) before writing any
  Route Handler or auth cookie code, since this Next version has breaking conventions.

---

### Open decisions (confirm before Phase B)
1. Shared-focus pause policy: any member can pause, or both must agree?
2. Chat retention window before Drive archival: keep N months in Postgres?
3. Presence scope: show only `online/offline/focusing`, or also live timer progress?
4. Webcam thumbnails: store a small thumbnail alongside the original for chat list previews?

### Guardrails (non-negotiable)
- `storage/data.json` is never deleted, overwritten, or reformatted by the migration.
- Service role key never enters the browser.
- Drive is never a dependency for any live feature.
- No implementation code is written until this plan is approved.
