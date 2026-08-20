export const buildEspnTeamLogoUrl = (teamId: string): string | null => {
    const normalizedId = String(teamId || '').trim();
    return normalizedId
        ? `https://a.espncdn.com/i/teamlogos/soccer/500/${encodeURIComponent(normalizedId)}.png`
        : null;
};
