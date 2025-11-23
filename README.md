# Fenerbahçe Fan Hub

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, squad management, formation builder, and full PWA (Progressive Web App) support.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.4.21-purple)

## Features

### Dashboard
- **Next Match Card**: Live countdown timer with team logos and match details
- **Upcoming Matches**: Display next 3 fixtures with dates and opponents
- **Premium UI**: Glassmorphic design with smooth animations

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
- **Backend**: Express.js with daily cron job
- **API**: SofaScore (via RapidAPI)
- **Caching**: Backend cache (24h) + Service Worker
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
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=sofascore.p.rapidapi.com
PORT=3000
CRON_SCHEDULE=0 6 * * *
```

4. **Run backend server**

```bash
npm start
```

Backend will run on [http://localhost:3000](http://localhost:3000)

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

The backend is deployed on Render with automatic daily data fetching.

**Backend Architecture:**
- Express.js server
- Cron job (daily 06:00 TR time)
- In-memory cache
- Image proxy for SofaScore photos
- REST API endpoints

**Environment Variables (Render):**

```env
RAPIDAPI_KEY=your_api_key
RAPIDAPI_HOST=sofascore.p.rapidapi.com
PORT=3000
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
- `GET /api/player-image/:id` - Player photo proxy
- `GET /api/team-image/:id` - Team logo proxy
- `GET /api/health` - Backend health check
- `GET /api/refresh` - Manual cache refresh

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
- **App-like Experience**: Standalone display mode
- **Custom Icons**: Fenerbahçe-themed app icons
- **Smart Caching**: NetworkFirst for API, CacheFirst for images

## Environment Variables

### Backend (.env in backend/)

| Variable | Description | Default |
|----------|-------------|---------|
| `RAPIDAPI_KEY` | RapidAPI key for SofaScore | Required |
| `RAPIDAPI_HOST` | API host endpoint | `sofascore.p.rapidapi.com` |
| `PORT` | Server port | `3000` |
| `CRON_SCHEDULE` | Cron schedule for data fetch | `0 6 * * *` (06:00 daily) |
| `PUBLIC_BASE_URL` | Backend URL for image proxying | Auto-detected |
| `DISABLE_CRON` | Disable automatic cron job | `false` |

### Frontend (No .env needed)

Frontend connects directly to deployed backend at `https://fenerbahce-backend.onrender.com`

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
npm start            # Start backend server (localhost:3000)
npm run dev          # Start backend (development mode)
```

## Known Issues & Limitations

- SofaScore API has daily quota limits (mitigated by backend caching)
- Backend cold starts on Render free tier (~1 minute on first request)
- Player photos depend on SofaScore availability

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
