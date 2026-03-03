const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
    <div className="glass-panel rounded-2xl p-4 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-8 w-full bg-white/5 rounded-lg mb-2 last:mb-0" />
        ))}
    </div>
);

export default SkeletonCard;
