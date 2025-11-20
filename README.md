# ⚽ Fenerbahçe Fan Hub

Modern, interactive fan application for Fenerbahçe SK supporters with match tracking, squad management, and formation builder.

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_Site-yellow?style=for-the-badge)](https://omerkalay.com/fenerbahce-fan-hub/)

**🔗 Live Site:** https://omerkalay.com/fenerbahce-fan-hub/

![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![Vite](https://img.shields.io/badge/Vite-6.0.5-purple)

## ✨ Features

### 📊 Dashboard
- **Next Match Card**: Live countdown timer with team logos and match details
- **Upcoming Matches**: Display next 3 fixtures with dates and opponents
- **Premium UI**: Glassmorphic design with smooth animations

### 🎮 Formation Builder
- **5 Formations**: 4-3-3, 4-4-2, 4-2-3-1, 4-1-4-1, 3-5-2
- **Realistic Pitch**: SVG-based football field with accurate markings
- **Drag & Drop**: Intuitive player placement from squad pool
- **Click to Add**: Modal-based player selection for empty positions
- **Player Photos**: Dynamic player images from SofaScore API

## 🚀 Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS v4
- **API**: SofaScore (via RapidAPI)
- **Caching**: localStorage (6-24h per user)
- **Deployment**: GitHub Pages (frontend) + Render (backend)

## 📁 Project Structure

```
football/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main dashboard with matches
│   │   ├── FormationBuilder.jsx   # Interactive pitch & formations
│   │   ├── SquadBuilder.jsx       # Squad management (legacy)
│   │   └── SquadList.jsx          # Player list view
│   ├── services/
│   │   └── api.js                 # API calls with caching
│   ├── App.jsx                    # Main app & routing
│   ├── index.css                  # Global styles & glassmorphism
│   └── main.jsx                   # React entry point
├── public/                        # Static assets
├── .env                           # API credentials (gitignored)
├── vite.config.js                 # Vite configuration
└── tailwind.config.js             # Tailwind theme
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- RapidAPI key for SofaScore

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/football.git
cd football
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
Create `.env` file:
```env
VITE_RAPIDAPI_KEY=your_rapidapi_key_here
VITE_RAPIDAPI_HOST=sofascore.p.rapidapi.com
```

4. **Run development server**
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

5. **Build for production**
```bash
npm run build
```

## 🌐 Deployment

### GitHub Pages (Frontend)

1. Update `vite.config.js` base path:
```js
export default defineConfig({
  base: '/repository-name/',
  // ...
})
```

2. Build and deploy:
```bash
npm run build
npm run deploy
```

### Backend Setup (Render)

The backend caches API data to minimize RapidAPI quota usage:

```
📦 Backend Architecture
├── Express.js server
├── Cron job (daily API fetch)
├── In-memory cache (24h)
└── REST endpoints for frontend
```

**Endpoints:**
- `GET /api/next-match` - Next match data
- `GET /api/next-3-matches` - Upcoming 3 matches
- `GET /api/squad` - Team squad list

**Benefits:**
- 1000 users = 1 API call per day
- ~1000x reduction in API usage
- Free Render tier sufficient

## 📊 API Integration

### Current (Direct Client Calls)
```
User Browser → SofaScore API
❌ High API usage (1 call per user)
```

### Planned (Backend Cache)
```
User Browser → Backend (Render) → SofaScore API (1x/day)
✅ Low API usage (1 call total)
```

## 🎨 Design Features

- **Glassmorphism**: Modern frosted glass aesthetic
- **Gradient Backgrounds**: Dynamic yellow/blue theme
- **Smooth Animations**: 200-300ms transitions
- **Mobile-First**: Optimized for phone screens
- **Dark Mode**: Premium dark theme by default

## 🔐 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_RAPIDAPI_KEY` | RapidAPI key for SofaScore | `abc123...` |
| `VITE_RAPIDAPI_HOST` | API host endpoint | `sofascore.p.rapidapi.com` |

## 📝 Cache Strategy

**localStorage Implementation:**
- Match data: 6 hours
- Squad data: 24 hours
- Next 3 matches: 6 hours

## 🛠️ Development Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🐛 Known Issues & Limitations

- ⚠️ SofaScore API endpoints may return 404 (endpoint discovery needed)
- ⏳ API key has daily quota limits
- 🔄 Backend integration pending (Render deployment)

## 👨‍💻 Contributing

This is a personal fan project. Suggestions and feedback welcome!

## 📄 License

MIT License - Free to use and modify

## 🙏 Credits

- **API**: SofaScore via RapidAPI
- **Design Inspiration**: Modern sports apps
- **Icons**: Heroicons
- **Team**: Fenerbahçe SK

---

Made with 💛💙 for Fenerbahçe fans
