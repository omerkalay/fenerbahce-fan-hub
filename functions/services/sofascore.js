const { FENERBAHCE_ID, SOFASCORE_IMAGE_BASE, IMAGE_USER_AGENT, getApiHost, getSofascoreHeaders } = require('../config');

const fetchNextMatches = async () => {
    const response = await fetch(
        `https://${getApiHost()}/teams/get-next-matches?teamId=${FENERBAHCE_ID}`,
        { headers: getSofascoreHeaders() }
    );
    if (!response.ok) {
        throw new Error(`Match fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return data.events || [];
};

const fetchSquad = async () => {
    const response = await fetch(
        `https://${getApiHost()}/teams/get-squad?teamId=${FENERBAHCE_ID}`,
        { headers: getSofascoreHeaders() }
    );
    if (!response.ok) {
        throw new Error(`Squad fetch failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data.players) return [];
    return data.players.map(item => ({
        id: item.player.id,
        name: item.player.name || 'Unknown',
        position: item.player.position || null,
        number: item.player.jerseyNumber || null,
        country: item.player.country?.name || null,
        marketValue: item.player.proposedMarketValue || null
    }));
};

const IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8';
const RAPIDAPI_IMAGE_ENDPOINTS = {
    player: { route: '/players/get-image', param: 'playerId' },
    team: { route: '/teams/get-logo', param: 'teamId' }
};

const getImageHeaders = () => ({
    'User-Agent': IMAGE_USER_AGENT,
    'Accept': IMAGE_ACCEPT
});

const readImageResponse = async (response, type, id, source) => {
    if (!response.ok) {
        console.warn(`${source} image fetch failed for ${type}/${id}: ${response.status}`);
        return null;
    }

    if (response.status === 204) {
        console.warn(`${source} image fetch returned no content for ${type}/${id}`);
        return null;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
        console.warn(`${source} image fetch returned non-image content for ${type}/${id}: ${contentType}`);
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
        console.warn(`${source} image fetch returned an empty body for ${type}/${id}`);
        return null;
    }

    return {
        contentType,
        source,
        buffer
    };
};

const fetchRapidApiImage = async (type, id) => {
    const endpoint = RAPIDAPI_IMAGE_ENDPOINTS[type];
    if (!endpoint) return null;

    const imageUrl = new URL(`https://${getApiHost()}${endpoint.route}`);
    imageUrl.searchParams.set(endpoint.param, id);
    const response = await fetch(imageUrl, {
        redirect: 'follow',
        headers: {
            ...getSofascoreHeaders(),
            ...getImageHeaders()
        }
    });

    return readImageResponse(response, type, id, 'RapidAPI SofaScore');
};

const fetchSofascoreCdnImage = async (type, id) => {
    const imageUrl = `${SOFASCORE_IMAGE_BASE}/${type}/${id}/image`;
    const response = await fetch(imageUrl, {
        redirect: 'follow',
        headers: getImageHeaders()
    });

    return readImageResponse(response, type, id, 'SofaScore CDN');
};

const fetchImage = async (type, id) => {
    const rapidApiImage = await fetchRapidApiImage(type, id);
    if (rapidApiImage) return rapidApiImage;

    return fetchSofascoreCdnImage(type, id);
};

module.exports = {
    fetchNextMatches,
    fetchSquad,
    fetchImage
};
