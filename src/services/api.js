const API_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
const API_HOST = 'sofascore.p.rapidapi.com';
const FENERBAHCE_ID = 3052; // Fenerbahçe SK ID on SofaScore

const headers = {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': API_HOST
};

// Cache helper - kullanıcı başına günde 1 kere API çağrısı
const fetchWithCache = async (key, fetchFn, cacheTime = 24 * 60 * 60 * 1000) => {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTime) {
            console.log(`📦 Cache'den yüklendi: ${key}`);
            return data;
        }
    }

    console.log(`🌐 API'dan çekiliyor: ${key}`);
    const data = await fetchFn();
    if (data) {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    }
    return data;
};

export const fetchNextMatch = async () => {
    return fetchWithCache('fb_next_match', async () => {
        try {
            const response = await fetch(`https://${API_HOST}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`, { headers });
            const data = await response.json();
            return data.events && data.events.length > 0 ? data.events[0] : null;
        } catch (error) {
            console.error("Error fetching next match:", error);
            return null;
        }
    }, 6 * 60 * 60 * 1000); // 6 saat cache (maç bilgisi sık değişmez)
};

export const fetchSquad = async () => {
    return fetchWithCache('fb_squad', async () => {
        try {
            const response = await fetch(`https://${API_HOST}/teams/get-squad?teamId=${FENERBAHCE_ID}`, { headers });
            const data = await response.json();
            return data.players.map(item => ({
                id: item.player.id,
                name: item.player.name,
                position: item.player.position,
                number: item.player.jerseyNumber,
                photo: `https://api.sofascore.app/api/v1/player/${item.player.id}/image`,
                country: item.player.country?.name,
                marketValue: item.player.proposedMarketValue,
                status: null
            })) || [];
        } catch (error) {
            console.error("Error fetching squad:", error);
            return [];
        }
    }, 24 * 60 * 60 * 1000); // 24 saat cache
};

export const fetchNext3Matches = async () => {
    return fetchWithCache('fb_next_3_matches', async () => {
        try {
            const response = await fetch(`https://${API_HOST}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`, { headers });
            const data = await response.json();
            return data.events && data.events.length > 0 ? data.events.slice(0, 3) : [];
        } catch (error) {
            console.error("Error fetching next 3 matches:", error);
            return [];
        }
    }, 6 * 60 * 60 * 1000); // 6 saat cache
};

export const fetchInjuries = async () => {
    return [];
};
