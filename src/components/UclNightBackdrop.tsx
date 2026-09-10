/**
 * Champions League night backdrop.
 *
 * Three ways to dress the page, in this order:
 *
 * 1. A looping video, if one is present at
 *    `src/assets/ucl-backdrop.{mp4,webm}`. Muted, inline and looping, so iOS
 *    Safari will autoplay it; skipped entirely for anyone who asks for reduced
 *    motion, who gets 2 or 3 instead.
 * 2. An artwork frame at `src/assets/ucl-backdrop.{jpg,jpeg,png,webp}`. Doubles
 *    as the video's poster when both are present.
 * 3. Otherwise the drawn frame below.
 *
 * Drop the file in and that is the whole job — Vite hashes and serves it like
 * any other import.
 *
 * The drawn frame is a bundle of hairlines bent into a chevron, nearly all of them plain blue barely lighter
 * than the ground, and only a handful carrying colour. Those few are not a
 * colour each — a single hue sweep (violet, magenta, red, amber, lime, cyan)
 * runs along the whole length of every one of them, offset line to line, so the
 * bundle refracts rather than glows. That is the identity's stated principle:
 * white light through a prism, colour visible only at the edges.
 *
 * Purely decorative. Each bundle is its own fixed-size SVG so the lines keep the
 * same weight on a phone and on a desktop window rather than scaling with the
 * viewport.
 */

const dropped = (matches: Record<string, unknown>) =>
    Object.values(matches)[0] as string | undefined;

/** Empty unless a file has been dropped in; see (1) and (2) above. */
const MOTION = dropped(
    import.meta.glob('../assets/ucl-backdrop.{mp4,webm}', {
        eager: true,
        query: '?url',
        import: 'default',
    }),
);

const ARTWORK = dropped(
    import.meta.glob('../assets/ucl-backdrop.{jpg,jpeg,png,webp}', {
        eager: true,
        query: '?url',
        import: 'default',
    }),
);

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Line {
    width: number;
    /** Blue left between this line and the next one inwards. */
    gap: number;
    /**
     * Where this line starts in the hue sweep, 0–1. Undefined leaves the line
     * plain: pale blue, no colour at all — most of the bundle is these.
     */
    phase?: number;
    /** Only for plain lines: how far the pale blue comes up out of the ground. */
    tone?: number;
}

/**
 * Read from the outer edge of the bundle inwards. The uneven gaps are the
 * point — evenly spaced lines read as a comb, and the original bunches them.
 */
const LINES: Line[] = [
    { width: 1.4, gap: 3.2, tone: 0.3 },
    { width: 1, gap: 6.5, tone: 0.22 },
    { width: 1.2, gap: 3, tone: 0.34 },
    { width: 0.9, gap: 8, tone: 0.18 },
    { width: 1.5, gap: 3.4, tone: 0.42 },
    { width: 1.1, gap: 5, tone: 0.26 },
    { width: 1.3, gap: 9, tone: 0.2 },
    { width: 1.6, gap: 3, phase: 0.02 },
    { width: 1.2, gap: 2.6, phase: 0.12 },
    { width: 1.7, gap: 3.4, phase: 0.22 },
    { width: 1.1, gap: 6, tone: 0.3 },
    { width: 1.5, gap: 2.8, phase: 0.36 },
    { width: 1.3, gap: 3.2, phase: 0.46 },
    { width: 1.8, gap: 2.6, phase: 0.56 },
    { width: 1.2, gap: 7, phase: 0.68 },
    { width: 1, gap: 3.6, tone: 0.24 },
    { width: 1.4, gap: 3, phase: 0.82 },
    { width: 0.9, gap: 6.5, tone: 0.16 },
    { width: 1.2, gap: 3.4, tone: 0.28 },
    { width: 1, gap: 8, tone: 0.2 },
    { width: 1.3, gap: 3, tone: 0.36 },
    { width: 0.8, gap: 0, tone: 0.14 },
];

/**
 * The sweep every coloured line runs through, tail to tail. Each line enters it
 * at its own phase, so no two show the same colour at the same height.
 */
