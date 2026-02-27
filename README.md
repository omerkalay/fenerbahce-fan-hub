# Fenerbahce Fan Hub

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, **live polls**, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Version](https://img.shields.io/badge/version-2.6.1-blue)
![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-Cloud_Functions-orange)

## What's New in v2.6.1

- **FCM Token Auto-Sync** - The app now detects FCM token refreshes on every launch and silently re-registers the new token with the backend, preventing missed notifications caused by stale tokens
- **Foreground Notification Handler** - Added `onMessage` handler so push notifications are displayed even when the app is actively open in the browser
- **Wider Notification Trigger Window** - Expanded the scheduled notification check window from 2 minutes to 5 minutes to account for Cloud Scheduler timing variance

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
<summary>Previous: v2.5.3</summary>

- **Live Event Feed Expanded (ESPN)** - Added substitution events by merging ESPN `summary.keyEvents` with the existing live scoreboard event feed
- **Duplicate Event Protection** - Live event timeline now deduplicates merged events (clock/team/type/player based) while preserving chronological order
- **Penalty Goal Labels** - Penalty goals now display a clear ` (P)` suffix in live event rows
- **Halftime UI Polish** - `HT` / halftime states now render as `Devre Arası` in live UI (detail modal keeps the exact clock value visible)
- **Cleaner Dashboard Event Preview** - Substitutions are shown in the detail modal timeline, but hidden from the compact dashboard event list to reduce noise

</details>

<details>
<summary>Previous: v2.5.2</summary>

- **Live Match Stats Cleanup** - Reordered live match statistics to prioritize shots, possession, corners, fouls, and cards
- **Removed Noisy Stats** - Hidden less useful rows such as assists/goals from the live stats panel (score already covers goals)
- **Card Stats Added** - Yellow/red card counts are now derived from ESPN live match events and displayed in the stats list

</details>

<details>
<summary>Previous: v2.5.1</summary>

- **Formation Builder Position Persistence Fix** - Fixed a bug where selected forwards could disappear or become unselectable after switching formations (for example from `4-2-3-1` to `4-1-2-1-2 Diamond`)
- **Active Formation Deduplication Fix** - Player duplicate checks now consider only active formation slots, preventing hidden slots from incorrectly blocking player selection
- **Formation Transition Mapping** - Existing players are remapped to compatible role families (defense/midfield/attack) when formation changes, reducing accidental lineup loss
- **Mobile Scroll Performance Improvements** - Improved touch scrolling smoothness in the player pool and selection modal by tuning overscroll behavior and reducing heavy card blur effects

</details>

<details>
<summary>Previous: v2.5.0</summary>

- **Fixture Tab (New)** - Added a dedicated fixture screen in the bottom navigation with a modern mobile-first layout
- **ESPN Fixture Integration** - Pulls Fenerbahçe fixtures directly from ESPN (free) with current season schedule support
- **Played + Upcoming Merge** - Combines completed matches and upcoming matches into a single timeline view
- **Multi-Competition Coverage** - Includes both Turkish Super Lig and UEFA Europa League fixtures
- **Advanced Fixture Filters** - Added status filters (`All`, `Played`, `Remaining`) plus search, home/away, and competition filters
- **Fixture UI Localization** - Displays team names in Turkish-friendly form (for example `Fenerbahce` -> `Fenerbahçe`)
- **Venue Display Override** - Home venue display is normalized to the current stadium naming in the fixture cards

</details>

<details>
<summary>Previous: v2.4.2</summary>

- **Notification Reliability Fixes** - Improved FCM service worker registration scope to avoid conflicts with the PWA service worker
- **Delivery Tracking Fix** - Notification send records are now stored only after successful FCM delivery attempts
- **Token Cleanup** - Invalid FCM tokens are automatically removed after failed sends
- **Timezone Consistency** - Daily match check date comparison is normalized for Istanbul time

</details>

<details>
<summary>Previous: v2.4.1</summary>

- **New Formation** - Added 4-1-2-1-2 Diamond (Baklava) to the Formation Builder

</details>

<details>
<summary>Previous: v2.4.0</summary>

**Live Match Auto-Transition System**
- **Automatic Live Mode** - Dashboard transitions from countdown to live mode when match starts
- **Inline Live Score** - Score, match events, and stats displayed directly in the match card
- **Post-Match Transition** - Automatically switches to next match 30 seconds after game ends
- **Automatic Data Cleanup** - Old poll and notification records are purged from DB daily
- **DB Cache Architecture** - ESPN data cached in Firebase Realtime DB; all users read from cache
- **Multi-League Support** - Live match detection covers both Super Lig and UEFA Europa League
</details>

<details>
<summary>Previous: v2.3.0</summary>

**Formation Builder Improvements**
- **Web Share API** - Share your lineup directly to WhatsApp, Telegram, Twitter
- **Improved Pitch Design** - Professional SVG pitch with FIFA-standard markings
- **Optimized Positions** - Player positions aligned with pitch markings
- **Drag and Drop Fix** - Fixed card dragging issue on desktop browsers
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

- **Frontend**: React 19.2 + Vite 5.4
- **Styling**: Tailwind CSS v4
- **Backend**: Firebase Cloud Functions (Serverless)
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
│   │   ├── Dashboard.jsx          # Main dashboard with matches & poll
│   │   ├── FixtureSchedule.jsx    # Fixture tab with ESPN-backed filters
│   │   ├── NotificationSettings.jsx # Global notification preferences
│   │   ├── Poll.jsx               # Real-time voting component
│   │   ├── FormationBuilder.jsx   # Interactive pitch & formations
│   │   ├── CustomStandings.jsx    # Standings table
│   │   └── LiveMatchScore.jsx     # Live match tracker
│   ├── services/
│   │   └── api.js                 # Firebase API integration + ESPN fixture aggregation
│   ├── firebase.js                # Firebase client initialization
│   ├── App.jsx                    # Main app & routing
│   └── main.jsx                   # React entry point
├── public/                        # Static assets & PWA icons
├── backend/                       # [DEPRECATED] Old Render.com backend (kept for rollback)
└── firebase.json                  # Firebase configuration
```

> **Note:** The `backend/` folder contains the old Express.js server that ran on Render.com. It's kept for emergency rollback purposes. To rollback, change `BACKEND_URL` in `src/services/api.js` back to `https://fenerbahce-backend.onrender.com`.

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

**v2.6.1** | February 2026
