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
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const SOFASCORE_IMAGE_BASE_HTTP = 'http://img.sofascore.com/api/v1';
const IMAGE_USER_AGENT = process.env.IMAGE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 6 * * *';
const ENABLE_CRON = process.env.DISABLE_CRON !== 'true';

const headers = {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST
};

const sanitizeBaseUrl = (url = '') => {
    if (!url) return '';
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return url.replace(/\/$/, '');
    }
    return url.replace(/^http:\/\//i, 'https://').replace(/\/$/, '');
};

const getAbsoluteBaseUrl = (req = null) => {
    const normalizedEnvUrl = sanitizeBaseUrl(PUBLIC_BASE_URL);
    if (normalizedEnvUrl) {
        return normalizedEnvUrl;
    }
    if (!req) {
        return '';
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${protocol}://${req.get('host')}`.replace(/\/$/, '');
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
                photoPath: `/api/player-image/${item.player.id}`,
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

// Cron job: Fetch data every day at configured time (default 06:00 TR)
if (ENABLE_CRON) {
    cron.schedule(CRON_SCHEDULE, () => {
        console.log('⏰ Scheduled fetch triggered');
        fetchDataFromAPI();
    }, {
        timezone: "Europe/Istanbul"
    });
} else {
    console.log('⚠️ Cron disabled via DISABLE_CRON env');
}

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
    const baseUrl = getAbsoluteBaseUrl(req);
    const squad = cache.squad.map(player => {
        const { photoPath, ...rest } = player;
        const resolvedPath = photoPath || `/api/player-image/${player.id}`;
        const absolutePhoto = resolvedPath.startsWith('http')
            ? resolvedPath
            : `${baseUrl}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`;

        return {
            ...rest,
            photo: absolutePhoto
        };
    });
    res.json(squad);
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

async function proxyImage(req, res, type = 'player') {
    try {
        const { id } = req.params;
        const imageUrl = `${SOFASCORE_IMAGE_BASE_HTTP}/${type}/${id}/image`;

        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': IMAGE_USER_AGENT,
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            console.warn(`Image proxy upstream error ${response.status} for ${imageUrl}`);
            return res.status(response.status).send('Image not found');
        }

        res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24h

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        console.error('Error proxying image:', error.message);
        res.status(500).send('Error loading image');
    }
}

app.get('/api/player-image/:id', (req, res) => proxyImage(req, res, 'player'));
app.get('/api/team-image/:id', (req, res) => proxyImage(req, res, 'team'));

app.get('/', (req, res) => {
    res.json({
        message: 'Fenerbahçe Fan Hub API',
        version: '1.0.0',
        endpoints: [
            '/api/next-match',
            '/api/next-3-matches',
            '/api/squad',
            '/api/health',
            '/api/player-image/:playerId'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