const SWEEP = ['#8f4bff', '#ff2b8f', '#ff3b2f', '#ff9c1e', '#ffe14d', '#a6ff4a', '#2ff2c8', '#35c8ff'];

/** Pale blue of the lines that carry no colour. */
const PLAIN = '#9cc4ff';

/** Opening between the two arms, in degrees. */
const OPENING = 116;
const ARM_LENGTH = 900;
/** Corner radius of the innermost line; every line outside it turns wider. */
const CORNER_RADIUS = 16;

/** Vertex of the innermost line, in viewBox units. The chevron points along +x. */
const VERTEX = { x: 150, y: 200 } as const;

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const HALF_OPENING = radians(OPENING / 2);

interface StackedLine extends Line {
    /** Perpendicular distance from the innermost line. */
    offset: number;
}

/**
 * Offsets are measured over the order the lines are drawn in, so a reversed
 * bundle keeps its spacing — pairing one order's widths with the other order's
 * offsets is what leaves uneven gaps.
 */
const stack = (reversed: boolean): StackedLine[] => {
    const ordered = reversed ? [...LINES].reverse() : LINES;
    let running = 0;

    const walked = ordered.map((line, index) => {
        if (index > 0) {
            const previous = ordered[index - 1];
            running += previous.width / 2 + line.width / 2 + (reversed ? line.gap : previous.gap);
        }
        return { ...line, offset: running };
    });

    const total = walked[walked.length - 1].offset;
    return walked.map((line) => ({ ...line, offset: total - line.offset }));
};

const OUTWARD = stack(false);

/** Where a line's own vertex sits, once it has been offset outwards. */
const vertexX = (offset: number) => VERTEX.x - offset / Math.sin(HALF_OPENING);

/** Half the height the chevron covers; the hue sweep is spent over it. */
const ARM_RISE = ARM_LENGTH * Math.sin(HALF_OPENING);

/**
 * A true parallel offset: the vertex slides back along the bisector by
 * offset / sin(θ/2), which keeps the gap between neighbouring lines even along
 * both arms, and the corner radius grows with the offset so the turns stay
 * concentric instead of bunching up.
 */
const chevron = (offset: number): string => {
    const x = vertexX(offset);
    const y = VERTEX.y;
    const radius = CORNER_RADIUS + offset;
    const tangent = radius / Math.tan(HALF_OPENING);

    const upperArm = Math.PI - HALF_OPENING;
    const lowerArm = Math.PI + HALF_OPENING;

    const point = (angle: number, distance: number) => ({
        x: (x + Math.cos(angle) * distance).toFixed(2),
        y: (y + Math.sin(angle) * distance).toFixed(2),
    });

    const upperEnd = point(upperArm, ARM_LENGTH);
    const upperTangent = point(upperArm, tangent);
    const lowerTangent = point(lowerArm, tangent);
    const lowerEnd = point(lowerArm, ARM_LENGTH);

    return [
        `M ${upperEnd.x} ${upperEnd.y}`,
        `L ${upperTangent.x} ${upperTangent.y}`,
        `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 0 ${lowerTangent.x} ${lowerTangent.y}`,
        `L ${lowerEnd.x} ${lowerEnd.y}`,
    ].join(' ');
};

/**
 * The paint for one coloured line. The sweep runs top to bottom rather than
 * along x, so the two arms never mirror each other's colour — one comes in
 * cyan while the other leaves magenta, and the bend is where they meet.
 */
function Sweep({ id, phase }: { id: string; phase: number }) {
    const stops = SWEEP.map((_, index) => {
        const position = index / (SWEEP.length - 1);
        const colour = SWEEP[(Math.round(phase * SWEEP.length) + index) % SWEEP.length];
        // Both tails give out before the arm leaves the screen.
        const opacity = position < 0.08 || position > 0.92 ? 0 : 1;
        return { position, colour, opacity };
    });

    return (
        <linearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1={VERTEX.x}
            y1={(VERTEX.y - ARM_RISE).toFixed(2)}
            x2={VERTEX.x}
            y2={(VERTEX.y + ARM_RISE).toFixed(2)}
        >
            {stops.map(({ position, colour, opacity }) => (
                <stop key={position} offset={position} stopColor={colour} stopOpacity={opacity} />
            ))}
        </linearGradient>
    );
}

