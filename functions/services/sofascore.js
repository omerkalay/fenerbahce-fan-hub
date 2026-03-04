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

const fetchImage = async (type, id) => {
    const imageUrl = `${SOFASCORE_IMAGE_BASE}/${type}/${id}/image`;
    const response = await fetch(imageUrl, {
        headers: {
            'User-Agent': IMAGE_USER_AGENT,
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }
    });
    if (!response.ok) {
        return null;
    }
    return {
        contentType: response.headers.get('content-type') || 'image/png',
        buffer: Buffer.from(await response.arrayBuffer())
    };
};

module.exports = {
    fetchNextMatches,
    fetchSquad,
    fetchImage
};
