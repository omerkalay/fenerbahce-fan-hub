// ─── Common ───────────────────────────────────────────────

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  slug?: string;
}

// ─── SofaScore / Backend cached data ─────────────────────

export interface Tournament {
  name: string;
  slug?: string;
  uniqueTournament?: {
    name: string;
    slug?: string;
    id?: number;
  };
}

export interface MatchData {
  id: number;
  startTimestamp: number;
  homeTeam: Team;
  awayTeam: Team;
  tournament: Tournament;
  slug?: string;
  status?: {
    code?: number;
    description?: string;
    type?: string;
  };
}

export interface CachedMatchPayload {
  nextMatch: MatchData | null;
  next3Matches: MatchData[];
  timestamp: number;
}

// ─── Squad / Player ──────────────────────────────────────

export interface Player {
  id: number;
  name: string;
  position: string;
  number?: number;
  photo?: string;
  status?: PlayerStatus | null;
}

export interface PlayerStatus {
  type: 'injured' | 'suspended';
  reason?: string;
}

export interface MockPlayer {
  id: number;
  name: string;
  position: string;
  number: number;
  status: string;
}

// ─── Live Match (ESPN via backend) ───────────────────────

export interface LiveMatchTeam {
  name: string;
  logo?: string;
  score?: string;
}

export interface MatchEvent {
  clock: string;
  player: string;
  playerOut?: string;
  team?: string;
  type?: string;
  isGoal?: boolean;
  isPenalty?: boolean;
  isYellowCard?: boolean;
  isRedCard?: boolean;
  isSubstitution?: boolean;
  assist?: string;
}

export interface MatchStat {
  name: string;
  label?: string;
  homeValue: string;
  awayValue: string;
  key?: string;
}

export interface LiveMatchData {
  matchState: 'pre' | 'in' | 'post' | 'no-match';
  displayClock?: string;
  statusDetail?: string;
  homeTeam?: LiveMatchTeam;
  awayTeam?: LiveMatchTeam;
  events?: MatchEvent[];
  stats?: MatchStat[];
}

export type LiveMatchState = 'countdown' | 'checking' | 'pre' | 'in' | 'post' | 'idle';

// ─── ESPN Fixtures ───────────────────────────────────────

export interface EspnTeam {
  id: string | null;
  name: string;
  shortName: string;
  abbreviation: string | null;
  logo: string | null;
  score: string | null;
  winner: boolean;
}

export interface EspnMatchStatus {
  state: string;
  completed: boolean;
  description: string | null;
  detail: string | null;
  shortDetail: string | null;
}

export interface EspnFixtureMatch {
  id: string;
  date: string;
  competitionName: string;
  competitionKey: string | null;
  competitionGroup: string | null;
  competitionLabel: string | null;
  roundLabel: string | null;
  venueName: string | null;
  venueCity: string | null;
  status: EspnMatchStatus;
  homeTeam: EspnTeam;
  awayTeam: EspnTeam;
  isFbHome: boolean;
  fbTeam: EspnTeam;
  opponentTeam: EspnTeam;
  resultCode: 'G' | 'M' | 'B' | null;
  resultLabel: string | null;
}

export interface EspnFixtureData {
  source: string;
  seasonStartYear: number;
  season: unknown;
  team: unknown;
  matches: EspnFixtureMatch[];
  error?: boolean;
}

// ─── ESPN Standings ──────────────────────────────────────

export interface StandingsTeam {
  id: string;
  name: string;
  logo: string;
}

export interface StandingsRow {
  team: StandingsTeam;
  rank: number;
  points: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

export interface StandingsData {
  id: string;
  name: string;
  rows: StandingsRow[];
}

// ─── Match Summary (backend cached) ─────────────────────

export interface MatchSummaryTeam {
  name?: string;
  logo?: string;
  score?: string;
}

export interface MatchSummaryData {
  homeTeam?: MatchSummaryTeam;
  awayTeam?: MatchSummaryTeam;
  statusDetail?: string;
  events?: MatchEvent[];
  stats?: MatchStat[];
}

// ─── Notification Options ────────────────────────────────

export interface NotificationOptions {
  threeHours: boolean;
  oneHour: boolean;
  thirtyMinutes: boolean;
  fifteenMinutes: boolean;
  dailyCheck: boolean;
  updatedAt?: string;
}

// ─── Formation Builder ───────────────────────────────────

export interface PositionCoord {
  top: string;
  left: string;
}

export type FormationName =
  | '4-3-3'
  | '4-4-2'
  | '4-2-3-1'
  | '4-1-4-1'
  | '3-5-2'
  | '4-1-2-1-2 Diamond';

export type FormationPositions = Record<string, PositionCoord>;
export type Formations = Record<FormationName, FormationPositions>;
export type PitchPlayers = Record<string, Player>;

// ─── Event Visual Type ───────────────────────────────────

export type EventVisualType = 'goal' | 'substitution' | 'red-card' | 'yellow-card' | 'neutral';