const Stroke = ({
    offset,
    paint,
    width,
    opacity = 1,
}: {
    offset: number;
    paint: string;
    width: number;
    opacity?: number;
}) => (
    <path
        d={chevron(offset)}
        fill="none"
        stroke={paint}
        strokeWidth={width}
        strokeOpacity={opacity}
        strokeLinecap="round"
    />
);

interface BundleProps {
    className: string;
    idPrefix: string;
    /** Turns the vertex to face into the screen from its own corner. */
    rotation: number;
    /** Runs the bundle the other way, as facing corners do in the original. */
    reversed: boolean;
}

function LightWaves({ className, idPrefix, rotation, reversed }: BundleProps) {
    const lines = reversed ? stack(true) : OUTWARD;

    return (
        <svg
            className={className}
            viewBox="0 0 400 400"
            xmlns="http://www.w3.org/2000/svg"
            focusable="false"
        >
            <defs>
                <filter id={`${idPrefix}-glow`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" />
                </filter>
                {lines.map((line, index) =>
                    line.phase === undefined ? null : (
                        <Sweep
                            key={`${idPrefix}-sweep-${index}`}
                            id={`${idPrefix}-sweep-${index}`}
                            phase={line.phase}
                        />
                    ),
                )}
            </defs>

            <g transform={`rotate(${rotation} 200 200)`}>
                {/* Only the coloured lines throw any light. */}
                <g filter={`url(#${idPrefix}-glow)`}>
                    {lines.map((line, index) =>
                        line.phase === undefined ? null : (
                            <Stroke
                                key={`${idPrefix}-glow-${index}`}
                                offset={line.offset}
                                paint={`url(#${idPrefix}-sweep-${index})`}
                                width={line.width * 4}
                                opacity={0.4}
                            />
                        ),
                    )}
                </g>

                {lines.map((line, index) => (
                    <Stroke
                        key={`${idPrefix}-line-${index}`}
                        offset={line.offset}
                        paint={line.phase === undefined ? PLAIN : `url(#${idPrefix}-sweep-${index})`}
                        width={line.width}
                        opacity={line.phase === undefined ? line.tone ?? 0.25 : 1}
                    />
                ))}

                {/* A second, tighter pass over the coloured lines: the core of a
                    refracted line is brighter than its own colour. */}
                {lines.map((line, index) =>
                    line.phase === undefined ? null : (
                        <Stroke
                            key={`${idPrefix}-core-${index}`}
                            offset={line.offset}
                            paint="#ffffff"
                            width={line.width * 0.3}
                            opacity={0.35}
                        />
                    ),
                )}
            </g>
        </svg>
    );
}

export default function UclNightBackdrop() {
    if (MOTION && !prefersReducedMotion()) {
        return (
            <div className="ucl-night-backdrop" aria-hidden="true">
                <video
                    className="ucl-night-motion"
                    src={MOTION}
                    poster={ARTWORK}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    tabIndex={-1}
                />
                {/* Keeps the fixtures readable over whatever the clip does. */}
                <div className="ucl-night-scrim" />
            </div>
        );
    }

    if (ARTWORK) {
        return (
            <div className="ucl-night-backdrop" aria-hidden="true">
                <div className="ucl-night-artwork" style={{ backgroundImage: `url(${ARTWORK})` }} />
                {/* Keeps the fixtures readable over whatever the artwork does. */}
                <div className="ucl-night-scrim" />
            </div>
        );
    }

    return (
        <div className="ucl-night-backdrop" aria-hidden="true">
            <div className="ucl-night-bloom" />
            <LightWaves
                className="ucl-cluster ucl-cluster--top-right"
                idPrefix="ucl-tr"
                rotation={135}
                reversed={false}
            />
            <LightWaves
                className="ucl-cluster ucl-cluster--left"
                idPrefix="ucl-lf"
                rotation={0}
                reversed
            />
            <LightWaves
                className="ucl-cluster ucl-cluster--bottom-right"
                idPrefix="ucl-br"
                rotation={225}
                reversed={false}
            />
        </div>
    );
}
