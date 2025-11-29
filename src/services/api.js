// Backend API URL
export const BACKEND_URL = import.meta.env.DEV
    ? 'http://localhost:3001'
    : 'https://fenerbahce-backend.onrender.com';

const ensureAbsolutePhoto = (player = {}) => {
    const fallbackPath = `/api/player-image/${player.id ?? ''}`;
    const value = player.photo || fallbackPath;

    if (value.startsWith('http://') && !value.includes('localhost')) {
        return value.replace(/^http:\/\//i, 'https://');
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }

    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${BACKEND_URL}${normalizedPath}`;
};

// Fetch next match from backend
export const fetchNextMatch = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/next-match`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next match from backend:", error);
        return null;
    }
};

// Fetch squad from backend
export const fetchSquad = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/squad`);
        if (!response.ok) throw new Error('Backend fetch failed');
        const squad = await response.json();
        return squad.map(player => ({
            ...player,
            photo: ensureAbsolutePhoto(player)
        }));
    } catch (error) {
        console.error("Error fetching squad from backend:", error);
        return [];
    }
};

// Fetch next 3 matches from backend
export const fetchNext3Matches = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/next-3-matches`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next 3 matches from backend:", error);
        return [];
    }
};

// Injuries - not implemented yet
export const fetchInjuries = async () => {
    return [];
};

// Fetch standings from backend
export const fetchStandings = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/standings`);
        if (!response.ok) throw new Error('Standings fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching standings from backend:", error);
        return [];
    }
};
