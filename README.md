# Fenerbahçe Fan Hub

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, **live polls**, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Version](https://img.shields.io/badge/version-2.17.0-blue)
![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Firebase](https://img.shields.io/badge/Firebase-Auth_+_Cloud_Functions-orange)

## What's New in v2.17.0

- **Protected Recipient Targeting** - Administrators can select eligible users from a masked, on-demand directory or save revision-protected recipient groups without exposing device tokens
- **Verified Delivery Workflow** - Self-testing is required for the exact content and audience before one-time topic, user, or group delivery, with aggregate results and invalid-token cleanup
- **Trusted Social Destinations** - Notifications can safely open the Fan Hub, official Fenerbahçe X posts, or supported Instagram profiles and posts

<details>
<summary>Previous: v2.14.0 – v2.16.1</summary>

- **Cross-Platform Builder Reliability** - Continuous page scrolling restored Android, narrow-web, and iPhone access to every player while synchronized release metadata fixed the administration-panel version display
- **Operational Data Resilience** - Independent ESPN/cache controls, 06:00 last-known-good snapshots, bounded browser requests, transient retries, partial competition success, and explicit administrator fallback improved fixture, standings, and statistics reliability
- **Lineup and European Coverage** - Statistics now combine every European competition, verified lineups remain bound to the selected fixture, and administrators can remove a public Starting XI without losing its draft, ESPN detection, or paused automation state
- **Protected Player Status Publishing** - Claim-protected drafts, revision-safe publishing, audit records, manual-player fallback, status presets, and local-only review mode replaced the legacy Starting XI administration path without exposing private operations
- **Unified Matchday Interface** - The responsive Match Center, completed-match details, compact season controls, dual themes, shared lineup pitches, and isolated development simulator standardized mobile and desktop behavior

</details>

<details>
<summary>Previous: v2.10.0 – v2.13.1</summary>

- **Season and Historical Reliability** - Season-aware fixtures, standings, statistics, offseason recovery, historical-data safeguards, mobile filters, and last-known-good fallbacks made provider failures safer from v2.10 onward
- **White Kit and Anniversary Identity** - Public device-local theme selection introduced `Klasik Gece` and the ivory, navy, and gold `Beyaz Forma` visual system with flash-free startup and 120th anniversary branding
- **Cup and European Journey** - Türkiye Kupası coverage, chronological multi-competition match flow, dynamic UEFA competition resolution, Fenerbahçe's route, and the connected knockout bracket expanded the season experience
- **Operational and Release Hardening** - Notification authorization, due-window scheduling, durable final-match continuity, indexed recovery, versioned RTDB rules, CI release gates, dependency maintenance, and preserved runtime behavior improved reliability
- **Verified Lineups and Protected Administration** - Two-observation ESPN verification, shared dual-team pitches, live substitutions, claim-protected administration, and safe manual publishing created a controlled Starting XI workflow
- **Controlled Notification Operations** - Administrator self-tests, transaction-protected topic sends, private scheduler and cache health, ESPN lineup status, backend version visibility, and honest FCM acceptance results completed the operational tooling

</details>

<details>
<summary>Previous: v2.9.x (v2.9.0 - v2.9.11)</summary>

- **Authentication & Protected Actions** - Added Firebase/Google sign-in, auth-gated polls and notifications, profile UI, secure reminder writes, and protected admin refresh flows
- **Notification Reliability** - Hardened FCM preference storage, token rotation, topic sync, invalid-token cleanup, general fan announcements, and one-shot Starting XI push delivery
- **Poll & API Contracts** - Moved poll voting server-side with atomic transactions, shared sign-in prompts, configurable backend origin, baseline rate limiting, and expanded poll/reminder regression tests
- **Matchday & Lineup Experience** - Added realtime Starting XI publishing, ESPN actual lineups for completed matches, dual-team formation views, bench/substitution timelines, and formation rendering safeguards
- **Image & Asset Caching** - Added scheduled backend image/logo caching and cache-only public image endpoints to reduce RapidAPI traffic and noisy client retries
- **Quality & Maintainability** - Introduced stricter release gates, Node 22 alignment, modular backend handlers, shared body scroll lock, frontend/backend hook refactors, timeout guards, and broader test coverage

</details>

<details>
<summary>Previous: v2.8.x (v2.8.0 – v2.8.5)</summary>

- **Statistics Tab** (v2.8.0) - New "İstatistikler" bottom nav tab with top scorers, assisters (ESPN direct, league/Europa filters, expand to 10), interactive SVG form chart with possession trend, and injury/suspension status from `admin/playerStatus`
- **Standings Redesign** (v2.8.3) - Glassmorphic standings modal with colored league position zones (CL, EL, relegation), compact mobile layout
- **Turkish Localization** (v2.8.3) - Centralized `localize.ts` with 30+ team name corrections and 15+ competition translations, fixed 17 strings with missing diacritics
- **Error Boundaries** (v2.8.4) - Each tab wrapped in `ErrorBoundary` with "Tekrar Dene" recovery. Refresh rate limiting with reusable `useCooldown` hook
- **Backend Modularization** (v2.8.5) - Split monolithic `functions/index.js` into `config.js`, `services/`, `handlers/`, `schedulers/`. Merged SW scopes for reliable iOS push notifications

</details>

<details>
<summary>Previous: v2.7.0 - v2.7.1</summary>

- **Side-Based Incident Layout** (v2.7.1) - Live match detail and fixture summary cards now render goals and red cards under each team logo (left/right distribution), matching broadcast-style readability
- **Clock Alignment Fix** (v2.7.1) - Incident minute columns now use fixed-width and tabular numerals, preventing 1-digit/2-digit minute shift
- **Live Halftime UX Update** (v2.7.1) - Red live badge remains `CANLI`; halftime appears as a separate indicator and center clock localizes to `Devre Arası`
- **Own Goal Standardization** (v2.7.1) - `(K.K)` rendering is consistently applied across dashboard and detail surfaces
- **Cross-Platform Substitution Icon** (v2.7.1) - Replaced unicode arrow with SVG swap icon for consistent iOS/desktop rendering
- **Display Name Override** (v2.7.1) - `Munir Mercan` is now shown as `Levent Mercan` in match event UI
- **Full TypeScript Migration** (v2.7.0) - Entire frontend codebase migrated from JavaScript/JSX to TypeScript/TSX with strict mode enabled. All components, hooks, services, and utilities are now fully typed with zero build errors
- **Centralized Type System** (v2.7.0) - Created `src/types/index.ts` with comprehensive type definitions for all API responses (ESPN, SofaScore, Firebase), component props, and application state
- **Component Refactoring** (v2.7.0) - Large monolithic components split into focused sub-components and custom hooks:
  - `FixtureSchedule` (766 → 466 lines): Extracted `useFixtureData` hook and `MatchSummaryModal` component
  - `Dashboard` (502 → 352 lines): Extracted `MatchCountdown`, `NextMatchesPanel`, `StandingsModal`, `LiveMatchModal`
  - `FormationBuilder` (576 → 371 lines): Extracted `PlayerSelectionModal`, `PlayerPool`, and `formations` data module
- **Custom Hooks** (v2.7.0) - New `src/hooks/useFixtureData.ts` encapsulates all fixture data fetching, filtering, and modal state management
- **TypeScript Infrastructure** (v2.7.0) - Added `tsconfig.json` with strict mode, `vite-env.d.ts` with typed environment variables, and `@types/node` for Node.js type support

</details>

<details>
<summary>Previous: v2.6.0 - v2.6.2</summary>

- **Standings Direct from ESPN** (v2.6.2) - Standings are now fetched directly from ESPN on the client side instead of going through the backend cache, providing always up-to-date league tables without 24-hour staleness
- **Backend Standings Removal** (v2.6.2) - Removed standings fetch from `dailyDataRefresh` and `handleRefresh` Cloud Functions, reducing scheduled function runtime and Firebase read/write costs
- **Notification Scheduler Hardening** (v2.6.2) - Rewrote `checkMatchNotifications` to read only `cache/next3Matches` instead of the full cache tree, use `Intl.DateTimeFormat.formatToParts` for reliable Istanbul timezone calculation, widen daily check window, add `sentForMatch` type safety, and fix `Object.assign` accumulation bug for sent records
- **Live Match Cache Read Optimization** (v2.6.2) - `updateLiveMatch` now reads only `cache/nextMatch` instead of the full cache tree
- **Post-Match Cleanup Fix** (v2.6.2) - Fixed `postMarkedAt` logic that never triggered because it read from the freshly built live data object instead of the existing cache value
- **Token Lifecycle Cleanup** (v2.6.2) - Both manual save and auto-sync now send the previous token to the backend for immediate deletion, preventing zombie token accumulation in the database
- **FCM Token Auto-Sync** (v2.6.1) - The app now detects FCM token refreshes on every launch and silently re-registers the new token with the backend, preventing missed notifications caused by stale tokens
- **Foreground Notification Handler** (v2.6.1) - Added `onMessage` handler so push notifications are displayed even when the app is actively open in the browser
- **Wider Notification Trigger Window** (v2.6.1) - Expanded the scheduled notification check window from 2 minutes to 5 minutes to account for Cloud Scheduler timing variance
- **Fixture Match Summary Modal (Cache-First)** (v2.6.0) - Added match statistics flow for finished fixtures with backend endpoint `GET /api/match-summary/:matchId`
- **Persistent Post-Match Continuity** (v2.6.0) - Added `cache/lastFinishedMatch` fallback so the home card can keep final score/events after `cache/liveMatch` is cleaned
- **Stored Match Summaries** (v2.6.0) - Added `cache/matchSummaries/{matchId}` storage and preservation across daily refresh/manual refresh
- **Live State Reliability Upgrade** (v2.6.0) - Improved `no-match` handling to prevent incorrect pre-match rendering after kickoff; frontend now uses an explicit `checking` state
- **Event Pipeline Normalization** (v2.6.0) - Improved ESPN event normalization/deduplication to avoid conflicting event flags and support assist extraction for goal events
- **UI and Localization Polish** (v2.6.0) - Added `(P)` penalty marker, normalized stoppage-time clock format (`90+5'`), localized `FT` to `Mac Sonu`, and improved fixture summary header visuals

</details>

<details>
<summary>Previous: v2.3.0 - v2.5.3</summary>

- **Fixture Tab** (v2.5.0) - Dedicated fixture screen with ESPN integration, multi-competition coverage (Super Lig + Europa League), advanced filters, and Turkish localization
- **Live Match System** (v2.4.0) - Auto-transition from countdown to live mode, inline score/events/stats, post-match cleanup, DB cache architecture, and daily data purge
- **Live Event Enhancements** (v2.5.2 - v2.5.3) - Substitution events from ESPN, event deduplication, penalty labels, halftime localization, and reordered stats with card counts
- **Formation Builder Fixes** (v2.3.0 - v2.5.1) - Web Share API, SVG pitch redesign, 4-1-2-1-2 Diamond formation, position persistence fix across formation switches, role-family remapping, and mobile scroll improvements
- **Notification Reliability** (v2.4.2) - FCM service worker scope fix, delivery tracking, invalid token cleanup, and Istanbul timezone normalization

</details>

## Features

### Dashboard
- **Next Match Card**: Live countdown timer with team logos and match details
- **Live Match State Flow**: Countdown → Checking → Live/Post (stable post-match fallback while preserving final data)
- **Live Match Tracking**: Real-time score updates, match events (goals, cards), and live statistics via ESPN API → DB Cache
- **Post-Match Actual Lineups**: After a match ends, the detail modal shows ESPN-sourced formation, starting XI on a mini pitch, bench list, and substitution timeline. If lineup data is unavailable the section is silently hidden
- **Verified Starting XI Banner & Modal**: Validated ESPN or administrator-published data under `cache/matchLineups/{matchId}` opens a shared two-team pitch with formations, shirt numbers, squad photos, benches, and substitutions
- **League & Europe Center**: Süper Lig standings plus a season-aware UEFA journey that resolves Champions League, Europa League, or Conference League automatically and exposes Fener’s route, league-phase standings, and the published knockout bracket
- **Match Poll**: Interactive "Who will win?" poll with real-time results. Votes are validated server-side via `POST /api/poll-vote` and stored atomically in Firebase Realtime Database
- **Push Notifications**: Reliable match reminders via Firebase Cloud Functions. Requires Google sign-in to configure
- **Upcoming Matches**: Display the next 3 fixtures in kickoff order with competition labels, including Türkiye Kupası when scheduled
- **Automatic Data Cleanup**: Old polls and notification records cleaned up daily
- **Selectable Visual System**: `Klasik Gece` preserves the original glassmorphic UI, while `Beyaz Forma` applies the 120th anniversary ivory, navy, and gold print style across every frontend surface
- **Local Theme Persistence**: Theme selection is available without sign-in and remains on the current browser/PWA installation; it is not stored in Firebase or synchronized between devices

### Fixture Explorer
- **Dedicated Fixture Tab**: Separate bottom-nav screen for season fixtures
- **Recent Season Picker**: Switch between the current season and the previous two seasons
- **Season-Safe Timeline**: Current seasons prioritize remaining matches; historical seasons open on completed matches and exclude cross-season ESPN results
- **Competition Filtering**: Filter by **Süper Lig**, **Türkiye Kupası**, or European competitions (**Champions League**, **Europa League**, and **Conference League**, including qualifying/play-off rounds)
- **Home/Away Filter**: Quickly narrow down to home or away fixtures
- **Always-Visible Team Search**: Search by opponent directly beside the season picker without opening advanced filters
- **Compact Match Cards**: Horizontal team layout with score (or `VS`) and stadium name
- **Resilient Direct ESPN Requests**: Browser requests remain the default, use bounded concurrency, retry one transient network/CORS/5xx failure through ESPN's alternate official API hostname, and keep successful competitions when another competition feed fails. Only usable responses are deduplicated for the session, so a failed attempt is retried instead of replayed
- **Manual Refresh**: Force a fresh ESPN request (or reload the selected cache snapshot when cache mode is active)
- **Fixture Match Summary Modal**: For completed matches, opens cached summary data (scoreline, ordered stats, key events, and actual lineups with formation/bench/substitutions when available)

### Push Notification System
- **5 Notification Types**:
  - 3 hours before match
  - 1 hour before match
  - 30 minutes before match
  - 15 minutes before match
  - **Daily Match Check**: Automatically notifies at 09:00 TR if there is a match that day
- **Always-On Delivery**: Powered by **Firebase Cloud Functions** (Serverless)
- **Due-Window Reads**: The scheduler reads `cache/next3Matches` every minute and loads user preferences only when a reminder is actually due
- **Delivery Retry Window**: Each reminder remains eligible for five minutes and successful sends are deduplicated per user, match, and reminder type
- **Cross-Platform**: Works on mobile & desktop (PWA support)
- **Beautiful Format**: `Fenerbahçe - Opponent | 20:45 - 1 saat kaldi`

### Statistics
- **Season-Aware Rankings**: One recent-three-season picker updates both scorer and assister tables using season-scoped ESPN requests
- **Top Scorers**: Ranked list (top 5 expandable to 10), with Toplam / Süper Lig / Avrupa filters
- **Top Assisters**: Ranked list (top 5 expandable to 10), with the same season and competition filtering
- **Team Form**: Interactive SVG trend over the last 6 completed matches (G/B/M trajectory + expandable goal performance and possession trend)
- **Injury, Suspension & Card Risk Status**: Reads from `admin/playerStatus` in Firebase Realtime Database. Displays injured, suspended, doubtful, and card-risk players with status label and return estimate. Card-risk entries highlight players approaching a yellow card suspension threshold

#### `admin/playerStatus` Schema

This small public read-only node is published from the claim-protected administration panel. Administrators prepare a private draft, review the shared Statistics preview, and explicitly publish it; clients never write this path directly. Each published entry:

```json
{
  "playerId": "123456",
  "source": "squad | manual",
  "name": "Player Name",
  "status": "injured | suspended | doubtful | card-risk",
  "detail": "Right knee ligament injury",
  "returnDate": "March 2026",
  "updatedAt": 1709500000000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `playerId` | `string` | Provider ID for squad players or a server-generated safe ID for manual entries |
| `source` | `"squad" \| "manual"` | Whether the player came from the cached squad or the administrator fallback |
| `name` | `string` | Player display name |
| `status` | `"injured" \| "suspended" \| "doubtful" \| "card-risk"` | Current active status. `card-risk` marks players near a yellow card suspension threshold. |
| `detail` | `string` | Description of injury/suspension |
| `returnDate` | `string` | Estimated return date (free text) |
| `updatedAt` | `number` | Unix timestamp in milliseconds. Used to show "Last updated: X hours ago" |

### Starting XI Publishing
- **Automatic Discovery**: The existing live scheduler checks every three minutes from T-90 to T-30 and every minute afterward for supported Süper Lig and UEFA fixtures
- **Provider Identity Guard**: ESPN data is accepted only after home team, away team, kickoff time, and competition agree with the scheduled SofaScore match
- **Publication Gate**: Both teams must contain 11 unique, named players with unique numeric shirt numbers, and the same lineup must appear in two consecutive checks
- **Manual Fallback**: Türkiye Kupası and incomplete ESPN data can be handled from the claim-protected administration panel; a manual Fenerbahçe lock preserves the ESPN opponent lineup and blocks automatic Fenerbahçe overwrites
- **Safe Rollout**: `autoPublishLineups` and `autoPushLineups` default to `false`. A late lineup is displayed after validation but never sends a Starting XI push after kickoff
- **Durable Match Binding**: Published lineups remain under `cache/matchLineups/{matchId}`. The dashboard follows only the active fixture, so the previous lineup disappears at the normal 06:00 fixture transition; an administrator can also explicitly remove a publication while preserving its private draft and ESPN detection
- **Public/Private Separation**: Published sports data is public read-only cache data. Detection fingerprints, drafts, manual locks, settings, health records, notification locks, and audit records live under server-only `ops`
- **Single Publication Path**: Verified lineups are published only under `cache/matchLineups/{matchId}`, with detection, locks, drafts, settings, and audit state isolated under private `ops`

### Formation Builder
- **6 Formations**: 4-3-3, 4-4-2, 4-2-3-1, 4-1-4-1, 3-5-2, 4-1-2-1-2 Diamond
- **Realistic Pitch**: SVG-based football field with accurate FIFA-standard markings
- **Drag & Drop**: Intuitive player placement from squad pool
- **Player Photos**: Dynamic player images from SofaScore API
- **Native Share**: Share your lineup directly to WhatsApp, Telegram, Twitter via Web Share API
- **Download**: Export formation as PNG image

## Tech Stack

- **Frontend**: React 19.2 + Vite 5.4 + TypeScript 5.9
- **Styling**: Tailwind CSS v4
- **Auth**: Firebase Authentication (Google sign-in only for protected actions)
- **Backend**: Firebase Cloud Functions (Serverless, JS)
- **Database**: Firebase Realtime Database (public read-only sports cache, owner-isolated user data, and server-only operations state)
- **APIs**: 
  - SofaScore (via RapidAPI) - Match data, Squad
  - ESPN (Free) - Standings, Live scores, Fixture schedules
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **PWA**: Installable app with offline support
- **Deployment**: GitHub Pages (frontend) + Firebase Cloud Functions (backend)

## Testing & Quality

### Test Stack

- **Vitest** — test runner (Node environment by default, happy-dom where component and hook tests need it)
- **@testing-library/react** — component testing utilities
- **@testing-library/jest-dom** — DOM assertion matchers
- **happy-dom** — browser environment simulation for React component and hook tests
- **Firebase Local Emulator Suite** — Realtime Database rules and authenticated owner-isolation tests

### Quality Commands

| Command | Description |
|---------|-------------|
| `npm run typecheck` | Run `tsc --noEmit` (zero-error TypeScript check) |
| `npm run lint` | Run ESLint on `src/` (TypeScript + React rules) |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once (CI mode) |
| `npm run test:rules` | Start the local RTDB emulator and verify public, owner-only, and server-only access paths |
| `npm run build` | Production build (includes service worker generation) |
| `npm run check` | Run lint, typecheck, all application/rules tests, and the production build |

### Test Coverage

| Area | File | What's tested |
|------|------|---------------|
| ESPN parsing | `functions/services/espn.test.js` | Event flag normalization, summary event filtering, key event parsing, ordered stat picking |
| Formation engine | `src/components/match-lineups/formation-engine.test.ts` | Position classification, formation parsing, preset/numeric/detailed/fallback row building |
| Dashboard helpers | `src/utils/dashboardHelpers.test.ts` | Halftime detection, goal team resolution, and goal summary formatting |
| Notification helpers | `src/utils/notificationHelpers.test.ts` | Option creation/normalization, enabled count, match option keys |
| Season helpers | `src/utils/seasons.test.ts` | July season rollover, recent-season options, historical detection, selected-season date boundaries |
| ESPN request resilience | `src/services/api/request-policy.test.ts`, `src/services/api/espn-fixtures.test.ts` | Bounded concurrency, one transient retry, session deduplication of usable results only, retry after a rejected or empty attempt, and partial competition success |
| Player statistics | `src/services/api/statistics.test.ts` | Season-scoped Süper Lig and all-European-competition requests with combined goal/assist totals |
| Data snapshots | `functions/services/dataSnapshots.test.js` | 06:00/admin snapshot generation and last-known-good preservation after provider failures |
| Cache refresh safety | `functions/utils/cacheRefresh.test.js` | Last known-good cache preservation on provider failure and replacement only after a successful response |
| Match bootstrap fallback | `src/hooks/useMatchBootstrap.test.ts` | Local match preservation across empty backend responses and request failures |
| Reminder authorization | `functions/handlers/reminder.test.js` | Authenticated preference writes, trusted token rotation, deferred FCM cleanup, and malicious old-token rejection |
| Notification timing | `functions/utils/notificationSchedule.test.js` | Istanbul daily window and next-three-match reminder windows without early full-user scans |
| Final-match cache | `functions/utils/finalMatchCache.test.js` | Five-minute transient cleanup with durable final-score continuity |
| Topic reconciliation | `functions/schedulers/topicSync.test.js` | Indexed pending-sync and deferred old-token cleanup paths |
| Lineup automation | `functions/utils/lineupAutomation.test.js`, `functions/services/lineupPublishing.test.js` | 90/30-minute polling, complete 11+11 validation, stable observations, last-minute changes, late publication, manual locks, and push deduplication |
| Admin authorization and schemas | `functions/handlers/middleware.admin.test.js`, `functions/handlers/adminRouter.test.js` | Missing/revoked tokens, non-admin claims, shared-route gating, path manipulation, unknown fields, ESPN/cache controls, lineup/player-status draft constraints, masked recipient pages, revision-safe notification groups, verified targeted delivery, and trusted notification URLs |
| Shared lineup UI | `src/components/MatchLineups.test.tsx`, `src/components/FormationBuilder.test.tsx` | Fenerbahçe-first home/away tabs, incomplete provider sides, and mobile touch editing |
| Player-status UI and realtime parsing | `src/components/admin/AdminPlayerStatusManager.test.tsx`, `src/components/AdminPanel.preview.test.tsx`, `src/services/api/statistics.player-status.test.ts` | Mobile squad/manual editing, stale warnings, local-only writes, legacy/modern data parsing, and realtime updates |
| Realtime Database rules | `rules/database.rules.spec.mjs` | Public read-only sports cache/status data, owner isolation, private `ops`, denied direct writes, and the closed legacy `admin/startingXI` path |

Pure backend helpers run without Firebase side effects; the rules suite separately uses a demo-project emulator and never connects to production data.

### CI Quality Gate

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

**typecheck** → **lint** → **application tests** → **RTDB rules tests** → **build** → **deploy on a successful `main` push**

Deployment is part of the same workflow and cannot run if any quality step fails.

## Development Workflow

After making changes, run the quality checks locally before pushing:

```bash
npm run check
```

To review the player-status UI without an administrator session or any Firebase write, start Vite and open:

```text
http://localhost:5173/fenerbahce-fan-hub/?adminStatusPreview=1
```

The development-only header control opens the **Durumlar** tab directly. It reads the public live status and squad data, but save and publish actions remain in memory and disappear on refresh. The production build removes the query switch and its warning marker.

### Sports Data Source Controls

Fixtures, Süper Lig standings, and player statistics use direct browser-to-ESPN requests by default. The frontend uses `site.web.api.espn.com` as the preferred browser endpoint, limits concurrent schedule/roster requests, retries one transient failure through the legacy `site.api.espn.com` hostname, and deduplicates identical requests for the current browser session. It does not poll these datasets every 60 seconds.

`dailyDataRefresh` stores one last-known-good snapshot for each resource at 06:00 Europe/Istanbul time under `cache/dataSnapshots/{seasonStartYear}/{resource}`. In **Yönetim → Sistem**, an administrator can independently select **ESPN** or **Cache** for each resource and can refresh one snapshot or all snapshots on demand. Provider failures update snapshot health metadata but preserve the previous `data` payload. Public clients can read these nodes but cannot write them.

The cache switch is an operational fallback, not an automatic failover: a transient ESPN error remains visible while ESPN mode is selected, and the administrator decides when to activate cached data. Source-mode changes are delivered through a small Realtime Database listener; the sports payloads themselves are read once and are not continuously streamed.

CI runs the same quality command sequence with Node.js 22 and Java 21 for the Firebase emulator.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   GitHub Pages  │     │         Firebase Cloud Functions     │
│    (Frontend)   │────▶│  /api/next-match     (from cache)    │
│                 │     │  /api/standings      (legacy cache)  │
│  React + Vite   │     │  /api/squad          (from cache)    │
│                 │     │  /api/reminder       (save prefs)    │
└─────────────────┘     │  /api/poll-vote      (vote write)    │
                        │  /api/refresh        (admin-key)     │
                        │  /api/admin/*        (admin claim)   │
                        │  /api/live-match     (from DB cache) │
                        │  /api/cup-fixtures   (from DB cache) │
                        │  /api/uefa-journey   (cache-first)   │
                        │  /api/match-summary  (cache-first)   │
                        │  /api/player-image   (proxy)         │
                        │  /api/team-image     (proxy)         │
                        └──────────────────────────────────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                │   Firebase   │ │   SofaScore  │ │     ESPN     │
                │   Realtime   │ │   (RapidAPI) │ │   (Free)     │
                │   Database   │ │  2-3 calls/day│ │ lineup/live  │
                │              │ └──────────────┘ └──────────────┘
                │ cache/       │        ▲
                │   liveMatch  │────────┘ updateLiveMatch (1/min)
                │   lastFinishedMatch
                │   dataSourceModes/
                │   dataSnapshots/
                │   cupFixtures/
                │   uefaJourney/
                │   squad          ← Statistics tab reads directly
                │   matchSummaries/
                │   matchLineups/  ← Public, server-written
                │ ops/             ← Private server state
                │ admin/       │
                │   playerStatus   ← Public read-only, admin API published
                │ match_polls/ │
                │ notifications│
                └──────────────┘
```

Note: The fixture tab normally merges client-side ESPN schedules with the cached `GET /api/cup-fixtures?seasonStartYear=YYYY` SofaScore supplement, while standings and statistics also use direct ESPN browser requests. Each of these three resources can instead read its administrator-selected 06:00 snapshot. Türkiye Kupası coverage starts with 2026/27; older selectable seasons remain ESPN-only. The Europe modal calls `GET /api/uefa-journey?seasonStartYear=YYYY`; that handler automatically refreshes stale current-season ESPN data and stores the result under `cache/uefaJourney/{seasonStartYear}`, while `summary=true` returns the compact dashboard label. Finished ESPN fixture summaries are served by `/api/match-summary/:matchId`, while SofaScore cup cards intentionally omit the unsupported summary action.

## Project Structure

```
fenerbahce-fan-hub/
├── functions/
│   ├── index.js               # Cloud Functions re-export hub
│   ├── config.js              # Firebase init, secrets, constants, helpers
│   ├── services/
│   │   ├── espn.js            # ESPN data fetching & event parsing
│   │   ├── espn-helpers.js    # Pure ESPN helpers (zero side effects, no Firebase)
│   │   ├── dataSnapshots.js   # 06:00 and admin-triggered ESPN fallback snapshots
│   │   ├── lineupPublishing.js # Stable detection, publication and push locking
│   │   ├── uefaJourney.js     # UEFA schedules, standings, bracket and cache
│   │   └── sofascore.js       # SofaScore API calls (matches, squad, images)
│   ├── handlers/
│   │   ├── api.js             # HTTP endpoint routing
│   │   ├── admin.js           # Health and protected cache refresh
│   │   ├── adminRouter.js     # Claim-protected admin API and strict schemas
│   │   ├── assets.js          # Cache-only public image endpoints
│   │   ├── matches.js         # Match, fixture, UEFA and summary handlers
│   │   ├── middleware.js      # Authentication gates and request rate limiting
│   │   ├── polls.js           # Authenticated atomic poll writes
│   │   ├── reminders.js       # Authenticated FCM preference writes
│   │   └── squad.js           # Cached squad endpoint
│   ├── schedulers/
│   │   ├── dailyRefresh.js    # Daily data refresh (03:00 UTC)
│   │   ├── liveMatch.js       # Live match updater (every 1 min)
│   │   ├── notifications.js   # Match notification checker (every 1 min)
│   │   └── topicSync.js       # all_fans topic reconciler (every 5 min)
│   └── package.json           # Functions dependencies
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx              # Main dashboard (orchestrator, helpers in utils/)
│   │   ├── AdminPanel.tsx             # Private operations shell for data, lineup, status, and notifications
│   │   ├── admin/                      # Player-status workflow and protected notification targeting UI
│   │   ├── match-lineups/             # Post-match lineup viewer (split module)
│   │   │   ├── formation-engine.ts    # Pure formation/row-building logic
│   │   │   ├── MiniPitch.tsx          # SVG pitch visualization
│   │   │   ├── BenchList.tsx          # Bench player list
│   │   │   └── SubstitutionList.tsx   # Substitution timeline
│   │   ├── MatchLineups.tsx           # Thin orchestrator (imports match-lineups/*)
│   │   ├── MatchCountdown.tsx         # Countdown timer sub-component
│   │   ├── StartingXIModal.tsx        # Matchday starting XI modal
│   │   ├── NextMatchesPanel.tsx       # Upcoming 3 matches panel
│   │   ├── LiveMatchModal.tsx         # Live match detail modal
│   │   ├── StandingsModal.tsx         # Standings modal wrapper
│   │   ├── UefaJourneyContent.tsx      # Fener path and responsive bracket views
│   │   ├── SeasonSelector.tsx          # Shared recent-season picker
│   │   ├── FixtureSchedule.tsx        # Fixture tab with ESPN-backed filters
│   │   ├── MatchSummaryModal.tsx      # Match statistics modal
│   │   ├── Statistics.tsx             # Statistics tab
│   │   ├── FormationBuilder.tsx       # Interactive pitch & formations
│   │   ├── PlayerSelectionModal.tsx   # Player picker modal
│   │   ├── PlayerPool.tsx            # Draggable player grid
│   │   ├── NotificationSettings.tsx   # Notification preferences (helpers in utils/)
│   │   ├── Poll.tsx                   # Real-time voting component
│   │   ├── CustomStandings.tsx        # Standings table
│   │   ├── LiveMatchScore.tsx         # Live match tracker
│   │   ├── MatchEventIcon.tsx         # Match event icon renderer
│   │   ├── ErrorBoundary.tsx          # Error boundary with recovery UI
│   │   └── TeamLogo.tsx              # Team logo with fallback
│   ├── hooks/
│   │   ├── useCooldown.ts             # Async action cooldown hook
│   │   └── useFixtureData.ts          # Fixture data fetching & filtering hook
│   ├── contexts/
│   │   ├── AuthContext.tsx             # Firebase Auth context (Google sign-in)
│   │   └── DataSourceContext.tsx       # Realtime ESPN/cache source-mode listener
│   ├── services/
│   │   ├── admin.ts                   # Authenticated administration API client
│   │   ├── api.ts                     # Barrel re-export (preserves import surface)
│   │   └── api/
│   │       ├── base.ts               # BACKEND_ORIGIN, BACKEND_URL, ensureAbsolutePhoto
│   │       ├── poll.ts               # submitPollVote
│   │       ├── fixtures.ts           # fetchMatchStatus, fetchSquad, fetchMatchSummary
│   │       ├── standings.ts          # fetchEspnStandings
│   │       ├── espn-fixtures.ts      # fetchEspnFenerbahceFixtures
│   │       ├── data-source.ts        # RTDB snapshot readers and source defaults
│   │       ├── request-policy.ts     # Concurrency, retry and session deduplication
│   │       ├── uefa-journey.ts       # cached UEFA journey and summary requests
│   │       └── statistics.ts         # fetchPlayerStats, fetchFormResults, fetchPlayerStatus
│   ├── data/
│   │   └── formations.ts             # Formation position definitions
│   ├── types/
│   │   └── index.ts                   # Centralized TypeScript type definitions
│   ├── utils/
│   │   ├── dashboardHelpers.ts        # Pure Dashboard logic (halftime, goals, Starting XI)
│   │   ├── notificationHelpers.ts     # FCM token, option normalization helpers
│   │   ├── squadPhotoLookup.ts        # Squad photo matching (jersey/name/alias)
│   │   ├── localize.ts               # Turkish localization for ESPN names
│   │   ├── seasons.ts                # Shared season labels, options and boundaries
│   │   └── matchClock.ts             # Match clock formatting utility
│   ├── test/
│   │   └── setup.ts                   # Test environment setup
│   ├── firebase.ts                    # Firebase client init (Auth, RTDB, Messaging)
│   ├── App.tsx                        # Main app & routing
│   └── main.tsx                       # React entry point
├── rules/
│   └── database.rules.spec.mjs        # RTDB emulator authorization tests
├── .github/workflows/
│   └── ci.yml                         # Quality gate plus gated GitHub Pages deploy
├── database.rules.json                # Versioned Realtime Database security rules
├── vitest.config.ts                   # Vitest test runner configuration
├── tsconfig.json                      # TypeScript configuration (strict mode)
├── public/                            # Static assets & PWA icons
└── firebase.json                      # Firebase configuration
```

## Installation & Setup

### Prerequisites
- Node.js 22+
- Firebase CLI 15.28.1 (or a compatible installed `firebase` command)
- Java 21 (required by the Firebase Database emulator)
- RapidAPI key for SofaScore

### Frontend Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/fenerbahce-fan-hub.git
cd fenerbahce-fan-hub
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure Firebase**
   Create `.env` file:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   # ... other firebase config
   VITE_FIREBASE_VAPID_KEY=...
   VITE_BACKEND_ORIGIN=https://us-central1-YOUR-PROJECT.cloudfunctions.net
   ```

4. **Run development server**

```bash
npm run dev
```

### Firebase Cloud Functions Setup

1. **Navigate to functions directory**

```bash
cd functions
npm install
```

Functions installs omit optional Firestore and Storage transports because this project uses Realtime Database only.

2. **Configure Secrets**
   
```bash
firebase functions:secrets:set RAPIDAPI_KEY
firebase functions:secrets:set RAPIDAPI_HOST
firebase functions:secrets:set ADMIN_REFRESH_KEY
```

3. **Grant the One-Time Administrator Claim**

Run this only from a trusted Admin SDK environment with Application Default Credentials. The target must be a verified Google account protected by two-step verification. The application intentionally exposes no endpoint that can grant claims.

```bash
npm run admin:claim -- FIREBASE_AUTH_UID
```

The command revokes existing refresh tokens; sign out and back in before opening **Yönetim** from the profile menu. To remove access later, run the same trusted command with `--remove`.

4. **Deploy Functions**

```bash
firebase login
firebase deploy --only functions
```

Deploy the versioned Realtime Database rules separately after reviewing them:

```bash
firebase deploy --only database
```

5. **Initialize Cache**
   ```bash
   curl -H "x-admin-key: YOUR_ADMIN_REFRESH_KEY" https://us-central1-YOUR-PROJECT.cloudfunctions.net/api/refresh
   ```

## How It Works

### Scheduled Functions & Triggers

| Function | Schedule | Description |
|----------|----------|-------------|
| `dailyDataRefresh` | 03:00 UTC (06:00 TR) | Fetches match and squad data from SofaScore, persists Türkiye Kupası fixtures, refreshes the ESPN-backed UEFA journey cache, writes last-known-good fixture/standings/statistics snapshots, conditionally refreshes completed cup results, refreshes cached images, and cleans up old polls/notification records. Failed provider calls retain the last known-good cache. |
| `checkMatchNotifications` | Every minute | Reads `cache/next3Matches` first (no external API call) and scans user preferences only inside a due reminder window before sending through FCM. |
| `updateLiveMatch` | Every minute | Uses the existing live task for verified ESPN lineup discovery from T-90 (three-minute cadence until T-30, then every minute) and full live tracking in Süper Lig and supported UEFA competitions. Keeps the final live payload for five minutes, archives it durably, and stores the fixture summary. |
| `reconcileTopicSync` | Every 5 minutes | Uses indexed RTDB queries to retry only pending `all_fans` intents or deferred old-token cleanups. |

### Notification System
1. **User Preference**: User selects notification options once (applies to ALL matches)
2. **Database**: Preferences saved to `notifications/{uid}` in Firebase (UID-keyed, requires Google sign-in)
3. **Cloud Function**: Scheduled function checks every minute
   - Reads all three upcoming matches from **cache** (not an external API)
   - Returns immediately outside a due reminder window, without downloading the user preference tree
   - Applies `defaultOptions` to all upcoming matches
   - Retries within a five-minute window and records successful delivery to prevent duplicates
   - Sends the push notification via FCM
4. **Delivery**: Notification arrives on user's device via Service Worker

### Live Match System
- **Flow**: ESPN → `updateLiveMatch` (1/min) → DB `cache/liveMatch` + `cache/lastFinishedMatch` → Users read from DB
- **Match Window**: Verified lineup checks start 90 minutes before kickoff; full live polling starts 30 minutes before kickoff and ends 3 hours after
- **Frontend State Flow**: Countdown → Checking → Live/Post (no misleading pre fallback after kickoff)
- **Leagues**: Süper Lig plus the main and qualifying/play-off feeds for Champions League, Europa League, and Conference League
- **Match Identity Guard**: Live/final cache is shown only when its home team, away team, and available kickoff time match the dashboard's current fixture
- **Cleanup**: Only the transient `liveMatch` payload is deleted five minutes after full time; repeated ESPN polling for that finished fixture then stops
- **Post-Match Persistence**: Final match context remains accessible via `lastFinishedMatch` until the next scheduled fixture changes the dashboard identity

### How to Use Starting XI
1. Sign in with the verified Google account carrying the server-issued `admin` claim, then open **Yönetim** from the profile menu
2. Keep both automation switches off for the first real match and confirm that ESPN detection reaches `ready` with the correct teams and formation preview
3. Publish the detected lineup manually after review, or build exactly 11 Fenerbahçe players in the shared editor when ESPN is incomplete or the competition uses the manual fallback
4. A manual Fenerbahçe publication creates a lock while retaining any detected opponent lineup; **ESPN otomasyonuna dön** releases that lock
5. The lineup tab shows either the published preview or the manual editor, never two pitches at once. **Yayınlanan İlk 11’i Kaldır** removes the public cache entry, preserves the draft and detection, and keeps automation paused so the lineup is not immediately republished
6. After one verified match, enable automatic publishing. Enable automatic Starting XI push only after a later verified match confirms publication behavior
7. Published lineup data is never written by a browser directly. Cloud Functions writes the public cache, while private detection, draft, lock, settings, and audit data remain under `ops`

### Administration Notification Center

1. Prepare and preview an immediate notification in **Yönetim → Bildirim**, then choose `all_fans`, a one-time recipient selection, or a saved recipient group
2. Load the protected user directory only when needed; it returns masked account details and eligibility status without exposing FCM device tokens
3. Save frequently used selections as administrator-owned groups with revision-safe update and deletion controls
4. Send the exact content and audience to the administrator's registered device; changing either invalidates the test approval
5. Confirm the one-time delivery. Topic sends report Firebase acceptance, while targeted sends report only aggregate accepted, failed, and skipped counts

The backend rechecks account state, notification preferences, current device tokens, and saved-group revision immediately before targeted delivery. Invalid current tokens are cleared with compare-and-delete semantics. Notification destinations are limited to the Fan Hub and supported official Fenerbahçe X or Instagram links.

### Fixture System
- **Default Flow**: Frontend Fixture Tab → bounded direct ESPN Team Schedule requests + cached SofaScore `cup-fixtures` supplement
- **Operational Fallback**: Administrator-selected `cache/dataSnapshots/{seasonStartYear}/fixtures`; standings and statistics have independent switches using the same snapshot model
- **Refresh Frequency**: No dataset-level 60-second polling; snapshots refresh at 06:00 TR or through the authenticated admin action
- **Coverage**: Süper Lig, Türkiye Kupası from 2026/27 onward, plus the main and qualifying/play-off feeds for Champions League, Europa League, and Conference League
- **Seasons**: Current season plus the previous two seasons, with July 1 boundaries
- **Data Merge**: ESPN results (`schedule`) + ESPN upcoming fixtures (`schedule?fixture=true`) + persisted SofaScore cup events
- **Historical Safety**: Past seasons default to played matches and reject events outside the selected season
- **Filtering**: Status (All/Played/Remaining), always-visible team search, home/away, competition
- **Summary Details**: Finished ESPN matches use `GET /api/match-summary/:matchId`; Türkiye Kupası summaries remain disabled until a live/detail provider is added

### Europe Journey
- **Flow**: ESPN team schedules + league-phase standings + competition scoreboards → `cache/uefaJourney/{seasonStartYear}` → dashboard summary and full modal
- **Automatic Competition Resolution**: Qualifying stays under the generic `Avrupa Yolculuğu` label; confirmed league-phase participation switches to Champions League, Europa League, or Conference League
- **Route Tracking**: Keeps same-numbered qualifier rounds separate across competition transfers, resolves two-leg aggregate outcomes, and marks direct top-eight qualification, elimination, or a move to a lower competition
- **Knockout Bracket**: Shows only ESPN-published ties; missing future draws are never predicted
- **Mobile PWA Layout**: Uses a full-height modal, plain underline tabs, and a compact horizontally scrollable canvas that keeps every knockout round accessible without vertical page scrolling

### API Cost Optimization
| | Before (v2.1) | After (v2.2) |
|---|---|---|
| SofaScore calls/day | ~1,440 | **2 normally, 3 after a cup match** |
| SofaScore calls/month | ~43,200 | **~60-70** |
| Savings | - | **99.9%** |

## Deployment

### Frontend (GitHub Pages)

Pushes and pull requests targeting `main` run the CI quality gate. A successful
push to `main` automatically runs the gated GitHub Pages deployment job;
feature branches do not deploy the live site.

There is no local `gh-pages` deployment script. Build locally with `npm run build`, then let the reviewed `main` push use the repository's gated deployment workflow.

### Functions (Firebase)

Deploy Cloud Functions only when files under `functions/` or their runtime
configuration change:

```bash
firebase deploy --only functions
```

For releases that change both layers, deploy the backward-compatible Functions backend first. Push the reviewed frontend only after backend verification; that `main` push starts the GitHub Pages deployment.

## Contributing

This is a personal fan project. Suggestions and feedback are welcome!

## License

MIT License - Free to use and modify

## Credits

- **APIs**: SofaScore (RapidAPI), ESPN (Free)
- **Design Inspiration**: Modern sports apps
- **Icons**: Lucide React
- **Team**: Fenerbahçe SK

---

Made with passion for Fenerbahçe fans

**v2.17.0** | August 2026
