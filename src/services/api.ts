/**
 * Barrel re-export — preserves the existing import surface.
 * All domain modules live under ./api/ but consumers can still do:
 *   import { fetchNextMatch, BACKEND_URL } from '../services/api';
 */

export { BACKEND_ORIGIN, BACKEND_URL } from './api/base';
export { submitPollVote } from './api/poll';
export type { PollVoteOption, PollVoteResponse } from './api/poll';
export { fetchNextMatch, fetchSquad, fetchNext3Matches, fetchMatchSummary, fetchInjuries } from './api/fixtures';
export { fetchEspnStandings } from './api/standings';
export { fetchEspnFenerbahceFixtures } from './api/espn-fixtures';
export { fetchPlayerStats, fetchFormResults, fetchPlayerStatus } from './api/statistics';
