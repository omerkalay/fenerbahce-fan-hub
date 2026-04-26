const { readCachedImage } = require('../services/imageCache');

async function handlePlayerImage(req, res, playerId) {
    if (!playerId) {
        return res.status(400).json({ error: 'Player ID required' });
    }

    try {
        const result = await readCachedImage('player', playerId);
        if (!result) {
            console.warn(`Player image cache miss for ${playerId}`);
            return res.status(404).send('Image not cached');
        }

        res.set('Content-Type', result.contentType);
        res.set('X-Image-Source', result.source);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(result.buffer);
    } catch (error) {
        console.error('Player image error:', error);
        return res.status(500).send('Error loading image');
    }
}

async function handleTeamImage(req, res, teamId) {
    if (!teamId) {
        return res.status(400).json({ error: 'Team ID required' });
    }

    try {
        const result = await readCachedImage('team', teamId);
        if (!result) {
            console.warn(`Team image cache miss for ${teamId}`);
            return res.status(404).send('Image not cached');
        }

        res.set('Content-Type', result.contentType);
        res.set('X-Image-Source', result.source);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(result.buffer);
    } catch (error) {
        console.error('Team image error:', error);
        return res.status(500).send('Error loading image');
    }
}

module.exports = { handlePlayerImage, handleTeamImage };
