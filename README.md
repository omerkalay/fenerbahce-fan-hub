# Fenerbahçe Fan Hub 💛💙

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, **live polls**, squad management, formation builder, **push notifications**, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.4.21-purple)
![Firebase](https://img.shields.io/badge/Firebase-Cloud_Functions-orange)

## Features

### Dashboard
### Dashboard
- **Next Match Card**: Live countdown timer with team logos and match details
- **Live Match Tracking**: Real-time score updates, match events (goals, cards, substitutions), and live statistics (possession, shots, etc.) with custom Fenerbahçe styling (Powered by ESPN API)
- **Custom Standings**: Detailed standings for **Trendyol Süper Lig** and **UEFA Europa League**, fully integrated with custom design
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
  - **Daily Match Check**: Automatically checks at 09:00 TR every morning and notifies if there is a match that day.
- **Always-On Delivery**: Powered by **Firebase Cloud Functions** (Serverless). Works even if the website is closed or the backend server is sleeping.
- **Cross-Platform**: Works on mobile & desktop (PWA support).
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
- **Backend**: Express.js (Data Fetching) + Firebase Cloud Functions (Notifications)
- **Database**: Firebase Realtime Database (Polls & User Preferences)
- **API**: SofaScore (via RapidAPI)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **PWA**: Installable app with offline support
- **Deployment**: GitHub Pages (frontend) + Render (backend) + Firebase (functions)

## Project Structure

```
fenerbahce-fan-hub/
├── backend/
│   ├── server.js                  # Express API (Data fetching only)
│   └── package.json               # Backend dependencies
├── functions/
│   ├── index.js                   # Firebase Cloud Functions (Notifications)
│   └── package.json               # Functions dependencies
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main dashboard with matches & poll
│   │   ├── Poll.jsx               # Real-time voting component
│   │   ├── FormationBuilder.jsx   # Interactive pitch & formations
│   │   └── ...
│   ├── services/
│   │   └── api.js                 # Backend API integration
│   ├── firebase.js                # Firebase client initialization
│   ├── App.jsx                    # Main app & routing
│   └── main.jsx                   # React entry point
├── public/                        # Static assets & PWA icons
└── firebase.json                  # Firebase configuration
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

2. **Install frontend dependencies**

```bash
npm install
```

3. **Configure Firebase**
   - Create `.env` file with your Firebase config:
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

### Backend Setup (Data Fetcher)

1. **Navigate to backend directory**

```bash
cd backend
npm install
```

2. **Configure environment**
   Create `backend/.env`:

```env
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=sofascore.p.rapidapi.com
PORT=3001
```

3. **Run backend server**

```bash
npm start
```

### Firebase Cloud Functions Setup (Notifications)

1. **Navigate to functions directory**

```bash
cd functions
npm install
```

2. **Configure Environment**
   Create `functions/.env` with your API keys:
   ```env
   RAPIDAPI_KEY=your_rapidapi_key
   RAPIDAPI_HOST=sofascore.p.rapidapi.com
   ```

2. **Deploy Functions**

```bash
firebase login
firebase deploy --only functions
```

## How It Works

### Poll System
- Uses **Firebase Realtime Database** to store vote counts.
- Real-time listeners update the UI instantly when anyone votes.
- LocalStorage prevents double voting from the same browser.

### Notification System
1. **User Preference**: User selects "1 Hour Before" in the UI.
2. **Database**: Preference is saved to `notifications/{userId}/matches/{matchId}` in Firebase.
3. **Cloud Function**: A scheduled function runs **every minute** on Google Cloud.
   - Checks upcoming matches.
   - Scans database for users who want notifications at this time.
   - Sends push notification via FCM.
4. **Delivery**: Notification arrives on user's device via Service Worker.

### Live Match Tracking
- **Data Source**: Fetches real-time data from **ESPN API** (via internal proxy) every 30 seconds during matches.
- **Caching**: Backend implements intelligent caching to prevent rate limits while ensuring fresh data.
- **Smart Status**: Automatically detects if a match is "Live", "Halftime", or "Finished" to adjust polling frequency.

### Custom Standings
- **Multi-League**: Fetches standings for both **Süper Lig** and **UEFA Europa League** from ESPN.
- **Data Processing**: Backend normalizes data from different leagues into a unified format for the frontend.
- **Performance**: Caches standings data for 1 hour to minimize external API calls.

### Formation Builder
- **Interactive Pitch**: Uses HTML5 Drag and Drop API for smooth player placement.
- **Export**: Uses `html-to-image` to generate a high-quality PNG of the user's custom formation.
- **Dynamic Assets**: Automatically loads player photos from SofaScore based on player IDs.

## Deployment

### Frontend (GitHub Pages)

```bash
npm run build
npm run deploy
```

### Backend (Render)
Deploys automatically from `backend/` directory.

### Functions (Firebase)
Deploys via CLI: `firebase deploy --only functions`

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
