# Fenerbahçe Fan Hub 💛💙

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, **live polls**, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Version](https://img.shields.io/badge/version-2.2.0-blue)
![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-Cloud_Functions-orange)

## What's New in v2.2.0 🚀

**Backend Migration to Firebase Cloud Functions**
- ⚡ **Zero Cold Start** - Instant response times (was 30-60s on Render free tier)
- 💰 **99% API Cost Reduction** - From ~1440 to just 2 SofaScore API calls per day
- 🔧 **Simplified Architecture** - Single platform (Firebase) instead of 3 separate services
- 🛡️ **Improved Reliability** - Always-on serverless functions

## Features

### Dashboard
- **Next Match Card**: Live countdown timer with team logos and match details
- **Live Match Tracking**: Real-time score updates, match events (goals, cards, substitutions), and live statistics (Powered by ESPN API)
- **Custom Standings**: Detailed standings for **Trendyol Süper Lig** and **UEFA Europa League**
- **Match Poll**: Interactive "Who will win?" poll with real-time results (Firebase Realtime Database)
- **Push Notifications**: Reliable match reminders via Firebase Cloud Functions
- **Upcoming Matches**: Display next 3 fixtures with dates and opponents
- **Premium UI**: Glassmorphic design with smooth animations

### Push Notification System
- **5 Notification Types**:
  - 3 hours before match
  - 1 hour before match
  - 30 minutes before match
  - 15 minutes before match
  - **Daily Match Check**: Automatically notifies at 09:00 TR if there is a match that day
- **Always-On Delivery**: Powered by **Firebase Cloud Functions** (Serverless)
- **Cross-Platform**: Works on mobile & desktop (PWA support)
- **Beautiful Format**: `💛💙 Fenerbahçe - Opponent | 20:45 · 1 saat kaldı`

### Formation Builder
- **5 Formations**: 4-3-3, 4-4-2, 4-2-3-1, 4-1-4-1, 3-5-2
- **Realistic Pitch**: SVG-based football field with accurate markings
- **Drag & Drop**: Intuitive player placement from squad pool
- **Player Photos**: Dynamic player images from SofaScore API
- **Share Feature**: Export formation as image

## Tech Stack

- **Frontend**: React 19.2 + Vite 5.4
- **Styling**: Tailwind CSS v4
- **Backend**: Firebase Cloud Functions (Serverless)
- **Database**: Firebase Realtime Database (Polls, Cache & User Preferences)
- **APIs**: 
  - SofaScore (via RapidAPI) - Match data, Squad
  - ESPN (Free) - Standings, Live scores
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
└─────────────────┘     │  /api/live-match     (ESPN live)     │
                        │  /api/player-image   (proxy)         │
                        │  /api/team-image     (proxy)         │
                        └──────────────────────────────────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                │   Firebase   │ │   SofaScore  │ │     ESPN     │
                │   Realtime   │ │   (RapidAPI) │ │   (Free)     │
                │   Database   │ │  2 calls/day │ │   Unlimited  │
                └──────────────┘ └──────────────┘ └──────────────┘
```

## Project Structure

```
fenerbahce-fan-hub/
├── functions/
│   ├── index.js           # Firebase Cloud Functions (ALL backend logic)
│   └── package.json       # Functions dependencies
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main dashboard with matches & poll
│   │   ├── Poll.jsx               # Real-time voting component
│   │   ├── FormationBuilder.jsx   # Interactive pitch & formations
│   │   ├── CustomStandings.jsx    # Standings table
│   │   └── LiveMatchScore.jsx     # Live match tracker
│   ├── services/
│   │   └── api.js                 # Firebase API integration
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
| `dailyDataRefresh` | 03:00 UTC (06:00 TR) | Fetches match & squad data from SofaScore, standings from ESPN. Caches everything in Firebase. |
| `checkMatchNotifications` | Every minute | Reads from cache (no API calls), checks user preferences, sends FCM notifications. |

### Notification System
1. **User Preference**: User selects "1 Hour Before" in the UI
2. **Database**: Preference is saved to `notifications/{userId}/matches/{matchId}` in Firebase
3. **Cloud Function**: Scheduled function checks every minute
   - Reads match data from **cache** (not external API!)
   - Scans database for users who want notifications at this time
   - Sends push notification via FCM
4. **Delivery**: Notification arrives on user's device via Service Worker

### Live Match Tracking
- **Data Source**: ESPN API (free, unlimited)
- **Refresh Rate**: Every 30 seconds during live matches
- **Smart Status**: Auto-detects "Live", "Halftime", "Finished"

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
- **Team**: Fenerbahçe SK 💛💙

---

Made with passion for Fenerbahçe fans

**v2.2.0** | December 2025
