const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Cache for API data
let cache = {
    nextMatch: null,
    next3Matches: [],
    squad: [],
    lastUpdate: null
};

const FENERBAHCE_ID = 3052;
const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = process.env.RAPIDAPI_HOST || 'sofascore.p.rapidapi.com';

const headers = {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST
};

// Fetch data from SofaScore API
async function fetchDataFromAPI() {
    console.log('🔄 Fetching data from SofaScore API...');

    try {
        // Fetch next match
        const matchResponse = await fetch(`https://${API_HOST}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`, { headers });
        const matchData = await matchResponse.json();

        if (matchData.events && matchData.events.length > 0) {
            cache.nextMatch = matchData.events[0];
            cache.next3Matches = matchData.events.slice(0, 3);
            console.log('✅ Next matches fetched successfully');
        }

        // Fetch squad
        const squadResponse = await fetch(`https://${API_HOST}/teams/get-squad?teamId=${FENERBAHCE_ID}`, { headers });
        const squadData = await squadResponse.json();

        if (squadData.players) {
            cache.squad = squadData.players.map(item => ({
                id: item.player.id,
                name: item.player.name,
                position: item.player.position,
                number: item.player.jerseyNumber,
                photo: `https://api.sofascore.app/api/v1/player/${item.player.id}/image`,
                country: item.player.country?.name,
                marketValue: item.player.proposedMarketValue,
                status: null
            }));
            console.log('✅ Squad fetched successfully');
        }

        cache.lastUpdate = new Date();
        console.log(`✨ Cache updated at ${cache.lastUpdate.toISOString()}`);
    } catch (error) {
        console.error('❌ Error fetching data:', error.message);
    }
}

// Cron job: Fetch data every day at 6:00 AM
// TODO: Re-enable after testing or upgrade Node.js version
// cron.schedule('0 6 * * *', () => {
//   console.log('⏰ Scheduled fetch triggered');
//   fetchDataFromAPI();
// }, {
//   timezone: "Europe/Istanbul"
// });

// Initial fetch on server start
fetchDataFromAPI();

// Manual refresh endpoint for testing
app.get('/api/refresh', async (req, res) => {
    await fetchDataFromAPI();
    res.json({ message: 'Data refreshed', lastUpdate: cache.lastUpdate });
});

// API Endpoints
app.get('/api/next-match', (req, res) => {
    res.json(cache.nextMatch);
});

app.get('/api/next-3-matches', (req, res) => {
    res.json(cache.next3Matches);
});

app.get('/api/squad', (req, res) => {
    res.json(cache.squad);
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        lastUpdate: cache.lastUpdate,
        cacheSize: {
            nextMatch: cache.nextMatch ? 'loaded' : 'empty',
            next3Matches: cache.next3Matches.length,
            squad: cache.squad.length
        }
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Fenerbahçe Fan Hub API',
        version: '1.0.0',
        endpoints: [
            '/api/next-match',
            '/api/next-3-matches',
            '/api/squad',
            '/api/health'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
