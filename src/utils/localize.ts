// ─── Turkish localization for ESPN data ─────────────────

const TEAM_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
    // Süper Lig teams
    [/\bFenerbahce\b/gi, 'Fenerbahçe'],
    [/\bBesiktas\b/gi, 'Beşiktaş'],
    [/\bIstanbul Basaksehir\b/gi, 'İstanbul Başakşehir'],
    [/\bBasaksehir\b/gi, 'Başakşehir'],
    [/\bTrabzonspor\b/gi, 'Trabzonspor'],
    [/\bGoztepe\b/gi, 'Göztepe'],
    [/\bKonyaspor\b/gi, 'Konyaspor'],
    [/\bKasimpasa\b/gi, 'Kasımpaşa'],
    [/\bKasimpaşa\b/gi, 'Kasımpaşa'],
    [/\bSivasspor\b/gi, 'Sivasspor'],
    [/\bRizespor\b/gi, 'Rizespor'],
    [/\bCaykur Rizespor\b/gi, 'Çaykur Rizespor'],
    [/\bAnkaragucu\b/gi, 'Ankaragücü'],
    [/\bMKE Ankaragucu\b/gi, 'MKE Ankaragücü'],
    [/\bGenclerbirligi\b/gi, 'Gençlerbirliği'],
    [/\bEskisehirspor\b/gi, 'Eskişehirspor'],
    [/\bBursaspor\b/gi, 'Bursaspor'],
    [/\bAntep\b/gi, 'Antep'],
    [/\bGaziantep\b/gi, 'Gaziantep'],
    [/\bBodrum\b/gi, 'Bodrum'],
    [/\bBodrumspor\b/gi, 'Bodrumspor'],
    [/\bEyupspor\b/gi, 'Eyüpspor'],
    [/\bHatayspor\b/gi, 'Hatayspor'],
    [/\bSamsunspor\b/gi, 'Samsunspor'],
    [/\bAdana Demirspor\b/gi, 'Adana Demirspor'],
    [/\bPendikspor\b/gi, 'Pendikspor'],
    [/\bIstanbulspor\b/gi, 'İstanbulspor'],
    [/\bKaragumruk\b/gi, 'Karagümrük'],
    [/\bFatih Karagumruk\b/gi, 'Fatih Karagümrük'],
    [/\bUmraniyespor\b/gi, 'Ümraniyespor'],
];

const COMPETITION_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
    [/\bClub Friendly(?: Games?)?\b/gi, 'Hazırlık Maçı'],
    [/\bClub Friendlies\b/gi, 'Hazırlık Maçı'],
    [/\bTurkish Super Lig\b/gi, 'Süper Lig'],
    [/\bTurkiye Kupasi\b/gi, 'Türkiye Kupası'],
    [/\bTurkish Cup\b/gi, 'Türkiye Kupası'],
    [/\bTurkey Cup\b/gi, 'Türkiye Kupası'],
    [/\bTurkish Super Cup\b/gi, 'Türkiye Süper Kupası'],
    [/\bSuper Lig\b/gi, 'Süper Lig'],
    [/\bUEFA Europa League\b/gi, 'UEFA Avrupa Ligi'],
    [/\bEuropa League\b/gi, 'Avrupa Ligi'],
    [/\bUEFA Champions League\b/gi, 'UEFA Şampiyonlar Ligi'],
    [/\bChampions League\b/gi, 'Şampiyonlar Ligi'],
    [/\bUEFA Conference League\b/gi, 'UEFA Konferans Ligi'],
    [/\bConference League\b/gi, 'Konferans Ligi'],
    [/\bGroup ([A-H])\b/g, 'Grup $1'],
    [/\bLeague Phase\b/gi, 'Lig Aşaması'],
    [/\bKnockout Round Playoffs\b/gi, 'Eleme Turu Playoff'],
    [/\b(?:Qualification|Qualifying) Round (\d+)\b/gi, '$1. Ön Eleme Turu'],
    [/\b(\d+)(?:st|nd|rd|th) (?:Qualification|Qualifying) Round\b/gi, '$1. Ön Eleme Turu'],
    [/\bPreliminary Round\b/gi, 'Ön Eleme Turu'],
    [/\bPlay[\s-]*offs?(?: Round)?\b/gi, 'Play-off'],
    [/\bQualification\b/gi, 'Ön Eleme'],
    [/\bQualifying\b/gi, 'Ön Eleme'],
    [/\bRound of 16\b/gi, 'Son 16'],
    [/\bQuarter-?finals?\b/gi, 'Çeyrek Final'],
    [/\bSemi-?finals?\b/gi, 'Yarı Final'],
    [/\bFinal\b/g, 'Final'],
    [/\bMatchday (\d+)\b/gi, '$1. Hafta'],
];

interface CompetitionStageInput {
    name?: string;
    slug?: string;
    round?: number;
    qualificationOrPreliminary?: boolean;
}

const PLAYOFF_PATTERN = /\bplay[\s-]*offs?\b/i;
const QUALIFICATION_PATTERN = /\b(?:qualification|qualifying|preliminary)\b/i;
const ORDINAL_ROUNDS: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
};

const extractQualificationRound = (value: string, fallbackRound?: number): number | null => {
    const qualificationFirst = value.match(
        /\b(?:qualification|qualifying|preliminary)(?:\s+round)?\s+(\d+)\b/i
    );
    if (qualificationFirst) return Number(qualificationFirst[1]);

    const numberFirst = value.match(
        /\b(\d+)(?:st|nd|rd|th)?\s+(?:qualification|qualifying|preliminary)(?:\s+round)?\b/i
    );
    if (numberFirst) return Number(numberFirst[1]);

    const wordFirst = value.match(
        /\b(first|second|third|fourth)\s+(?:qualification|qualifying|preliminary)(?:\s+round)?\b/i
    );
    if (wordFirst) return ORDINAL_ROUNDS[wordFirst[1].toLowerCase()] ?? null;

    return Number.isFinite(fallbackRound) ? Number(fallbackRound) : null;
};

export const localizeTeamName = (name: string = ''): string => {
    if (!name) return name;
    let result = name;
    for (const [pattern, replacement] of TEAM_NAME_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }
    return result;
};

export const localizeCompetitionName = (name: string = ''): string => {
    if (!name) return name;
    let result = name;
    for (const [pattern, replacement] of COMPETITION_NAME_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }
    return result;
};

export const localizeCompetitionStage = ({
    name = '',
    slug = '',
    round,
    qualificationOrPreliminary = false,
}: CompetitionStageInput = {}): string => {
    const searchableValue = `${name} ${slug.replace(/-/g, ' ')}`.trim();

    // SofaScore can use Playoff, Play-off, Playoffs, or Play-off Round.
    // Keep the established Turkish football term instead of translating it.
    if (PLAYOFF_PATTERN.test(searchableValue)) return 'Play-off';

    if (qualificationOrPreliminary || QUALIFICATION_PATTERN.test(searchableValue)) {
        const qualificationRound = extractQualificationRound(searchableValue, round);
        return qualificationRound ? `${qualificationRound}. Ön Eleme Turu` : 'Ön Eleme Turu';
    }

    return localizeCompetitionName(name);
};

export const localizeText = (text: string = ''): string => {
    return localizeCompetitionName(localizeTeamName(text));
};
