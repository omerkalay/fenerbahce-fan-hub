/**
 * Barrel re-export — preserves the existing import surface.
 * All domain modules live under ./api/ but consumers can still do:
 *   import { fetchMatchStatus, BACKEND_URL } from '../services/api';
 */

export { BACKEND_ORIGIN, BACKEND_URL } from './api/base';
export { submitPollVote } from './api/poll';
export type { PollVoteOption, PollVoteResponse } from './api/poll';
export { fetchMatchStatus, fetchSquad, fetchMatchSummary } from './api/fixtures';
export { fetchEspnStandings } from './api/standings';
export { fetchEspnFenerbahceFixtures } from './api/espn-fixtures';
export { fetchPlayerStats, fetchFormResults, fetchPlayerStatus } from './api/statistics';
