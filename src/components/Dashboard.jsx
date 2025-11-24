import React, { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';

const Dashboard = ({ matchData, next3Matches = [], loading }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState(() => {
        // localStorage'dan oku
        const saved = localStorage.getItem('fb_notification_options');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return {
                    threeHours: false,
                    oneHour: false,
                    thirtyMinutes: false,
                    fifteenMinutes: false,
                    dailyCheck: false
                };
            }
        }
        return {
            threeHours: false,
            oneHour: false,
            thirtyMinutes: false,
            fifteenMinutes: false,
            dailyCheck: false
        };
    });
    const [hasActiveNotifications, setHasActiveNotifications] = useState(() => {
        // localStorage'dan oku
        const saved = localStorage.getItem('fb_has_notifications');
        return saved === 'true';
    });

    useEffect(() => {
        if (!matchData) return;

        const timer = setInterval(() => {
            const matchDate = new Date(matchData.startTimestamp * 1000);
            const now = new Date();
            const difference = matchDate - now;

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                setTimeLeft({ days, hours, minutes, seconds });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [matchData]);

    // Modal açıkken arka plan scroll'unu engelle
    useEffect(() => {
        if (showNotificationModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showNotificationModal]);

    if (loading) return <div className="flex items-center justify-center h-64 text-yellow-400 animate-pulse">Yükleniyor...</div>;
    if (!matchData) return <div className="text-center text-slate-400 mt-10">Maç bilgisi bulunamadı.</div>;

    const matchDate = new Date(matchData.startTimestamp * 1000);
    const FENERBAHCE_ID = 3052;
    const isHome = matchData.homeTeam.id === 3052; // 3052 is FB ID
    const opponent = isHome ? matchData.awayTeam : matchData.homeTeam;

    const toggleOption = (optionId) => {
        setSelectedOptions(prev => ({
            ...prev,
            [optionId]: !prev[optionId]
        }));
    };

    const saveNotifications = async () => {
        const hasSelection = Object.values(selectedOptions).some(val => val === true);
        
        if (!hasSelection) {
            alert('❌ En az 1 seçenek işaretleyin!');
            return;
        }

        try {
            // Request OneSignal Permission
            if (window.OneSignal) {
                try {
                    const permission = await window.OneSignal.Notifications.permission;
                    if (permission === false) {
                        // Request permission
                        const result = await window.OneSignal.Notifications.requestPermission();
                        if (!result) {
                            alert('⚠️ Bildirim izni verilmedi. Lütfen tarayıcı ayarlarından bildirimlere izin verin.');
                            return;
                        }
                    }
                } catch (err) {
                    console.error('OneSignal permission error:', err);
                }
            }

            // Get OneSignal Player ID
            let playerId = null;
            
            if (window.OneSignal) {
                try {
                    const userId = await window.OneSignal.User.PushSubscription.id;
                    if (userId) {
                        playerId = userId;
                    }
                } catch (err) {
                    // OneSignal not ready or not subscribed
                }
            }
            
            // Fallback: localStorage
            if (!playerId) {
                playerId = localStorage.getItem('fb_player_id');
                if (!playerId) {
                    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('fb_player_id', playerId);
                }
            }

            // Save to backend
            const BACKEND_URL = 'https://fenerbahce-backend.onrender.com';
            const response = await fetch(`${BACKEND_URL}/api/reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    options: selectedOptions,
                    matchData
                })
            });

            const data = await response.json();

            if (data.success) {
                const count = Object.values(selectedOptions).filter(v => v).length;
                setHasActiveNotifications(true);
                localStorage.setItem('fb_has_notifications', 'true');
                localStorage.setItem('fb_notification_options', JSON.stringify(selectedOptions)); // Seçenekleri de kaydet
                setShowNotificationModal(false);
                alert(`✅ ${count} bildirim ayarlandı!`);
            } else {
                alert('❌ Bir hata oluştu: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (error) {
            console.error('Error saving reminder:', error);
            alert('❌ Backend bağlantı hatası: ' + error.message);
        }
    };

    const notificationOptions = [
        { 
            id: 'threeHours', 
            label: 'Maçtan 3 saat önce', 
            description: 'Hazırlık yapmaya zamanın olsun'
        },
        { 
            id: 'oneHour', 
            label: 'Maçtan 1 saat önce', 
            description: 'Heyecan zamanı!'
        },
        { 
            id: 'thirtyMinutes', 
            label: 'Maçtan 30 dakika önce', 
            description: 'Son hazırlık'
        },
        { 
            id: 'fifteenMinutes', 
            label: 'Maçtan 15 dakika önce', 
            description: 'Maç başlıyor!'
        }
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Hero Section: Next Match Card */}
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <span className="text-xs font-bold tracking-wider text-yellow-400 uppercase bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                        {matchData.tournament.name}
                    </span>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-medium">
                            {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                        </span>
                        
                        {/* Bildirim İkonu */}
                        <button
                            onClick={() => setShowNotificationModal(true)}
                            className={`relative p-2.5 rounded-full transition-all duration-300 group ${
                                hasActiveNotifications 
                                    ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.5)]' 
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 hover:scale-110'
                            }`}
                            title="Bildirim ayarları"
                        >
                            {hasActiveNotifications ? (
                                // Zil aktif (dolu)
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10 20h4c0 1.1-.9 2-2 2s-2-.9-2-2zm8-6V9c0-3.07-1.64-5.64-4.5-6.32V2c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 3.36 6 5.92 6 9v5l-2 2v1h16v-1l-2-2z"/>
                                </svg>
                            ) : (
                                // Zil kapalı (kontur)
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            )}
                            
                            {/* Badge - Aktif bildirim sayısı */}
                            {hasActiveNotifications && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950 animate-pulse">
                                    {Object.values(selectedOptions).filter(v => v).length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex flex-col items-center gap-3 w-1/3">
                        <div className="w-16 h-16 rounded-full bg-white/5 p-2 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <TeamLogo
                                teamId={isHome ? FENERBAHCE_ID : opponent.id}
                                name={isHome ? 'Fenerbahçe' : opponent.name}
                                wrapperClassName="w-full h-full"
                                imageClassName="object-contain"
                            />
                        </div>
                        <span className="text-sm font-bold text-center leading-tight">
                            {isHome ? "Fenerbahçe" : opponent.name}
                        </span>
                    </div>

                    <div className="flex flex-col items-center justify-center w-1/3 -mt-4">
                        <span className="text-2xl font-black text-slate-700/50">VS</span>
                        <div className="mt-2 text-center">
                            <span className="text-3xl font-bold text-white tracking-tighter text-glow">
                                {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 w-1/3">
                        <div className="w-16 h-16 rounded-full bg-white/5 p-2 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                            <TeamLogo
                                teamId={!isHome ? FENERBAHCE_ID : opponent.id}
                                name={!isHome ? 'Fenerbahçe' : opponent.name}
                                wrapperClassName="w-full h-full"
                                imageClassName="object-contain"
                            />
                        </div>
                        <span className="text-sm font-bold text-center leading-tight">
                            {!isHome ? "Fenerbahçe" : opponent.name}
                        </span>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.days}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Gün</span>
                        </div>
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.hours}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Saat</span>
                        </div>
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.minutes}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Dk</span>
                        </div>
                        <div className="glass-panel rounded-lg p-2">
                            <span className="block text-xl font-bold text-yellow-400">{timeLeft.seconds}</span>
                            <span className="text-[10px] text-slate-400 uppercase">Sn</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Next 3 Matches */}
            <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-bold">Sonraki Maçlar</span>
                </div>
                <div className="space-y-3">
                    {next3Matches.length > 0 ? next3Matches.map((match, idx) => {
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

            {/* Bildirim Modal */}
            {showNotificationModal && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
                    onClick={() => setShowNotificationModal(false)}
                >
                    <div 
                        className="glass-card rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slideUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Bildirim Ayarları
                                </h2>
                                <p className="text-sm text-slate-400 mt-2">
                                    Ne zaman hatırlatmak istersin?
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowNotificationModal(false)}
                                className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Maç Bilgisi */}
                        <div className="glass-panel rounded-xl p-4 mb-6 border border-yellow-400/20">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-2">
                                        <div className="w-10 h-10 rounded-full bg-white/5 p-2 flex-shrink-0">
                                            <TeamLogo
                                                teamId={FENERBAHCE_ID}
                                                name="Fenerbahçe"
                                                wrapperClassName="w-full h-full"
                                                imageClassName="object-contain"
                                            />
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white/5 p-2 flex-shrink-0">
                                            <TeamLogo
                                                teamId={opponent.id}
                                                name={opponent.name}
                                                wrapperClassName="w-full h-full"
                                                imageClassName="object-contain"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-yellow-400 font-semibold">
                                            Fenerbahçe
                                        </p>
                                        <p className="text-[10px] text-slate-400">vs</p>
                                        <p className="text-xs text-white font-semibold">
                                            {opponent.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400">
                                        {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                    </p>
                                    <p className="text-lg font-bold text-yellow-400">
                                        {matchDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Seçenekler */}
                        <div className="space-y-3 mb-6">
                            {notificationOptions.map((option) => (
                                <label
                                    key={option.id}
                                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                        selectedOptions[option.id]
                                            ? 'bg-yellow-400/20 border-yellow-400 scale-[1.02]'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedOptions[option.id]}
                                        onChange={() => toggleOption(option.id)}
                                        className="mt-1 w-5 h-5 rounded border-2 border-yellow-400 bg-transparent checked:bg-yellow-400 cursor-pointer accent-yellow-400"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white">{option.label}</span>
                                            {option.time && (
                                                <span className="text-xs text-slate-400">({option.time})</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">{option.description}</p>
                                    </div>
                                </label>
                            ))}

                            {/* Günlük Kontrol - ÖZEL */}
                            <div className="pt-3 border-t border-white/10">
                                <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                    selectedOptions.dailyCheck
                                        ? 'bg-blue-400/20 border-blue-400 scale-[1.02]'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedOptions.dailyCheck}
                                        onChange={() => toggleOption('dailyCheck')}
                                        className="mt-1 w-5 h-5 rounded border-2 border-blue-400 bg-transparent checked:bg-blue-400 cursor-pointer accent-blue-400"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white">Günlük Maç Kontrolü</span>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">ÖZEL</span>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Her sabah 09:00'da kontrol et, o gün maç varsa bildir
                                        </p>
                                        <p className="text-[10px] text-blue-300/60 mt-1 italic">
                                            * Tüm maçlar için geçerli (sadece bu maça özel değil)
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Seçim Özeti */}
                        {Object.values(selectedOptions).some(v => v) && (
                            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-4 animate-fadeIn">
                                <p className="text-xs text-yellow-200">
                                    <strong className="text-yellow-400">{Object.values(selectedOptions).filter(v => v).length}</strong> bildirim seçtiniz
                                </p>
                            </div>
                        )}

                        {/* Butonlar */}
                        <div className="flex gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNotificationModal(false);
                                }}
                                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 font-medium border border-white/10 hover:border-white/20"
                            >
                                İptal
                            </button>
                            <button
                                onClick={saveNotifications}
                                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-300 hover:to-yellow-400 transition-all duration-200 font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:scale-105"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
