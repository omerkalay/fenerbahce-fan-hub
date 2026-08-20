// ─── Common ───────────────────────────────────────────────

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  slug?: string;
  nameCode?: string;
}

// ─── SofaScore / Backend cached data ─────────────────────

export interface Tournament {
  name: string;
  slug?: string;
  qualificationOrPreliminary?: boolean;
  uniqueTournament?: {
    name: string;
    slug?: string;
    id?: number;
  };
}

export interface RoundInfo {
  name?: string;
  round?: number;
  slug?: string;
}

export interface MatchData {
  id: number;
  startTimestamp: number;
  homeTeam: Team;
  awayTeam: Team;
  tournament: Tournament;
  roundInfo?: RoundInfo;
  slug?: string;
  timeValid?: boolean;
  winnerCode?: number;
  homeScore?: {
    current?: number;
    display?: number | string;
    normaltime?: number;
    overtime?: number;
    penalties?: number;
  };
  awayScore?: {
    current?: number;
    display?: number | string;
    normaltime?: number;
    overtime?: number;
    penalties?: number;
  };
  venue?: {
    name?: string;
    stadium?: { name?: string };
    city?: { name?: string };
  };
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
  seasonState?: SeasonState;
  season?: SeasonMeta | null;
}

export type SeasonState = 'active' | 'offseason' | 'unknown';

export interface SeasonMeta {
  startYear: number;
  label: string;
}

export interface MatchStatusPayload {
  nextMatch: MatchData | null;
  next3Matches: MatchData[];
  seasonState: SeasonState;
  season: SeasonMeta | null;
  matchFetchStatus?: 'pending' | 'ok' | 'error' | null;
  lastUpdate: number | null;
}

// ─── Squad / Player ──────────────────────────────────────

export interface Player {
  id: number;
  name: string;
  position: string;
  number?: number;
  photo?: string;
}

// ─── Live Match (ESPN via backend) ───────────────────────

export interface LiveMatchTeam {
  id?: string | number;
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
  isOwnGoal?: boolean;
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
  matchId?: string;
  startTimestamp?: number;
  matchState: 'pre' | 'in' | 'post' | 'no-match' | 'unsupported';
  displayClock?: string;
  statusDetail?: string;
  homeTeam?: LiveMatchTeam;
  awayTeam?: LiveMatchTeam;
  events?: MatchEvent[];
  stats?: MatchStat[];
  lineups?: MatchLineups | null;
}

export type LiveMatchState = 'countdown' | 'checking' | 'pre' | 'in' | 'post' | 'unsupported' | 'idle';

// ─── Multi-provider Fixtures ─────────────────────────────

export type FixtureSource = 'espn' | 'sofascore';
export type FixtureCompetitionGroup = 'superlig' | 'europe' | 'cup';

export interface FixtureTeam {
  id: string | null;
  name: string;
  shortName: string;
  abbreviation: string | null;
  logo: string | null;
  score: string | null;
  winner: boolean;
}

export interface FixtureMatchStatus {
  state: string;
  completed: boolean;
  description: string | null;
  detail: string | null;
  shortDetail: string | null;
}

export interface FixtureMatch {
  id: string;
  source: FixtureSource;
  summaryAvailable: boolean;
  date: string;
  timeValid: boolean;
  competitionName: string;
  competitionKey: string | null;
  competitionGroup: FixtureCompetitionGroup | null;
  competitionLabel: string | null;
  roundLabel: string | null;
  venueName: string | null;
  venueCity: string | null;
  status: FixtureMatchStatus;
  homeTeam: FixtureTeam;
  awayTeam: FixtureTeam;
  isFbHome: boolean;
  fbTeam: FixtureTeam;
  opponentTeam: FixtureTeam;
  resultCode: 'G' | 'M' | 'B' | null;
  resultLabel: string | null;
}

export interface FixtureData {
  source: string;
  seasonStartYear: number;
  season: unknown;
  team: unknown;
  matches: FixtureMatch[];
  error?: boolean;
  warning?: string | null;
}

export type EspnTeam = FixtureTeam;
export type EspnMatchStatus = FixtureMatchStatus;
export type EspnFixtureMatch = FixtureMatch;
export type EspnFixtureData = FixtureData;

