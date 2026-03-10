import { BACKEND_URL } from './base';

export type PollVoteOption = 'home' | 'away' | 'draw';

export interface PollVoteResponse {
    success: boolean;
    alreadyVoted: boolean;
    userVote: PollVoteOption;
    votes: Record<PollVoteOption, number>;
    totalVotes: number;
}

export const submitPollVote = async (
    matchId: string | number,
    option: PollVoteOption,
    idToken: string
): Promise<PollVoteResponse> => {
    const response = await fetch(`${BACKEND_URL}/poll-vote`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
            matchId: String(matchId),
            option
        })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
        throw new Error(payload?.error || 'Oy kaydedilemedi.');
    }

    return {
        success: Boolean(payload.success),
        alreadyVoted: Boolean(payload.alreadyVoted),
        userVote: payload.userVote as PollVoteOption,
        votes: {
            home: Number(payload.votes?.home) || 0,
            away: Number(payload.votes?.away) || 0,
            draw: Number(payload.votes?.draw) || 0
        },
        totalVotes: Number(payload.totalVotes) || 0
    };
};
