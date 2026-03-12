const { db } = require('../config');
const { requireAuthenticatedUid } = require('./middleware');

const POLL_OPTIONS = new Set(['home', 'away', 'draw']);

const normalizeVoteCounts = (votes = {}) => ({
    home: Number(votes.home) || 0,
    away: Number(votes.away) || 0,
    draw: Number(votes.draw) || 0
});

async function handlePollVote(req, res) {
    const authenticatedUid = await requireAuthenticatedUid(req, res);
    if (!authenticatedUid) {
        return;
    }

    const { matchId, option } = req.body || {};
    const normalizedMatchId = String(matchId || '').trim();
    const normalizedOption = String(option || '').trim();

    if (!normalizedMatchId) {
        return res.status(400).json({ error: 'Match ID required' });
    }

    if (normalizedMatchId.includes('/')) {
        return res.status(400).json({ error: 'Invalid match ID' });
    }

    if (!POLL_OPTIONS.has(normalizedOption)) {
        return res.status(400).json({ error: 'Invalid vote option' });
    }

    const pollRef = db.ref(`match_polls/${normalizedMatchId}`);

    try {
        let existingVote = null;
        const transactionResult = await pollRef.transaction((currentData) => {
            const current = currentData && typeof currentData === 'object' ? currentData : {};
            const currentUsers = current.users && typeof current.users === 'object' ? current.users : {};
            const previousVote = typeof currentUsers[authenticatedUid] === 'string'
                ? currentUsers[authenticatedUid]
                : null;

            if (previousVote) {
                existingVote = previousVote;
                return current;
            }

            const nextVotes = normalizeVoteCounts(current.votes);
            nextVotes[normalizedOption] = (nextVotes[normalizedOption] || 0) + 1;

            return {
                ...current,
                votes: nextVotes,
                users: {
                    ...currentUsers,
                    [authenticatedUid]: normalizedOption
                },
                updatedAt: Date.now()
            };
        });

        const pollData = transactionResult.snapshot.val() || {};
        const votes = normalizeVoteCounts(pollData.votes);
        const userVote = existingVote || pollData.users?.[authenticatedUid] || normalizedOption;
        const totalVotes = votes.home + votes.away + votes.draw;

        return res.json({
            success: true,
            alreadyVoted: Boolean(existingVote),
            userVote,
            votes,
            totalVotes
        });
    } catch (error) {
        console.error('Poll vote error:', error);
        return res.status(500).json({ error: 'Oy kaydedilemedi.' });
    }
}

module.exports = { handlePollVote };
