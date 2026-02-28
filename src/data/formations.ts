import type { Formations } from '../types';

export const PITCH_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 68 105" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grass" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#1a472a"/><stop offset="50%" style="stop-color:#166534"/><stop offset="100%" style="stop-color:#1a472a"/></linearGradient></defs><rect width="68" height="105" fill="url(#grass)"/><g stroke="rgba(255,255,255,0.5)" stroke-width="0.4" fill="none"><rect x="4" y="4" width="60" height="97"/><line x1="4" y1="52.5" x2="64" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><circle cx="34" cy="52.5" r="0.5" fill="rgba(255,255,255,0.5)"/><rect x="13.84" y="4" width="40.32" height="16.5"/><rect x="24.84" y="4" width="18.32" height="5.5"/><circle cx="34" cy="15" r="0.5" fill="rgba(255,255,255,0.5)"/><path d="M 25.5 20.5 A 9.15 9.15 0 0 0 42.5 20.5"/><rect x="13.84" y="84.5" width="40.32" height="16.5"/><rect x="24.84" y="95.5" width="18.32" height="5.5"/><circle cx="34" cy="90" r="0.5" fill="rgba(255,255,255,0.5)"/><path d="M 25.5 84.5 A 9.15 9.15 0 0 1 42.5 84.5"/><path d="M 4 6 A 2 2 0 0 0 6 4"/><path d="M 62 4 A 2 2 0 0 0 64 6"/><path d="M 4 99 A 2 2 0 0 1 6 101"/><path d="M 62 101 A 2 2 0 0 1 64 99"/></g></svg>`)}`;

export const getPositionFamily = (positionKey: string): string => {
    if (positionKey === 'GK') return 'gk';
    if (/^(LB|RB|LWB|RWB|CB\d*)$/.test(positionKey)) return 'def';
    if (/^(CDM\d*|CM\d*|CAM|LAM|RAM|LM|RM)$/.test(positionKey)) return 'mid';
    if (/^(ST\d*|ST|LW|RW)$/.test(positionKey)) return 'att';
    return 'other';
};

// Pozisyonlar saha çizgilerine göre optimize edildi
export const formations: Formations = {
    '4-3-3': {
        GK: { top: '93%', left: '50%' },
        LB: { top: '78%', left: '12%' },
        CB1: { top: '78%', left: '35%' },
        CB2: { top: '78%', left: '65%' },
        RB: { top: '78%', left: '88%' },
        CM1: { top: '50%', left: '28%' },
        CM2: { top: '50%', left: '50%' },
        CM3: { top: '50%', left: '72%' },
        LW: { top: '25%', left: '12%' },
        ST: { top: '15%', left: '50%' },
        RW: { top: '25%', left: '88%' }
    },
    '4-4-2': {
        GK: { top: '93%', left: '50%' },
        LB: { top: '78%', left: '12%' },
        CB1: { top: '78%', left: '35%' },
        CB2: { top: '78%', left: '65%' },
        RB: { top: '78%', left: '88%' },
        LM: { top: '50%', left: '12%' },
        CM1: { top: '50%', left: '35%' },
        CM2: { top: '50%', left: '65%' },
        RM: { top: '50%', left: '88%' },
        ST1: { top: '18%', left: '35%' },
        ST2: { top: '18%', left: '65%' }
    },
    '4-2-3-1': {
        GK: { top: '93%', left: '50%' },
        LB: { top: '78%', left: '12%' },
        CB1: { top: '78%', left: '35%' },
        CB2: { top: '78%', left: '65%' },
        RB: { top: '78%', left: '88%' },
        CDM1: { top: '60%', left: '35%' },
        CDM2: { top: '60%', left: '65%' },
        LAM: { top: '35%', left: '15%' },
        CAM: { top: '32%', left: '50%' },
        RAM: { top: '35%', left: '85%' },
        ST: { top: '15%', left: '50%' }
    },
    '4-1-4-1': {
        GK: { top: '93%', left: '50%' },
        LB: { top: '78%', left: '12%' },
        CB1: { top: '78%', left: '35%' },
        CB2: { top: '78%', left: '65%' },
        RB: { top: '78%', left: '88%' },
        CDM: { top: '62%', left: '50%' },
        LM: { top: '45%', left: '12%' },
        CM1: { top: '45%', left: '35%' },
        CM2: { top: '45%', left: '65%' },
        RM: { top: '45%', left: '88%' },
        ST: { top: '15%', left: '50%' }
    },
    '3-5-2': {
        GK: { top: '93%', left: '50%' },
        CB1: { top: '78%', left: '25%' },
        CB2: { top: '78%', left: '50%' },
        CB3: { top: '78%', left: '75%' },
        LWB: { top: '55%', left: '8%' },
        CM1: { top: '50%', left: '28%' },
        CM2: { top: '50%', left: '50%' },
        CM3: { top: '50%', left: '72%' },
        RWB: { top: '55%', left: '92%' },
        ST1: { top: '18%', left: '35%' },
        ST2: { top: '18%', left: '65%' }
    },
    '4-1-2-1-2 Diamond': {
        GK: { top: '93%', left: '50%' },
        LB: { top: '78%', left: '12%' },
        CB1: { top: '78%', left: '35%' },
        CB2: { top: '78%', left: '65%' },
        RB: { top: '78%', left: '88%' },
        CDM: { top: '62%', left: '50%' },
        CM1: { top: '48%', left: '25%' },
        CM2: { top: '48%', left: '75%' },
        CAM: { top: '32%', left: '50%' },
        ST1: { top: '18%', left: '35%' },
        ST2: { top: '18%', left: '65%' }
    }
};
