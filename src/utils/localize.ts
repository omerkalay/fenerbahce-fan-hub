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
    [/\bRound of 16\b/gi, 'Son 16'],
    [/\bQuarter-?finals?\b/gi, 'Çeyrek Final'],
    [/\bSemi-?finals?\b/gi, 'Yarı Final'],
    [/\bFinal\b/g, 'Final'],
    [/\bMatchday (\d+)\b/gi, '$1. Hafta'],
];

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

export const localizeText = (text: string = ''): string => {
    return localizeCompetitionName(localizeTeamName(text));
};
