# Fenerbahçe Fan Hub

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, **live polls**, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Version](https://img.shields.io/badge/version-2.9.9-blue)
![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Firebase](https://img.shields.io/badge/Firebase-Auth_+_Cloud_Functions-orange)

## What's New in v2.9.9

- **Release Gate for Deploys** - GitHub Pages deploy now waits for the CI quality workflow to succeed and checks out the exact tested commit SHA before publishing
- **Node Runtime Alignment** - CI, Pages build, and Firebase Functions are all pinned to Node 22 to avoid runtime drift between verification and production
- **Notification Race Condition Guards** - Notification preference loading and FCM token sync now abort stale in-flight work so old user sessions cannot overwrite current state or complete stale syncs
- **ESPN Fetch Timeout Hardening** - Shared timeout wrappers now protect live match and ESPN fixture/stat calls from hanging indefinitely when the upstream API is slow
- **Maintenance Cleanup Pass** - Removed dead match bootstrap state, dropped unused `react-router-dom`, and kept API metadata aligned with the current app release

<details>
<summary>Previous: v2.9.8</summary>

- **Quality Gate Hardening** - Added a strict `lint + typecheck + test + build` release gate, plus new Vitest coverage for notification decision helpers and `/api/reminder` endpoint contracts
- **Backend Cleanup Without Behavior Drift** - Removed the legacy backend, split Firebase API handlers into focused modules, and extracted reminder handlers while preserving routes, response shapes, and topic sync behavior
- **App State Orchestration Refactor** - Moved cached match bootstrap, live match polling/state transitions, and foreground messaging setup into dedicated hooks so the app shell is easier to reason about
- **Single Source of Truth for Live Match Data** - `LiveMatchScore` is now prop-driven and no longer performs its own `/live-match` polling, preventing duplicate fetch flows between the app shell and the live modal
- **Notification Settings Maintainability Pass** - Extracted notification storage, server preference load/save flow, draft state management, and token sync into dedicated hooks/helpers without changing UI or notification semantics
- **CI Reliability Fix** - The GitHub Actions quality gate now installs `functions/` dependencies before running tests, keeping reminder contract tests aligned with the local environment

</details>

<details>
<summary>Previous: v2.9.7</summary>

- **Formation Rendering Stabilization** - Single source-of-truth for formation coordinates (`formations.ts`), eliminating duplicate layout data. Preset and numeric formation renderers now use the same canonical coordinate set
- **Role-Aware Player Assignment** - Numeric formation renderer replaced blind `formationPlace` bucket-fill with a global scoring algorithm that matches players to rows by positional depth (DEF→HOLD→MID→AM→FWD), preventing midfielders from appearing in the forward line and vice versa
- **Formation Badge Confidence** - Badge only displays when the rendered formation is verified: preset matches or numeric rows with correct counts and no role mismatches. Uncertain renders (detailed/fallback strategies) hide the badge instead of showing potentially wrong information
- **ESPN Lineup Parsing Hardening** - Removed misuse of `boxscore.form` (recent results, not tactical formation), added `normalizeFormation()` for safe string/object handling, and enriched lineup data with `positionCode`/`formationPlace` fields
- **Turkish Text Fixes** - Fixed 20+ mojibake strings across `LiveMatchScore`, `MatchSummaryModal`, and `playerDisplay` where UTF-8 Turkish characters (ş, ı, ç, İ, ö, ü) were rendered as garbled Latin-1
- **Substitution & Bench UI Polish** - Bench sub-in pills now use the same dark badge design language as pitch overlays. Substitution rows are more compact with subtle backgrounds, slate-toned minute badges, and tighter spacing

</details>

<details>
<summary>Previous: v2.9.6</summary>

- **ESPN Actual Lineups in Post-Match Details** - Completed matches now show the real lineup, formation, bench, and substitutions extracted from ESPN summary data. Visible in both the live match detail modal and the fixture summary modal
- **Dual-Team Toggle with Formation, Bench, and Substitutions** - A shared `MatchLineups` component renders a toggle (defaulting to Fenerbahçe) with a mini pitch visualization, position-aware player placement, bench list, and substitution timeline
- **Dashboard Post-Match Lineup Teaser** - When lineup data is available, the post-match hero card shows a minimal "Kadro ve formasyon detaylarda mevcut" hint without inflating the card; full details open in the existing detail flow
- **Summary Payload Lineup Parsing** - For this app, lineup data is parsed from the ESPN summary response using `rosters` first and `boxscore.players` as a fallback. If neither yields valid starters, `lineups` is `null` and the UI section is silently hidden

</details>

<details>
<summary>Previous: v2.9.5</summary>

- **General Notifications Channel** - Users can now opt in to a general `all_fans` FCM topic for non-match announcements (e.g. Starting XI, club news) alongside per-match reminders
- **DB-First all_fans Topic Sync Recovery** - Topic subscribe/unsubscribe is written as a pending intent to RTDB first; a 5-minute reconciler retries until FCM confirms, surviving cold starts and transient failures
- **Safer Token Rotation and Cleanup** - When a user's FCM token refreshes, the old token is deferred for unsubscribe until the new token's subscribe succeeds, preventing a window where the user receives no topic messages
- **One-Shot Starting XI Push Trigger** - New RTDB trigger (`admin/startingXI/push/requested`) sends a single data-only push to `all_fans` when set to `true`, with payload validation (11 valid starters), publishedAt-based dedupe, and automatic error reporting

</details>

<details>
<summary>Previous: v2.9.4</summary>

- **Atomic Preference Writes** - Notification preference saves now use partial multi-path `update()` instead of `set()`, preventing the scheduler from losing `sentNotifications` or `lastDailyNotification` state during concurrent writes
- **Graceful Invalid Token Handling** - Invalid FCM tokens now clear only the token field and record the failure reason; user notification preferences are preserved so they reactivate when the user returns
- **Tokenless Disable Fix** - Disabling all reminders now persists correctly to the backend even when the client has no local FCM token
- **Stale Local Token Cleanup** - Client now removes the cached FCM token from localStorage when the backend reports no active token, preventing stale tokens from being inadvertently re-registered

</details>

<details>
<summary>Previous: v2.9.3</summary>

- **Atomic Poll Voting** - Match poll writes now go through `POST /api/poll-vote`, where the backend updates vote totals and `users/{uid}` in a single Realtime Database transaction
- **Reusable Google Sign-In Prompt** - Account, poll, and notification flows now share one extracted Google sign-in modal/button instead of carrying duplicated UI in three separate components
- **Configurable Backend Origin** - Frontend API calls and PWA runtime caching now read the same `VITE_BACKEND_ORIGIN` build variable, keeping GitHub Pages builds aligned when the Functions origin changes
- **Baseline HTTP Rate Limiting** - Cloud Functions endpoints now have a lightweight in-memory throttle to blunt obvious abuse while a stronger shared limiter or App Check layer is still pending

</details>

<details>
<summary>Previous: v2.9.2</summary>

- **Starting XI Matchday Module** - Added a dedicated `StartingXIModal` with squad-photo matching from `/api/squad`, showing starters first and bench players in a compact two-column layout
- **Realtime Starting XI Publishing** - Dashboard now listens to `admin/startingXI` in Firebase Realtime Database and only shows the "İlk 11 Açıklandı!" banner when a valid lineup is actually published
- **Notification Click Routing Fix** - Background push notifications now carry `/fenerbahce-fan-hub/` as their target and the service worker focuses or opens the app instead of landing on the root domain
- **README Starting XI Operations Pass** - Documented the `admin/startingXI` schema and the manual operator flow for publishing lineups before kickoff

</details>

<details>
<summary>Previous: v2.9.1</summary>

- **Anonymous Auth Removal** - Removed automatic anonymous Firebase sessions. Signed-out users can browse freely; Google sign-in is now used only when a protected action is attempted
- **PWA Sign-In Hardening** - Added Google redirect result handling and iOS standalone fallback logic to improve authentication flow inside the installed PWA
- **Authenticated Notification API** - `/api/reminder` now verifies Firebase ID tokens instead of trusting a client-sent UID, preventing users from writing preferences for another account
- **Cross-Device Notification Sync** - Notification settings now load from the backend after sign-in, so the UI reflects the server-side source of truth instead of stale local storage
- **Notification Migration Cleanup** - UID-keyed notification records can absorb legacy token-keyed data during save, reducing leftover migration state
- **Scheduler Dedupe by FCM Token** - Notification dispatch now aggregates duplicate UID/token combinations before sending, preventing repeated pushes when stale records exist

</details>
<details>
<summary>Previous: v2.9.0</summary>

- **Firebase Authentication** - Added Google sign-in with automatic anonymous fallback. Users can browse freely; Google sign-in is required only for voting in polls and configuring push notifications
- **User Avatar** - Profile icon in the header with yellow ring indicator when signed in, dropdown menu with account info and sign-out option
- **Auth-Gated Polls** - Poll results are visible to everyone, but voting requires Google sign-in. Vote tracking migrated from `localStorage` to Firebase Auth UID
- **Auth-Gated Notifications** - Notification preferences now require Google sign-in. Storage migrated from FCM token-keyed (`notifications/{token}`) to UID-keyed (`notifications/{uid}`) with backward compatibility
- **Admin Refresh Protection** - `/api/refresh` endpoint now requires `ADMIN_REFRESH_KEY` via header or query param, protecting RapidAPI quota from unauthorized calls
- **Sign-In Modals** - Turkish-localized sign-in prompts appear contextually when anonymous users attempt to vote, configure notifications, or tap the profile icon
- **Firebase RTDB Security Rules** - Auth-based rules: polls validate own-UID write-once voting, notifications restricted to own UID, cache nodes public-read

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
- **Starting XI Banner & Modal**: When `admin/startingXI` is published, users get an instant matchday lineup entry point with shirt-number photo matching and bench coverage
- **Custom Standings**: Detailed standings for **Trendyol Süper Lig** and **UEFA Europa League**
- **Match Poll**: Interactive "Who will win?" poll with real-time results. Votes are validated server-side via `POST /api/poll-vote` and stored atomically in Firebase Realtime Database
- **Push Notifications**: Reliable match reminders via Firebase Cloud Functions. Requires Google sign-in to configure
- **Upcoming Matches**: Display next 3 fixtures with dates and opponents
- **Automatic Data Cleanup**: Old polls and notification records cleaned up daily
- **Premium UI**: Glassmorphic design with smooth animations

### Fixture Explorer
- **Dedicated Fixture Tab**: Separate bottom-nav screen for season fixtures
- **Current Season Timeline**: Shows both completed and upcoming matches in one view
- **Competition Filtering**: Filter by **Süper Lig** or **UEFA Europa League**
- **Home/Away Filter**: Quickly narrow down to home or away fixtures
- **Team Search**: Search fixtures by opponent name
- **Compact Match Cards**: Horizontal team layout with score (or `VS`) and stadium name
- **Manual Refresh**: Re-fetch ESPN fixture data on demand
- **Fixture Match Summary Modal**: For completed matches, opens cached summary data (scoreline, ordered stats, key events, and actual lineups with formation/bench/substitutions when available)

### Push Notification System
- **5 Notification Types**:
  - 3 hours before match
  - 1 hour before match
  - 30 minutes before match
  - 15 minutes before match
  - **Daily Match Check**: Automatically notifies at 09:00 TR if there is a match that day
- **Always-On Delivery**: Powered by **Firebase Cloud Functions** (Serverless)
- **Cross-Platform**: Works on mobile & desktop (PWA support)
- **Beautiful Format**: `Fenerbahçe - Opponent | 20:45 - 1 saat kaldi`

### Statistics
- **Top Scorers**: Ranked list (top 5 expandable to 10) from ESPN roster stats, with Toplam / Süper Lig / Avrupa filters
- **Top Assisters**: Ranked list (top 5 expandable to 10) from ESPN roster stats, with per-competition filtering
- **Team Form**: Interactive SVG trend over the last 6 completed matches (G/B/M trajectory + expandable goal performance and possession trend)
- **Injury, Suspension & Card Risk Status**: Reads from `admin/playerStatus` in Firebase Realtime Database. Displays injured, suspended, doubtful, and card-risk players with status label and return estimate. Card-risk entries highlight players approaching a yellow card suspension threshold

#### `admin/playerStatus` Schema

This node is managed manually via the Firebase Console. Each entry:

```json
{
  "name": "Player Name",
  "status": "injured | suspended | doubtful | card-risk | fit",
  "detail": "Right knee ligament injury",
  "returnDate": "March 2026",
  "updatedAt": 1709500000000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Player display name |
| `status` | `"injured" \| "suspended" \| "doubtful" \| "card-risk" \| "fit"` | Current status. Only non-fit entries are rendered. `card-risk` marks players near a yellow card suspension threshold. |
| `detail` | `string` | Description of injury/suspension |
| `returnDate` | `string` | Estimated return date (free text) |
| `updatedAt` | `number` | Unix timestamp in milliseconds. Used to show "Last updated: X hours ago" |

### Starting XI Publishing
- **Manual RTDB Control**: Reads from `admin/startingXI`; the banner stays hidden until a valid lineup exists
- **Photo Matching**: Players are matched against `/api/squad` photos by jersey number first, then by display name and known aliases as fallback
- **Safe Failure Mode**: Invalid player entries are ignored, and if no valid starters remain the lineup is hidden instead of rendering broken UI

#### `admin/startingXI` Schema

This node is managed manually via the Firebase Console on matchday. Recommended payload:

```json
{
  "publishedAt": 1741282200000,
  "starters": [
    { "name": "Dominik Livakovic", "number": 40, "group": "GK" },
    { "name": "Mert Muldur", "number": 16, "group": "DEF" }
  ],
  "bench": [
    { "name": "Irfan Can Egribayat", "number": 1, "group": "GK" }
  ],
  "push": {
    "requested": false,
    "sentAt": 1741282500000,
    "sentForPublishedAt": 1741282200000,
    "lastError": null
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `publishedAt` | `number` | Unix timestamp in milliseconds. Used for release timing / audit context |
| `starters` | `StartingXIPlayer[]` | Required. If this array has no valid entries, the banner stays hidden |
| `bench` | `StartingXIPlayer[]` | Optional bench list rendered below the starters |
| `group` | `"GK" \| "DEF" \| "MID" \| "FWD"` | Position family used for validation and grouping |
| `number` | `number` | Shirt number used for squad photo matching |
| `push.requested` | `boolean` | Set to `true` to trigger a one-shot push to `all_fans`. Automatically reset to `false` after processing |
| `push.sentAt` | `number` | Timestamp of the last successful push send |
| `push.sentForPublishedAt` | `number` | The `publishedAt` value for which the last push was sent. Used for dedupe |
| `push.lastError` | `string \| null` | Error message from the last failed attempt. `null` on success |

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
- **Database**: Firebase Realtime Database (Polls, Cache & User Preferences)
- **APIs**: 
  - SofaScore (via RapidAPI) - Match data, Squad
  - ESPN (Free) - Standings, Live scores, Fixture schedules
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **PWA**: Installable app with offline support
- **Deployment**: GitHub Pages (frontend) + Firebase Cloud Functions (backend)

## Testing & Quality

### Test Stack

- **Vitest** — test runner (globals mode, jsdom environment)
- **@testing-library/react** — component testing utilities
- **@testing-library/jest-dom** — DOM assertion matchers
- **jsdom** — browser environment simulation

### Quality Commands

| Command | Description |
|---------|-------------|
| `npm run typecheck` | Run `tsc --noEmit` (zero-error TypeScript check) |
| `npm run lint` | Run ESLint on `src/` (TypeScript + React rules) |
| `npm run test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once (CI mode) |
| `npm run build` | Production build (includes service worker generation) |

### Test Coverage

| Area | File | What's tested |
|------|------|---------------|
| ESPN parsing | `functions/services/espn.test.js` | Event flag normalization, summary event filtering, key event parsing, ordered stat picking |
| Formation engine | `src/components/match-lineups/formation-engine.test.ts` | Position classification, formation parsing, preset/numeric/detailed/fallback row building |
| Dashboard helpers | `src/utils/dashboardHelpers.test.ts` | Halftime detection, goal team resolution, goal summary formatting, Starting XI normalization |
| Notification helpers | `src/utils/notificationHelpers.test.ts` | Option creation/normalization, enabled count, match option keys |

Backend tests (`functions/services/espn.test.js`) import from `espn-helpers.js` (pure module, no Firebase dependency) so they run without any mocks or side effects.

### CI Quality Gate

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

**typecheck** → **lint** → **test** → **build**

All four steps must pass for the pipeline to succeed.

## Development Workflow

After making changes, run the quality checks locally before pushing:

```bash
npm run typecheck && npm run lint && npm run test:run && npm run build
```

CI runs the same four steps. If all pass locally, the pipeline will pass.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   GitHub Pages  │     │         Firebase Cloud Functions     │
│    (Frontend)   │────▶│  /api/next-match     (from cache)    │
│                 │     │  /api/standings      (from cache)    │
│  React + Vite   │     │  /api/squad          (from cache)    │
│                 │     │  /api/reminder       (save prefs)    │
└─────────────────┘     │  /api/poll-vote      (vote write)    │
                        │  /api/refresh        (admin-key)     │
                        │  /api/live-match     (from DB cache) │
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
                │   Database   │ │  2 calls/day │ │  ~120/match  │
                │              │ └──────────────┘ └──────────────┘
                │ cache/       │        ▲
                │   liveMatch  │────────┘ updateLiveMatch (1/min)
                │   lastFinishedMatch
                │   squad          ← Statistics tab reads directly
                │   matchSummaries/
                │ admin/       │
                │   playerStatus   ← Manual (Firebase Console)
                │   startingXI     ← Manual matchday publish
                │ match_polls/ │
                │ notifications│
                └──────────────┘
```

Note: The fixture tab fetches ESPN fixture schedules directly from the frontend (CORS-enabled ESPN endpoints) for the current season. Finished fixture detail summaries are served by `/api/match-summary/:matchId` with cache-first backend behavior.

## Project Structure

```
fenerbahce-fan-hub/
├── functions/
│   ├── index.js               # Cloud Functions re-export hub
│   ├── config.js              # Firebase init, secrets, constants, helpers
│   ├── services/
│   │   ├── espn.js            # ESPN data fetching & event parsing
│   │   ├── espn-helpers.js    # Pure ESPN helpers (zero side effects, no Firebase)
│   │   └── sofascore.js       # SofaScore API calls (matches, squad, images)
│   ├── handlers/
│   │   └── api.js             # HTTP endpoint routing & handler functions
│   ├── schedulers/
│   │   ├── dailyRefresh.js    # Daily data refresh (03:00 UTC)
│   │   ├── liveMatch.js       # Live match updater (every 1 min)
│   │   ├── notifications.js   # Match notification checker (every 1 min)
│   │   └── topicSync.js       # all_fans topic reconciler (every 5 min)
│   ├── triggers/
│   │   └── startingXI.js      # One-shot Starting XI push (RTDB trigger)
│   └── package.json           # Functions dependencies
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx              # Main dashboard (orchestrator, helpers in utils/)
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
│   │   └── AuthContext.tsx            # Firebase Auth context (Google sign-in)
│   ├── services/
│   │   ├── api.ts                     # Barrel re-export (preserves import surface)
│   │   └── api/
│   │       ├── base.ts               # BACKEND_ORIGIN, BACKEND_URL, ensureAbsolutePhoto
│   │       ├── poll.ts               # submitPollVote
│   │       ├── fixtures.ts           # fetchNextMatch, fetchSquad, fetchNext3Matches, etc.
│   │       ├── standings.ts          # fetchEspnStandings
│   │       ├── espn-fixtures.ts      # fetchEspnFenerbahceFixtures
│   │       └── statistics.ts         # fetchPlayerStats, fetchFormResults, fetchPlayerStatus
│   ├── data/
│   │   ├── formations.ts             # Formation position definitions
│   │   └── mockData.ts               # Mock player data
│   ├── types/
│   │   └── index.ts                   # Centralized TypeScript type definitions
│   ├── utils/
│   │   ├── dashboardHelpers.ts        # Pure Dashboard logic (halftime, goals, Starting XI)
│   │   ├── notificationHelpers.ts     # FCM token, option normalization helpers
│   │   ├── squadPhotoLookup.ts        # Squad photo matching (jersey/name/alias)
│   │   ├── localize.ts               # Turkish localization for ESPN names
│   │   └── matchClock.ts             # Match clock formatting utility
│   ├── test/
│   │   └── setup.ts                   # Test environment setup
│   ├── firebase.ts                    # Firebase client init (Auth, RTDB, Messaging)
│   ├── App.tsx                        # Main app & routing
│   └── main.tsx                       # React entry point
├── .github/workflows/
│   └── ci.yml                         # CI quality gate (typecheck, lint, test, build)
├── vitest.config.ts                   # Vitest test runner configuration
├── tsconfig.json                      # TypeScript configuration (strict mode)
├── public/                            # Static assets & PWA icons
└── firebase.json                      # Firebase configuration
```

## Installation & Setup

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
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

2. **Configure Secrets**
   
```bash
firebase functions:secrets:set RAPIDAPI_KEY
firebase functions:secrets:set RAPIDAPI_HOST
firebase functions:secrets:set ADMIN_REFRESH_KEY
```

3. **Deploy Functions**

```bash
firebase login
firebase deploy --only functions
```

4. **Initialize Cache**
   ```bash
   curl -H "x-admin-key: YOUR_ADMIN_REFRESH_KEY" https://us-central1-YOUR-PROJECT.cloudfunctions.net/api/refresh
   ```

## How It Works

### Scheduled Functions & Triggers

| Function | Schedule | Description |
|----------|----------|-------------|
| `dailyDataRefresh` | 03:00 UTC (06:00 TR) | Fetches match & squad data from SofaScore, standings from ESPN. Caches in Firebase. Cleans up old polls & notification records. |
| `checkMatchNotifications` | Every minute | Reads from cache (no API calls), checks user preferences, sends FCM notifications. |
| `updateLiveMatch` | Every minute | Checks ESPN for live Fenerbahçe matches (Süper Lig + Europa League) during match window. Writes `cache/liveMatch`, archives final payload to `cache/lastFinishedMatch`, and stores fixture summary in `cache/matchSummaries/{matchId}`. |
| `reconcileTopicSync` | Every 5 minutes | Retries pending `all_fans` topic subscribe/unsubscribe intents until FCM confirms. |
| `onStartingXIPushRequested` | RTDB trigger | Fires when `admin/startingXI/push/requested` transitions to `true`. Validates payload, dedupes by `publishedAt`, sends one-shot push to `all_fans`. |

### Notification System
1. **User Preference**: User selects notification options once (applies to ALL matches)
2. **Database**: Preferences saved to `notifications/{uid}` in Firebase (UID-keyed, requires Google sign-in)
3. **Cloud Function**: Scheduled function checks every minute
   - Reads match data from **cache** (not external API!)
   - Applies `defaultOptions` to all upcoming matches
   - Sends push notification via FCM
4. **Delivery**: Notification arrives on user's device via Service Worker

### Live Match System
- **Flow**: ESPN → `updateLiveMatch` (1/min) → DB `cache/liveMatch` + `cache/lastFinishedMatch` → Users read from DB
- **Match Window**: Starts 30min before kickoff, ends 3 hours after
- **Frontend State Flow**: Countdown → Checking → Live/Post (no misleading pre fallback after kickoff)
- **Leagues**: Süper Lig (`tur.1`) + Europa League (`uefa.europa`)
- **Cleanup**: Live cache deleted 5min after match ends
- **Post-Match Persistence**: Final match context remains accessible via `lastFinishedMatch` fallback

### How to Use Starting XI
1. Refresh the cache if kickoff time or opponent data changed (`/api/refresh` with `ADMIN_REFRESH_KEY`)
2. Open Firebase Realtime Database and write the lineup to `admin/startingXI`
3. Verify the dashboard shows the "İlk 11 Açıklandı!" banner and that the modal renders the expected starters/bench
4. To send a push notification, set `admin/startingXI/push/requested` to `true`. The trigger validates the payload (11 valid starters, valid `publishedAt`), sends a one-shot data-only push to `all_fans`, and resets `requested` to `false`. Check `push/lastError` if the push did not go through
5. During the match, use the dashboard/live modal for the real-time view; after the match, use the fixture summary modal for the stored recap
6. When the lineup is no longer relevant, overwrite `admin/startingXI` for the next match or delete/set it to `null` to hide the banner again

### Fixture System
- **Flow**: Frontend Fixture Tab → ESPN Team Schedule endpoints (free, client-side fetch)
- **Coverage**: Süper Lig (`tur.1`) + UEFA Europa League (`uefa.europa`)
- **Data Merge**: Results (`schedule`) + upcoming fixtures (`schedule?fixture=true`)
- **Filtering**: Status (All/Played/Remaining), team search, home/away, competition
- **Summary Details**: Finished-match modal uses `GET /api/match-summary/:matchId` (cache-first, ESPN fallback on cache miss)

### API Cost Optimization
| | Before (v2.1) | After (v2.2) |
|---|---|---|
| SofaScore calls/day | ~1,440 | **2** |
| SofaScore calls/month | ~43,200 | **~60** |
| Savings | - | **99.9%** |

## Deployment

### Frontend (GitHub Pages)

```bash
npm run build
npm run deploy
```

### Functions (Firebase)

```bash
firebase deploy --only functions
```

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

**v2.9.9** | March 2026
