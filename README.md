# Fenerbahce Fan Hub

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, **live polls**, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Version](https://img.shields.io/badge/version-2.7.0-blue)
![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Firebase](https://img.shields.io/badge/Firebase-Cloud_Functions-orange)

## What's New in v2.7.0

- **Full TypeScript Migration** - Entire frontend codebase migrated from JavaScript/JSX to TypeScript/TSX with strict mode enabled. All components, hooks, services, and utilities are now fully typed with zero build errors
- **Centralized Type System** - Created `src/types/index.ts` with comprehensive type definitions for all API responses (ESPN, SofaScore, Firebase), component props, and application state
- **Component Refactoring** - Large monolithic components split into focused sub-components and custom hooks:
  - `FixtureSchedule` (766 → 466 lines): Extracted `useFixtureData` hook and `MatchSummaryModal` component
  - `Dashboard` (502 → 352 lines): Extracted `MatchCountdown`, `NextMatchesPanel`, `StandingsModal`, `LiveMatchModal`
  - `FormationBuilder` (576 → 371 lines): Extracted `PlayerSelectionModal`, `PlayerPool`, and `formations` data module
- **Custom Hooks** - New `src/hooks/useFixtureData.ts` encapsulates all fixture data fetching, filtering, and modal state management
- **TypeScript Infrastructure** - Added `tsconfig.json` with strict mode, `vite-env.d.ts` with typed environment variables, and `@types/node` for Node.js type support

<details>
<summary>Previous: v2.6.2</summary>

- **Standings Direct from ESPN** - Standings are now fetched directly from ESPN on the client side instead of going through the backend cache, providing always up-to-date league tables without 24-hour staleness
- **Backend Standings Removal** - Removed standings fetch from `dailyDataRefresh` and `handleRefresh` Cloud Functions, reducing scheduled function runtime and Firebase read/write costs
- **Notification Scheduler Hardening** - Rewrote `checkMatchNotifications` to read only `cache/next3Matches` instead of the full cache tree, use `Intl.DateTimeFormat.formatToParts` for reliable Istanbul timezone calculation, widen daily check window, add `sentForMatch` type safety, and fix `Object.assign` accumulation bug for sent records
- **Live Match Cache Read Optimization** - `updateLiveMatch` now reads only `cache/nextMatch` instead of the full cache tree
- **Post-Match Cleanup Fix** - Fixed `postMarkedAt` logic that never triggered because it read from the freshly built live data object instead of the existing cache value
- **Token Lifecycle Cleanup** - Both manual save and auto-sync now send the previous token to the backend for immediate deletion, preventing zombie token accumulation in the database
- **Daily Cleanup Date Format Fix** - Fixed `lastDailyNotification` cleanup using mismatched date formats (`toDateString` vs `formatDateKey`)

</details>

<details>
<summary>Previous: v2.6.1</summary>

- **FCM Token Auto-Sync** - The app now detects FCM token refreshes on every launch and silently re-registers the new token with the backend, preventing missed notifications caused by stale tokens
- **Foreground Notification Handler** - Added `onMessage` handler so push notifications are displayed even when the app is actively open in the browser
- **Wider Notification Trigger Window** - Expanded the scheduled notification check window from 2 minutes to 5 minutes to account for Cloud Scheduler timing variance

</details>

<details>
<summary>Previous: v2.6.0</summary>

- **Fixture Match Summary Modal (Cache-First)** - Added match statistics flow for finished fixtures with backend endpoint `GET /api/match-summary/:matchId`
- **Persistent Post-Match Continuity** - Added `cache/lastFinishedMatch` fallback so the home card can keep final score/events after `cache/liveMatch` is cleaned
- **Stored Match Summaries** - Added `cache/matchSummaries/{matchId}` storage and preservation across daily refresh/manual refresh
- **Live State Reliability Upgrade** - Improved `no-match` handling to prevent incorrect pre-match rendering after kickoff; frontend now uses an explicit `checking` state
- **Event Pipeline Normalization** - Improved ESPN event normalization/deduplication to avoid conflicting event flags and support assist extraction for goal events
- **UI and Localization Polish** - Added `(P)` penalty marker, normalized stoppage-time clock format (`90+5'`), localized `FT` to `Mac Sonu`, and improved fixture summary header visuals

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
- **Custom Standings**: Detailed standings for **Trendyol Süper Lig** and **UEFA Europa League**
- **Match Poll**: Interactive "Who will win?" poll with real-time results (Firebase Realtime Database)
- **Push Notifications**: Reliable match reminders via Firebase Cloud Functions
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
- **Fixture Match Summary Modal**: For completed matches, opens cached summary data (scoreline, ordered stats, key events)

### Push Notification System
- **5 Notification Types**:
  - 3 hours before match
  - 1 hour before match
  - 30 minutes before match
  - 15 minutes before match
  - **Daily Match Check**: Automatically notifies at 09:00 TR if there is a match that day
- **Always-On Delivery**: Powered by **Firebase Cloud Functions** (Serverless)
- **Cross-Platform**: Works on mobile & desktop (PWA support)
- **Beautiful Format**: `Fenerbahce - Opponent | 20:45 - 1 saat kaldi`

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
- **Backend**: Firebase Cloud Functions (Serverless, JS)
- **Database**: Firebase Realtime Database (Polls, Cache & User Preferences)
- **APIs**: 
  - SofaScore (via RapidAPI) - Match data, Squad
  - ESPN (Free) - Standings, Live scores, Fixture schedules
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **PWA**: Installable app with offline support
- **Deployment**: GitHub Pages (frontend) + Firebase Cloud Functions (backend)

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│   GitHub Pages  │     │         Firebase Cloud Functions     │
│    (Frontend)   │────▶│  /api/next-match     (from cache)    │
│                 │     │  /api/standings      (from cache)    │
│  React + Vite   │     │  /api/squad          (from cache)    │
│                 │     │  /api/reminder       (save prefs)    │
└─────────────────┘     │  /api/live-match     (from DB cache) │
                        │  /api/match-summary  (cache-first)    │
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
                │   matchSummaries/
                │ match_polls/ │
                │ notifications│
                └──────────────┘
```

Note: The fixture tab fetches ESPN fixture schedules directly from the frontend (CORS-enabled ESPN endpoints) for the current season. Finished fixture detail summaries are served by `/api/match-summary/:matchId` with cache-first backend behavior.

## Project Structure

```
fenerbahce-fan-hub/
├── functions/
│   ├── index.js           # Firebase Cloud Functions (ALL backend logic)
│   └── package.json       # Functions dependencies
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx          # Main dashboard with matches & poll
│   │   ├── MatchCountdown.tsx     # Countdown timer sub-component
│   │   ├── NextMatchesPanel.tsx   # Upcoming 3 matches panel
│   │   ├── LiveMatchModal.tsx     # Live match detail modal
│   │   ├── StandingsModal.tsx     # Standings modal wrapper
│   │   ├── FixtureSchedule.tsx    # Fixture tab with ESPN-backed filters
│   │   ├── MatchSummaryModal.tsx  # Match statistics modal
│   │   ├── FormationBuilder.tsx   # Interactive pitch & formations
│   │   ├── PlayerSelectionModal.tsx # Player picker modal
│   │   ├── PlayerPool.tsx         # Draggable player grid
│   │   ├── NotificationSettings.tsx # Global notification preferences
│   │   ├── Poll.tsx               # Real-time voting component
│   │   ├── CustomStandings.tsx    # Standings table
│   │   ├── LiveMatchScore.tsx     # Live match tracker
│   │   ├── MatchEventIcon.tsx     # Match event icon renderer
│   │   └── TeamLogo.tsx           # Team logo with fallback
│   ├── hooks/
│   │   └── useFixtureData.ts      # Fixture data fetching & filtering hook
│   ├── services/
│   │   └── api.ts                 # Firebase API integration + ESPN fixture aggregation
│   ├── data/
│   │   ├── formations.ts          # Formation position definitions
│   │   └── mockData.ts            # Mock player data
│   ├── types/
│   │   └── index.ts               # Centralized TypeScript type definitions
│   ├── utils/
│   │   └── matchClock.ts          # Match clock formatting utility
│   ├── firebase.ts                # Firebase client initialization
│   ├── App.tsx                    # Main app & routing
│   └── main.tsx                   # React entry point
├── tsconfig.json                  # TypeScript configuration (strict mode)
├── public/                        # Static assets & PWA icons
├── backend/                       # [DEPRECATED] Old Render.com backend (kept for rollback)
└── firebase.json                  # Firebase configuration
```

> **Note:** The `backend/` folder contains the old Express.js server that ran on Render.com. It's kept for emergency rollback purposes. To rollback, change `BACKEND_URL` in `src/services/api.ts` back to `https://fenerbahce-backend.onrender.com`.

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
```

3. **Deploy Functions**

```bash
firebase login
firebase deploy --only functions
```

4. **Initialize Cache**
   Visit: `https://us-central1-YOUR-PROJECT.cloudfunctions.net/api/refresh`

## How It Works

### Scheduled Functions

| Function | Schedule | Description |
|----------|----------|-------------|
| `dailyDataRefresh` | 03:00 UTC (06:00 TR) | Fetches match & squad data from SofaScore, standings from ESPN. Caches in Firebase. Cleans up old polls & notification records. |
| `checkMatchNotifications` | Every minute | Reads from cache (no API calls), checks user preferences, sends FCM notifications. |
| `updateLiveMatch` | Every minute | Checks ESPN for live Fenerbahçe matches (Süper Lig + Europa League) during match window. Writes `cache/liveMatch`, archives final payload to `cache/lastFinishedMatch`, and stores fixture summary in `cache/matchSummaries/{matchId}`. |

### Notification System
1. **User Preference**: User selects notification options once (applies to ALL matches)
2. **Database**: Preferences saved to `notifications/{userId}/defaultOptions` in Firebase
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
- **Team**: Fenerbahce SK

---

Made with passion for Fenerbahçe fans

**v2.7.0** | February 2026
