import TeamLogo from './TeamLogo';
import type { MatchData } from '../types';

interface NextMatchesPanelProps {
    next3Matches: MatchData[];
}

const FENERBAHCE_ID: number = 3052;

const NextMatchesPanel: React.FC<NextMatchesPanelProps> = ({ next3Matches }) => {
    return (
        <div className="glass-panel rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-bold">Sonraki Maçlar</span>
            </div>
            <div className="space-y-3">
                {next3Matches.length > 0 ? next3Matches.map((match: MatchData, idx: number) => {
                    const date = new Date(match.startTimestamp * 1000);
                    const homeTeam = match.homeTeam;
                    const awayTeam = match.awayTeam;
                    const isFbHome = homeTeam.id === FENERBAHCE_ID;

                    return (
                        <div key={idx} className="glass-panel rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                                <TeamLogo
                                    teamId={isFbHome ? FENERBAHCE_ID : homeTeam.id}
                                    name={homeTeam.name}
                                    wrapperClassName="w-8 h-8 rounded-full bg-white/5 p-1 flex-shrink-0 border border-white/10"
                                    imageClassName="object-contain"
                                />
                                <span className="text-xs font-medium truncate">{homeTeam.name}</span>
                            </div>
                            <div className="flex flex-col items-center px-3">
                                <span className="text-[10px] text-slate-400">{date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                                <span className="text-xs font-bold">{date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                                <span className="text-xs font-medium truncate text-right">{awayTeam.name}</span>
                                <TeamLogo
                                    teamId={!isFbHome ? FENERBAHCE_ID : awayTeam.id}
                                    name={awayTeam.name}
                                    wrapperClassName="w-8 h-8 rounded-full bg-white/5 p-1 flex-shrink-0 border border-white/10"
                                    imageClassName="object-contain"
                                />
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center text-slate-500 text-xs py-4">Maç bilgisi yükleniyor...</div>
                )}
            </div>
        </div>
    );
};

export default NextMatchesPanel;
