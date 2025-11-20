// Backend API URL (Render)
const BACKEND_URL = 'https://fenerbahce-backend.onrender.com';

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
        return await response.json();
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

