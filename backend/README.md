# Fenerbahçe Fan Hub - Backend API

Express.js backend server that caches SofaScore API data to minimize quota usage.

## Features

- **Daily Cron Job**: Fetches data from SofaScore API once per day (6 AM)
- **In-Memory Cache**: Stores match and squad data
- **CORS Enabled**: Allows frontend access from GitHub Pages
- **Health Check**: Monitor cache status and last update time

## Endpoints

- `GET /` - API info
- `GET /api/next-match` - Next match data
- `GET /api/next-3-matches` - Upcoming 3 matches
- `GET /api/squad` - Team squad list
- `GET /api/health` - Health check & cache status

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Deploy to Render

1. Push backend to GitHub (separate repo or subfolder)
2. Create new Web Service on Render
3. Connect GitHub repository
4. Set environment variables:
   - `RAPIDAPI_KEY`
   - `RAPIDAPI_HOST`
5. Deploy

## Environment Variables

- `RAPIDAPI_KEY` - RapidAPI key for SofaScore
- `RAPIDAPI_HOST` - API host (sofascore.p.rapidapi.com)
- `PORT` - Server port (default: 3000)

## Cron Schedule

- **6:00 AM daily**: Fetch fresh data from SofaScore API
- Data cached in memory until next fetch
- Frontend always gets instant responses from cache
