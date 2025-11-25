# Fenerbahçe Fan Hub 💛💙

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.4.21-purple)
![OneSignal](https://img.shields.io/badge/OneSignal-Push_Notifications-red)

## Features

### Dashboard
- **Next Match Card**: Live countdown timer with team logos and match details
- **Push Notifications**: 💛💙 Real-time match reminders via OneSignal
- **Upcoming Matches**: Display next 3 fixtures with dates and opponents
- **Premium UI**: Glassmorphic design with smooth animations

### Push Notification System 🔔
- **5 Notification Types**:
  - 3 hours before match
  - 1 hour before match
  - 30 minutes before match
  - 15 minutes before match
  - Daily match check (09:00 TR every day)
- **Smart Scheduling**: Automatic notification delivery via cron jobs
- **OneSignal Integration**: Professional push notification service
- **Cross-Platform**: Works on mobile & desktop (even when app is closed)
- **Beautiful Format**: `💛💙 Fenerbahçe - Opponent | 20:45 · 1 saat kaldı`

### Formation Builder
- **5 Formations**: 4-3-3, 4-4-2, 4-2-3-1, 4-1-4-1, 3-5-2
- **Realistic Pitch**: SVG-based football field with accurate markings
- **Drag & Drop**: Intuitive player placement from squad pool
- **Click to Add**: Modal-based player selection for empty positions
- **Player Photos**: Dynamic player images from SofaScore API
- **Share Feature**: Export formation as image

## Tech Stack

- **Frontend**: React 19.2 + Vite 5.4
- **Styling**: Tailwind CSS v4
- **Backend**: Express.js with cron jobs
- **API**: SofaScore (via RapidAPI)
- **Push Notifications**: OneSignal Web Push SDK
- **Caching**: Backend in-memory cache + Service Worker
- **PWA**: Installable app with offline support
- **Deployment**: GitHub Pages (frontend) + Render (backend)

## Project Structure

```
fenerbahce-fan-hub/
├── backend/
│   ├── server.js                  # Express API with cron job
│   └── package.json               # Backend dependencies
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main dashboard with matches
│   │   ├── FormationBuilder.jsx   # Interactive pitch & formations
│   │   ├── SquadBuilder.jsx       # Squad management (legacy)
│   │   ├── SquadList.jsx          # Player list view
│   │   ├── ProbableLineup.jsx     # Lineup component
│   │   └── TeamLogo.jsx           # Logo component
│   ├── services/
│   │   └── api.js                 # Backend API integration
│   ├── data/
│   │   └── mockData.js            # Mock data for development
│   ├── App.jsx                    # Main app & routing
│   ├── index.css                  # Global styles & glassmorphism
│   └── main.jsx                   # React entry point
├── public/                        # Static assets & PWA icons
├── vite.config.js                 # Vite + PWA configuration
└── tailwind.config.js             # Tailwind v4 theme
```

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- RapidAPI key for SofaScore (for backend only)

### Frontend Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/fenerbahce-fan-hub.git
cd fenerbahce-fan-hub
```

2. **Install frontend dependencies**

```bash
npm install
```

3. **Run development server**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

4. **Build for production**

```bash
npm run build
```

### Backend Setup (Optional for local development)

1. **Navigate to backend directory**

```bash
cd backend
```

2. **Install backend dependencies**

```bash
npm install
```

3. **Configure environment**

Create `backend/.env` file:

```env
# RapidAPI (Required)
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=sofascore.p.rapidapi.com

# OneSignal (Required for push notifications)
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key

# Server Configuration
PORT=3001
CRON_SCHEDULE=0 6 * * *
PUBLIC_BASE_URL=http://localhost:3001
```

4. **Run backend server**

```bash
npm start
```

Backend will run on [http://localhost:3001](http://localhost:3001)

### OneSignal Setup (For Push Notifications)

1. **Create OneSignal Account**
   - Visit [https://onesignal.com/](https://onesignal.com/)
   - Sign up for free account

2. **Create Web App**
   - Dashboard → New App/Project
   - Select "Web" platform
   - Enter **your site URL** (e.g., `https://yourusername.github.io`)

3. **Get Credentials**
   - Go to Settings → Keys & IDs
   - Copy **App ID**
   - Copy **REST API Key**

4. **Add to Backend .env**
   ```env
   ONESIGNAL_APP_ID=your_app_id_here
   ONESIGNAL_REST_API_KEY=your_rest_api_key_here
   ```

5. **Update Frontend**
   - Edit `index.html` → Find OneSignal init code
   - Replace `appId` with your App ID
   - Replace `safari_web_id` if provided by OneSignal

**Free Tier Limits:**
- ✅ 10,000 subscribers
- ✅ Unlimited notifications
- ✅ Perfect for fan apps!

## Deployment

### Frontend (GitHub Pages)

1. Update `vite.config.js` base path:

```js
export default defineConfig({
  base: '/fenerbahce-fan-hub/',
  // ...
})
```

2. Build and deploy:

```bash
npm run build
npm run deploy
```

### Backend (Render)

The backend is deployed on Render with automatic daily data fetching and push notification management.

**Backend Architecture:**
- Express.js server with CORS and rate limiting
- **Cron Jobs**:
  - Data fetch: `0 6 * * *` (06:00 TR daily)
  - Daily match check: `0 9 * * *` (09:00 TR daily - checks if match today)
  - Legacy reminder cron `* * * * *` only when `USE_ONESIGNAL_SCHEDULER=false`
- In-memory cache for match/squad data (updated daily)
- Reminder metadata:
  - `matchReminders` array (per user + match, tracks scheduled OneSignal IDs)
  - `dailyCheckSubscribers` Set (global subscribers)
  - `sentDailyNotifications` Map (deduplication)
- OneSignal REST API integration (modern, no SDK needed) with **scheduled sends** by default
- Image proxy for SofaScore photos (CORS bypass)
- Rate limiting: 100 req/15min (general), 20 req/15min (reminders)

**Environment Variables (Render):**

```env
# RapidAPI
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=sofascore.p.rapidapi.com

# OneSignal
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key

# Server
PORT=3001
CRON_SCHEDULE=0 6 * * *
PUBLIC_BASE_URL=https://fenerbahce-backend.onrender.com
```

## API Integration

### Architecture

```
User Browser → Backend (Render) → SofaScore API
                ↑
           In-Memory Cache
         (Updates daily via cron)
```

**Benefits:**
- 1000 users = 1 API call per day
- ~1000x reduction in API quota usage
- Free Render tier is sufficient
- Automatic daily updates
- Image proxy for player photos

**API Endpoints:**
- `GET /api/next-match` - Next match data
- `GET /api/next-3-matches` - Upcoming 3 matches
- `GET /api/squad` - Team squad with player photos
- `GET /api/player-image/:id` - Player photo proxy (CORS bypass)
- `GET /api/team-image/:id` - Team logo proxy (CORS bypass)
- `GET /api/health` - Backend health check & notification stats
- `GET /api/refresh` - Manual cache refresh
- `POST /api/reminder` - Save/update notification preferences (body: `{playerId, matchId?, options}`)
- `GET /api/reminder/:playerId` - Get user's reminders (returns `{matchReminders, dailyCheckActive}`)
- `DELETE /api/reminder/:playerId` - Delete all reminders for user
- `DELETE /api/reminder/:playerId/:matchId` - Delete specific match reminder

## Design Features

- **Glassmorphism**: Modern frosted glass aesthetic with backdrop blur
- **Gradient Backgrounds**: Dynamic yellow/blue Fenerbahçe theme
- **Smooth Animations**: 200-300ms transitions throughout
- **Mobile-First**: Optimized for phone screens
- **Dark Mode**: Premium dark theme by default
- **PWA Support**: Installable app with offline capabilities

## PWA Features

- **Installable**: Add to home screen on mobile and desktop
- **Offline Support**: Service worker caching for API calls
- **Push Notifications**: Work even when app is closed (via Service Worker)
- **App-like Experience**: Standalone display mode
- **Custom Icons**: Fenerbahçe-themed app icons
- **Smart Caching**: NetworkFirst for API, CacheFirst for images

## How Push Notifications Work

### User Flow

1. **First Visit**
   - OneSignal SDK v16 initializes automatically
   - User clicks notification bell icon
   - Browser requests notification permission
   - User grants permission → OneSignal generates unique `Player ID` (device identifier)

2. **User Sets Reminder**
   - User clicks bell icon (🔔) on match card
   - Selects notification options (3h, 1h, 30min, 15min, daily check)
   - Frontend sends: `{ playerId, matchId, options }` → Backend
   - Backend saves:
     - **Time-based reminders** → `matchReminders` array (tied to specific match)
     - **Daily check** → `dailyCheckSubscribers` Set (global, applies to all matches)

3. **Backend Schedules/Sends Notifications**
   - **Match reminders (default)**:
     - Backend calculates the exact UTC timestamp for each selected option (3h, 1h, 30dk, 15dk)
     - Uses OneSignal REST API with `send_after` + `external_id` to schedule delivery
     - OneSignal stores and delivers reminders even if backend sleeps/restarts
  
   - **Legacy fallback**:
     - Set `USE_ONESIGNAL_SCHEDULER=false` to revert to per-minute cron delivery (development/testing)

   - **Every Day at 09:00 TR (Daily check)**:
     - Backend checks if there's a Fenerbahçe match TODAY
     - If yes, sends notification to all `dailyCheckSubscribers`
     - Uses deduplication to prevent multiple notifications per day per match

4. **User Receives Notification**
   - Notification appears on phone/desktop (native OS notification)
   - Works even if:
     - ✅ App is closed
     - ✅ Browser is closed (PWA/Service Worker mode)
     - ✅ Phone is locked
   - Format: `💛💙 Fenerbahçe - Opponent | 20:45 · 1 saat kaldı`

### Technical Architecture

```
┌─────────────────────────────────────────────────┐
│  User Browser (PWA)                             │
│  ├─ React App                                   │
│  ├─ OneSignal SDK (get Player ID)              │
│  └─ Service Worker (receive push notifications)│
└─────────────────────────────────────────────────┘
                    ↓ (save reminder)
┌─────────────────────────────────────────────────┐
│  Backend (Render)                               │
│  ├─ Express API                                 │
│  ├─ Reminder metadata storage                  │
│  ├─ OneSignal scheduling (send_after)          │
│  └─ Cron: Daily match check (09:00 TR)         │
└─────────────────────────────────────────────────┘
                    ↓ (send notification)
┌─────────────────────────────────────────────────┐
│  OneSignal Service                              │
│  ├─ Manages Player IDs                          │
│  ├─ Delivers push notifications                 │
│  └─ Cross-platform (Web, Android, iOS)         │
└─────────────────────────────────────────────────┘
                    ↓
          User's Device (Notification!)
```

### Cron Jobs

| Schedule | Purpose | Timezone |
|----------|---------|----------|
| `0 6 * * *` | Fetch match/squad data from SofaScore | Europe/Istanbul |
| `0 9 * * *` | Daily match check (Günlük Maç Kontrolü) | Europe/Istanbul |
| `* * * * *` | Legacy reminder cron (only if scheduler disabled) | Europe/Istanbul |

## Environment Variables

### Backend (.env in backend/)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RAPIDAPI_KEY` | RapidAPI key for SofaScore | - | ✅ Yes |
| `RAPIDAPI_HOST` | API host endpoint | `sofascore.p.rapidapi.com` | No |
| `ONESIGNAL_APP_ID` | OneSignal App ID for push notifications | - | ✅ Yes |
| `ONESIGNAL_REST_API_KEY` | OneSignal REST API Key | - | ✅ Yes |
| `USE_ONESIGNAL_SCHEDULER` | `true` to schedule reminders inside OneSignal | `true` | No |
| `PORT` | Server port | `3001` | No |
| `CRON_SCHEDULE` | Cron schedule for data fetch | `0 6 * * *` | No |
| `PUBLIC_BASE_URL` | Backend URL for image proxying | Auto-detected | No |
| `DISABLE_CRON` | Disable automatic data fetch cron | `false` | No |

### Frontend (Hardcoded)

- **Backend API URL**: `https://fenerbahce-backend.onrender.com` (in `src/services/api.js`)
- **OneSignal App ID**: `25104d87-07ab-4c4c-b429-2f5f37d18cdb` (in `index.html`)

No `.env` file needed for frontend.

## Development Scripts

### Frontend

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run deploy       # Deploy to GitHub Pages
```

### Backend

```bash
npm start            # Start backend server (localhost:3001)
npm run dev          # Start backend (development mode)
```

## Known Issues & Limitations

- SofaScore API has daily quota limits (mitigated by backend caching)
- Backend cold starts on Render free tier (~30-60 seconds on first request)
- Player photos depend on SofaScore availability
- Reminder metadata is stored in-memory (lost on backend restart), but the actual notifications are scheduled inside OneSignal so they still fire even if the server sleeps
- Match data is fetched from cache (updated daily), so notifications use real-time data
- For production with 10K+ users, consider using Redis/MongoDB for reminder persistence

## Contributing

This is a personal fan project. Suggestions and feedback are welcome!

## License

MIT License - Free to use and modify

## Credits

- **API**: SofaScore via RapidAPI
- **Design Inspiration**: Modern sports apps
- **Icons**: Lucide React
- **Team**: Fenerbahçe SK

---

Made with passion for Fenerbahçe fans
