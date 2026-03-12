const { fetchImage } = require('../services/sofascore');

async function handlePlayerImage(req, res, playerId) {
    if (!playerId) {
        return res.status(400).json({ error: 'Player ID required' });
    }

    try {
        const result = await fetchImage('player', playerId);
        if (!result) {
            return res.status(404).send('Image not found');
        }

        res.set('Content-Type', result.contentType);
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
        const result = await fetchImage('team', teamId);
        if (!result) {
            return res.status(404).send('Image not found');
        }

        res.set('Content-Type', result.contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(result.buffer);
    } catch (error) {
        console.error('Team image error:', error);
        return res.status(500).send('Error loading image');
    }
}

module.exports = { handlePlayerImage, handleTeamImage };