export interface CupFixturePayload {
  source: 'SofaScore';
  seasonStartYear: number;
  lastUpdate: number | null;
  matches: MatchData[];
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

// UEFA Journey

export type UefaCompetitionKey = 'champions' | 'europa' | 'conference';
export type UefaParticipationState =
  | 'qualifying'
  | 'league_phase'
  | 'knockout'
  | 'eliminated'
  | 'awaiting_transition'
  | 'not_participating'
  | 'unknown';
export type UefaPathStageStatus =
  | 'completed'
  | 'active'
  | 'upcoming'
  | 'awaiting'
  | 'bypassed'
  | 'transferred'
  | 'eliminated'
  | 'locked';

export interface UefaCompetition {
  key: UefaCompetitionKey;
  name: string;
  shortName: string;
  mainSlug: string;
  qualifierSlug: string;
  qualifierName: string;
}

export interface UefaJourneyTeam {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string | null;
  logo: string | null;
  score?: string | null;
  aggregateScore?: number | null;
  shootoutScore?: number | null;
  winner?: boolean;
}

export interface UefaJourneyMatch {
  id: string;
  date: string | null;
  seasonYear: number | null;
  competitionKey: UefaCompetitionKey;
  competitionName: string;
  competitionSlug: string;
  qualifying: boolean;
  stageKey: string;
  stageLabel: string;
  status: {
    state: string;
    completed: boolean;
    detail: string | null;
  };
  homeTeam: UefaJourneyTeam;
  awayTeam: UefaJourneyTeam;
  notes: string[];
}

export interface UefaPathStage {
  key: string;
  label: string;
  competitionKey: UefaCompetitionKey | null;
  competitionName: string | null;
  status: UefaPathStageStatus;
  matches: UefaJourneyMatch[];
  aggregate: Record<string, number> | null;
  winnerTeamId: string | null;
  position: number | null;
  points: number | null;
}

export interface UefaBracketTie {
  id: string;
  stageKey: string;
  stageLabel: string;
  teams: UefaJourneyTeam[];
  legs: UefaJourneyMatch[];
  aggregate: Record<string, number> | null;
  winnerTeamId: string | null;
  status: 'live' | 'upcoming' | 'completed';
  nextTieId: string | null;
}

export interface UefaBracketStage {
  key: string;
  label: string;
  ties: UefaBracketTie[];
}

export interface UefaBracket {
  competition: UefaCompetition;
  stages: UefaBracketStage[];
}

export interface UefaJourneyPayload {
  source: 'ESPN';
  seasonStartYear: number;
  lastUpdate: number | null;
  stale: boolean;
  participation: {
    state: UefaParticipationState;
    competition: UefaCompetition | null;
    qualifier: UefaCompetition | null;
    phaseLabel: string | null;
  };
  standings: StandingsData | null;
  fenerPath: UefaPathStage[];
  bracket: UefaBracket | null;
}

export interface UefaJourneySummary {
  source: 'ESPN';
  seasonStartYear: number | null;
  lastUpdate: number | null;
  stale: boolean;
  state: UefaParticipationState;
  title: string;
  competitionKey: UefaCompetitionKey | null;
  competitionName: string | null;
  qualifierName: string | null;
  phaseLabel: string | null;
}

// ─── Match Summary (backend cached) ─────────────────────

export interface MatchSummaryTeam {
  id?: string | number;
  name?: string;
  logo?: string;
  score?: string;
}

export interface LineupPlayer {
  name: string;
  jersey: string;
  position: string;
  positionCode?: string;
  formationPlace?: number;
  positionGroup?: 'GK' | 'DEF' | 'MID' | 'FWD';
  order?: number;
}

export interface LineupSubstitution {
  minute: string;
  playerIn: string;
  playerOut: string;
}

export interface TeamLineup {
  teamId: string;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  substitutions: LineupSubstitution[];
}

export interface MatchLineups {
  home: TeamLineup | null;
  away: TeamLineup | null;
}

export interface MatchSummaryData {
  homeTeam?: MatchSummaryTeam;
  awayTeam?: MatchSummaryTeam;
  statusDetail?: string;
  events?: MatchEvent[];
  stats?: MatchStat[];
  lineups?: MatchLineups | null;
}

// ─── Notification Options ────────────────────────────────

export interface NotificationOptions {
  generalNotifications: boolean;
  threeHours: boolean;
  oneHour: boolean;
  thirtyMinutes: boolean;
  fifteenMinutes: boolean;
  dailyCheck: boolean;
  updatedAt?: number;
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

// ─── Statistics ─────────────────────────────────────────

export interface PlayerStat {
  playerId: string;
  name: string;
  goals: number;
  assists: number;
  appearances: number;
  leagueGoals: number;
  leagueAssists: number;
  europaGoals: number;
  europaAssists: number;
  photoUrl?: string;
}

export interface FormResult {
  matchId: string;
  date: string;
  opponent: string;
  result: "W" | "D" | "L";
  score: string;
  isHome: boolean;
  possession?: number;
}

export interface PlayerStatusEntry {
  name: string;
  status: "injured" | "suspended" | "card-risk" | "doubtful" | "fit";
  detail: string;
  returnDate: string;
  updatedAt: number;
}

// ─── Starting XI ─────────────────────────────────────────

export interface StartingXIPlayer {
  name: string;
  number: number;
  group: 'GK' | 'DEF' | 'MID' | 'FWD';
}

export interface StartingXIData {
  publishedAt: number;
  starters: StartingXIPlayer[];
  bench?: StartingXIPlayer[];
}
