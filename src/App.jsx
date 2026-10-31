import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
    ArrowRight,
    Check,
    ChevronRight,
    Copy,
    Crown,
    Globe,
    History,
    Link2,
    LogIn,
    PartyPopper,
    Play,
    Plus,
    RefreshCcw,
    Search,
    ShieldAlert,
    Sparkles,
    Users,
    UserRound,
    Wifi,
    X,
} from 'lucide-react';

const STORAGE_KEYS = {
    profile: 'chess-air:profile',
    rooms: 'chess-air:rooms',
    presence: 'chess-air:presence',
};

const CHANNEL_NAME = 'chess-air:lobby';
const PIECES = {
    p: '♟',
    r: '♜',
    n: '♞',
    b: '♝',
    q: '♛',
    k: '♚',
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function currentTimestamp() {
    return new Date().getTime();
}

function squareFromPointer(pointerPos, orientation) {
    const fileIndex = Math.max(0, Math.min(7, Math.floor((pointerPos.x / 100) * 8)));
    const rankIndex = Math.max(0, Math.min(7, Math.floor((pointerPos.y / 100) * 8)));
    const files = orientation === 'black' ? [...FILES].reverse() : FILES;
    const ranks = orientation === 'black' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    return `${files[fileIndex]}${ranks[rankIndex]}`;
}

function createId(prefix = 'player') {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function createRoomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function readJson(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
}

function mutateJson(key, fallback, updater) {
    const current = readJson(key, fallback);
    const next = updater(current);
    writeJson(key, next);
    return next;
}

function normalizeHandle(value) {
    return value.trim().replace(/\s+/g, ' ').slice(0, 20);
}

function boardSquares(orientation) {
    const ranks = orientation === 'black' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const files = orientation === 'black' ? [...FILES].reverse() : FILES;
    return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

function isGameFinished(game) {
    return (
        game.isCheckmate() ||
        game.isDraw() ||
        game.isStalemate() ||
        game.isThreefoldRepetition() ||
        game.isInsufficientMaterial()
    );
}

function resolvePlayerColor(room, playerId) {
    if (!room || !playerId) return null;
    if (room.hostId === playerId) return 'w';
    if (room.guestId === playerId) return 'b';
    return null;
}

function Panel({ title, eyebrow, icon: Icon, children, className = '' }) {
    return (
        <section className={`rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    {eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">{eyebrow}</p>}
                    <div className="flex items-center gap-2">
                        {Icon && <Icon size={15} className="text-[#c8ff2e]" />}
                        <h2 className="font-display text-lg font-semibold tracking-tight text-white">{title}</h2>
                    </div>
                </div>
            </div>
            {children}
        </section>
    );
}

function Pill({ children, tone = 'neutral' }) {
    const classes = {
        neutral: 'border-white/10 bg-white/5 text-zinc-200',
        success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        accent: 'border-[#c8ff2e]/25 bg-[#c8ff2e]/12 text-[#dfffa0]',
        danger: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
    };

    return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${classes[tone]}`}>{children}</span>;
}

function Field({ label, children, hint }) {
    return (
        <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-zinc-500">{label}</span>
            {children}
            {hint && <span className="block text-[11px] leading-relaxed text-zinc-500">{hint}</span>}
        </label>
    );
}

function ActionButton({ children, icon: Icon, variant = 'solid', className = '', ...props }) {
    const styles = {
        solid: 'bg-[#c8ff2e] text-black hover:bg-white',
        soft: 'bg-white/8 text-white hover:bg-white/12 border border-white/10',
        ghost: 'bg-transparent text-white hover:bg-white/8 border border-white/10',
        danger: 'bg-rose-500 text-white hover:bg-rose-400',
    };

    return (
        <button
            {...props}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${styles[variant]} ${className}`}
        >
            {Icon && <Icon size={16} />}
            {children}
        </button>
    );
}

function OnboardingModal({ draft, setDraft, onSubmit, onClose, step, setStep }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(200,255,46,0.14),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_34%)]" />
            <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#08090b] shadow-[0_40px_140px_rgba(0,0,0,0.65)]">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Onboarding</p>
                        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Set up your chess room</h2>
                    </div>
                    <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-5">
                    <div className="mb-6 flex items-center gap-2">
                        {[0, 1, 2].map((index) => (
                            <div key={index} className={`h-1.5 flex-1 rounded-full transition-all ${index <= step ? 'bg-[#c8ff2e]' : 'bg-white/10'}`} />
                        ))}
                    </div>

                    {step === 0 && (
                        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
                            <div className="space-y-4">
                                <Pill tone="accent">Welcome</Pill>
                                <h3 className="font-display text-3xl font-semibold tracking-tight text-white">Your handle appears in the lobby and in room invites.</h3>
                                <p className="max-w-xl text-sm leading-7 text-zinc-400">Chess Air uses a lightweight, local multiplayer layer. Pick a name, then either challenge someone who is online or share a room code with a friend.</p>
                                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                                    <p className="mb-2 flex items-center gap-2 font-bold text-white"><ShieldAlert size={15} className="text-[#c8ff2e]" />Quick heads up</p>
                                    <p>Rooms sync across open tabs in this browser. No account is required to play, but your handle makes the lobby readable.</p>
                                </div>
                            </div>

                            <div className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5">
                                <Field label="Display name" hint="This is the name other players see in the lobby.">
                                    <input
                                        value={draft.handle}
                                        onChange={(event) => setDraft((current) => ({ ...current, handle: event.target.value }))}
                                        placeholder="e.g. Luna"
                                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#c8ff2e]/60 focus:ring-2 focus:ring-[#c8ff2e]/20"
                                    />
                                </Field>

                                <Field label="Default entry" hint="You can switch modes later from the lobby.">
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {[
                                            { value: 'duel', label: 'Duel' },
                                            { value: 'room', label: 'Room code' },
                                            { value: 'solo', label: 'Solo' },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setDraft((current) => ({ ...current, mode: option.value }))}
                                                className={`rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${draft.mode === option.value ? 'border-[#c8ff2e]/40 bg-[#c8ff2e]/12 text-[#dfffa0]' : 'border-white/10 bg-white/5 text-white hover:bg-white/8'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="grid gap-4 md:grid-cols-3">
                            {[
                                { value: 'quick', title: 'Quick duel', description: 'See who is online, send an invite, and open a room with one click.', icon: Users },
                                { value: 'code', title: 'Room code', description: 'Share a short code with a friend and let them join directly.', icon: Link2 },
                                { value: 'solo', title: 'Practice', description: 'Play locally while you wait for a room to fill.', icon: Play },
                            ].map((card) => (
                                <button
                                    key={card.value}
                                    type="button"
                                    onClick={() => setDraft((current) => ({ ...current, mode: card.value === 'quick' ? 'duel' : card.value }))}
                                    className={`rounded-[26px] border p-4 text-left transition ${draft.mode === (card.value === 'quick' ? 'duel' : card.value) ? 'border-[#c8ff2e]/40 bg-[#c8ff2e]/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}
                                >
                                    <card.icon size={16} className="mb-4 text-[#c8ff2e]" />
                                    <h3 className="mb-2 font-display text-lg font-semibold text-white">{card.title}</h3>
                                    <p className="text-sm leading-6 text-zinc-400">{card.description}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid gap-4 md:grid-cols-[1fr_0.7fr]">
                            <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Ready to go</p>
                                <h3 className="font-display text-3xl font-semibold tracking-tight text-white">Start with {draft.mode === 'solo' ? 'practice' : draft.mode === 'room' ? 'a room code' : 'a live duel'}.</h3>
                                <p className="text-sm leading-7 text-zinc-400">You can still switch modes later. The important part is your lobby identity and the first room entry point.</p>
                            </div>
                            <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
                                <div className="mb-3 flex items-center gap-2 text-[#c8ff2e]"><Sparkles size={14} /><span className="text-[10px] font-bold uppercase tracking-[0.28em]">Preview</span></div>
                                <div className="space-y-3 text-sm text-zinc-300">
                                    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"><span className="text-zinc-500">Handle</span><span className="font-bold text-white">{normalizeHandle(draft.handle) || 'Player'}</span></div>
                                    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"><span className="text-zinc-500">Mode</span><span className="font-bold text-white capitalize">{draft.mode}</span></div>
                                    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"><span className="text-zinc-500">Room style</span><span className="font-bold text-white">Shared across tabs</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
                    <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-30" disabled={step === 0}>
                        Back
                    </button>

                    <div className="flex items-center gap-2">
                        {step < 2 ? (
                            <ActionButton
                                type="button"
                                onClick={() => setStep((current) => current + 1)}
                                icon={ChevronRight}
                                variant="solid"
                                className="px-5 py-2.5"
                            >
                                Continue
                            </ActionButton>
                        ) : (
                            <ActionButton type="button" onClick={onSubmit} icon={LogIn} variant="solid" className="px-5 py-2.5">
                                Enter lobby
                            </ActionButton>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [profile, setProfile] = useState(() => readJson(STORAGE_KEYS.profile, null));
    const [draft, setDraft] = useState(() => profile ?? { id: createId(), handle: '', mode: 'duel' });
    const [onboardingOpen, setOnboardingOpen] = useState(() => !readJson(STORAGE_KEYS.profile, null));
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [rooms, setRooms] = useState(() => readJson(STORAGE_KEYS.rooms, {}));
    const [presence, setPresence] = useState(() => readJson(STORAGE_KEYS.presence, {}));
    const [activeRoomCode, setActiveRoomCode] = useState('');
    const [localGame, setLocalGame] = useState(() => new Chess());
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [notice, setNotice] = useState('');
    const [incomingInvite, setIncomingInvite] = useState(null);
    const [gestureIntensity, setGestureIntensity] = useState(0);
    const [sensitivity, setSensitivity] = useState(1.2);
    const [isFreeMove, setIsFreeMove] = useState(false);
    const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 });
    const [isPinching, setIsPinching] = useState(false);
    const [activeHandFound, setActiveHandFound] = useState(false);
    const channelRef = useRef(null);
    const profileRef = useRef(profile);
    const activeRoomRef = useRef(activeRoomCode);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const boardRef = useRef(null);
    const rawTarget = useRef({ x: 50, y: 50 });
    const pinchBuffer = useRef([]);
    const previousPinchRef = useRef(false);

    const broadcastSync = useCallback((message) => {
        const existingChannel = channelRef.current;
        if (existingChannel) {
            try {
                existingChannel.postMessage(message);
                return;
            } catch {
                try {
                    existingChannel.close();
                } catch {
                    // Ignore close failures.
                }
                channelRef.current = null;
            }
        }

        if (typeof BroadcastChannel === 'undefined') return;

        const nextChannel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = nextChannel;
        try {
            nextChannel.postMessage(message);
        } catch {
            // Ignore a final broadcast failure; storage events still keep tabs in sync.
        }
    }, []);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    useEffect(() => {
        activeRoomRef.current = activeRoomCode;
    }, [activeRoomCode]);

    useEffect(() => {
        const onStorage = () => {
            setRooms(readJson(STORAGE_KEYS.rooms, {}));
            setPresence(readJson(STORAGE_KEYS.presence, {}));
        };

        window.addEventListener('storage', onStorage);
        onStorage();
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        if (!profile) return undefined;

        const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
        channelRef.current = channel;

        const handleMessage = (event) => {
            const message = event.data;
            if (!message || message.origin === profile.id) return;

            if (message.type === 'sync') {
                setRooms(readJson(STORAGE_KEYS.rooms, {}));
                setPresence(readJson(STORAGE_KEYS.presence, {}));
                return;
            }

            if (message.type === 'invite' && message.toId === profile.id) {
                setIncomingInvite(message.invite);
                setNotice(`${message.fromHandle} invited you to room ${message.invite.code}.`);
            }
        };

        channel?.addEventListener('message', handleMessage);
        return () => {
            channel?.removeEventListener('message', handleMessage);
            channel?.close();
            if (channelRef.current === channel) {
                channelRef.current = null;
            }
        };
    }, [profile]);

    useEffect(() => {
        if (!profile) return undefined;

        const publish = () => {
            const nextPresence = mutateJson(STORAGE_KEYS.presence, {}, (current) => ({
                ...current,
                [profile.id]: {
                    id: profile.id,
                    handle: profile.handle,
                    mode: profile.mode,
                    roomCode: activeRoomRef.current || null,
                    updatedAt: currentTimestamp(),
                },
            }));
            setPresence(nextPresence);
            broadcastSync({ type: 'sync', origin: profile.id });
        };

        publish();
        const interval = window.setInterval(publish, 3000);

        return () => {
            window.clearInterval(interval);
        };
    }, [profile, activeRoomCode, broadcastSync]);

    useEffect(() => {
        return () => {
            const currentProfile = profileRef.current;
            if (!currentProfile) return;

            mutateJson(STORAGE_KEYS.presence, {}, (current) => {
                const next = { ...current };
                delete next[currentProfile.id];
                return next;
            });
        };
    }, []);

    useEffect(() => {
        let frame;

        const loop = () => {
            setPointerPos((prev) => ({
                x: prev.x + (rawTarget.current.x - prev.x) * 0.15,
                y: prev.y + (rawTarget.current.y - prev.y) * 0.15,
            }));
            frame = window.requestAnimationFrame(loop);
        };

        frame = window.requestAnimationFrame(loop);
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const loadMediaPipe = async () => {
            const scripts = [
                'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
                'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
                'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
            ];

            for (const src of scripts) {
                if (!document.querySelector(`script[src="${src}"]`)) {
                    await new Promise((resolve) => {
                        const script = document.createElement('script');
                        script.src = src;
                        script.onload = resolve;
                        document.head.appendChild(script);
                    });
                }
            }

            if (!videoRef.current || !canvasRef.current || !window.Hands || !window.Camera) return;

            const hands = new window.Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7,
            });

            hands.onResults((results) => {
                if (!canvasRef.current || !videoRef.current) return;
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    setActiveHandFound(true);
                    const lms = results.multiHandLandmarks[0];
                    const thumb = lms[4];
                    const index = lms[8];

                    const dist = Math.sqrt(((thumb.x - index.x) ** 2) + ((thumb.y - index.y) ** 2));
                    const intensity = Math.max(0, Math.min(100, Math.round((0.1 - dist) * 1200)));
                    setGestureIntensity(intensity);

                    pinchBuffer.current.push(dist < 0.05);
                    if (pinchBuffer.current.length > 5) pinchBuffer.current.shift();
                    setIsPinching(pinchBuffer.current.filter(Boolean).length >= 4);

                    const mirrorX = 1 - index.x;
                    const offsetX = (mirrorX - 0.5) * sensitivity;
                    const offsetY = (index.y - 0.5) * sensitivity;

                    const snap = (value) => {
                        const gridStep = 100 / 8;
                        const center = (Math.floor(value / gridStep) * gridStep) + (gridStep / 2);
                        const distance = Math.abs(value - center);
                        if (distance < gridStep * 0.35) {
                            return value + ((center - value) * 0.6);
                        }
                        return value;
                    };

                    rawTarget.current = {
                        x: Math.max(0, Math.min(100, snap((offsetX + 0.5) * 100))),
                        y: Math.max(0, Math.min(100, snap((offsetY + 0.5) * 100))),
                    };

                    window.drawConnectors(ctx, lms, window.HAND_CONNECTIONS, { color: '#c8ff2e', lineWidth: 1 });
                } else {
                    setActiveHandFound(false);
                    setIsPinching(false);
                    setGestureIntensity(0);
                }
            });

            const camera = new window.Camera(videoRef.current, {
                onFrame: async () => { await hands.send({ image: videoRef.current }); },
                width: 1280,
                height: 720,
            });

            camera.start();
        };

        loadMediaPipe();
    }, [sensitivity]);

    const activeRoom = activeRoomCode ? rooms[activeRoomCode] ?? null : null;
    const activeGame = useMemo(() => (activeRoom ? new Chess(activeRoom.fen) : localGame), [activeRoom, localGame]);
    const myColor = useMemo(() => resolvePlayerColor(activeRoom, profile?.id), [activeRoom, profile]);
    const boardOrientation = activeRoom && myColor === 'b' ? 'black' : 'white';
    const targetedSquare = useMemo(() => squareFromPointer(pointerPos, boardOrientation), [pointerPos, boardOrientation]);
    const visibleSquares = useMemo(() => boardSquares(boardOrientation), [boardOrientation]);
    const legalTargets = useMemo(() => {
        if (!selectedSquare) return {};
        const next = {};
        activeGame.moves({ square: selectedSquare, verbose: true }).forEach((move) => {
            next[move.to] = true;
        });
        return next;
    }, [selectedSquare, activeGame]);
    const activeHistory = activeRoom ? activeRoom.history ?? [] : [];
    const onlinePlayers = Object.values(presence)
        .filter((player) => player.id !== profile?.id && currentTimestamp() - (player.updatedAt ?? 0) < 7000)
        .sort((left, right) => left.handle.localeCompare(right.handle));
    const boardGame = activeRoom ? activeGame : localGame;
    const targetedPiece = boardGame.get(targetedSquare);
    const selectedPiece = selectedSquare ? boardGame.get(selectedSquare) : null;
    const isTargetLegal = Boolean(selectedSquare && legalTargets[targetedSquare]);

    const saveRoom = useCallback((room) => {
        const nextRooms = mutateJson(STORAGE_KEYS.rooms, {}, (current) => ({
            ...current,
            [room.code]: room,
        }));
        setRooms(nextRooms);
        broadcastSync({ type: 'sync', origin: profile?.id ?? 'system' });
        return room;
    }, [broadcastSync, profile?.id]);

    const removeRoom = useCallback((code) => {
        const nextRooms = mutateJson(STORAGE_KEYS.rooms, {}, (current) => {
            const next = { ...current };
            delete next[code];
            return next;
        });
        setRooms(nextRooms);
        broadcastSync({ type: 'sync', origin: profile?.id ?? 'system' });
    }, [broadcastSync, profile?.id]);

    const finishOnboarding = () => {
        const handle = normalizeHandle(draft.handle) || `Player${Math.floor(Math.random() * 900 + 100)}`;
        const nextProfile = {
            id: profile?.id ?? draft.id ?? createId(),
            handle,
            mode: draft.mode,
        };
        writeJson(STORAGE_KEYS.profile, nextProfile);
        setProfile(nextProfile);
        setDraft(nextProfile);
        setOnboardingOpen(false);
        setOnboardingStep(0);
        setNotice(`Welcome, ${handle}.`);
    };

    const openOnboarding = () => {
        setDraft(profile ?? { id: createId(), handle: '', mode: 'duel' });
        setOnboardingStep(0);
        setOnboardingOpen(true);
    };

    const createRoom = () => {
        if (!profile) {
            openOnboarding();
            return;
        }

        const code = createRoomCode();
        const nextRoom = {
            code,
            hostId: profile.id,
            hostHandle: profile.handle,
            guestId: null,
            guestHandle: null,
            status: 'waiting',
            fen: new Chess().fen(),
            history: [],
            winner: null,
            turn: 'w',
            createdAt: currentTimestamp(),
            updatedAt: currentTimestamp(),
        };

        saveRoom(nextRoom);
        setActiveRoomCode(code);
        setRoomCodeInput(code);
        setNotice(`Room ${code} is ready. Share it with a friend.`);
    };

    const joinRoom = (code = roomCodeInput) => {
        if (!profile) {
            openOnboarding();
            return;
        }

        const roomKey = code.trim().toUpperCase();
        if (!roomKey) {
            setNotice('Enter a room code first.');
            return;
        }

        const room = readJson(STORAGE_KEYS.rooms, {})[roomKey];
        if (!room) {
            setNotice(`Room ${roomKey} was not found.`);
            return;
        }

        if (room.hostId === profile.id || room.guestId === profile.id) {
            setActiveRoomCode(roomKey);
            setRoomCodeInput(roomKey);
            setNotice(`Rejoined room ${roomKey}.`);
            return;
        }

        if (room.guestId && room.guestId !== profile.id) {
            setNotice(`Room ${roomKey} is already full.`);
            return;
        }

        const nextRoom = {
            ...room,
            guestId: profile.id,
            guestHandle: profile.handle,
            status: 'playing',
            updatedAt: currentTimestamp(),
        };

        saveRoom(nextRoom);
        setActiveRoomCode(roomKey);
        setRoomCodeInput(roomKey);
        setNotice(`Joined room ${roomKey}.`);
    };

    const leaveRoom = () => {
        if (!activeRoom || !profile) return;

        const room = { ...activeRoom };
        if (room.hostId === profile.id) {
            if (room.guestId) {
                room.hostId = room.guestId;
                room.hostHandle = room.guestHandle;
                room.guestId = null;
                room.guestHandle = null;
                room.status = 'waiting';
                room.updatedAt = currentTimestamp();
                saveRoom(room);
            } else {
                removeRoom(room.code);
            }
        } else if (room.guestId === profile.id) {
            room.guestId = null;
            room.guestHandle = null;
            room.status = 'waiting';
            room.updatedAt = currentTimestamp();
            saveRoom(room);
        }

        setActiveRoomCode('');
        setSelectedSquare(null);
        setNotice(`Left room ${room.code}.`);
    };

    const quickChallenge = () => {
        if (!profile) {
            openOnboarding();
            return;
        }

        const target = onlinePlayers.find((player) => !player.roomCode);
        if (!target) {
            createRoom();
            setNotice('No one is available right now, so the room stays open with a code.');
            return;
        }

        const code = createRoomCode();
        const nextRoom = {
            code,
            hostId: profile.id,
            hostHandle: profile.handle,
            guestId: null,
            guestHandle: null,
            status: 'waiting',
            fen: new Chess().fen(),
            history: [],
            winner: null,
            turn: 'w',
            createdAt: currentTimestamp(),
            updatedAt: currentTimestamp(),
        };

        saveRoom(nextRoom);
        setActiveRoomCode(code);
        setRoomCodeInput(code);
        broadcastSync({
            type: 'invite',
            origin: profile.id,
            toId: target.id,
            fromHandle: profile.handle,
            invite: {
                code,
                from: profile.handle,
                roomId: code,
            },
        });
        setNotice(`Invite sent to ${target.handle}.`);
    };

    const acceptInvite = () => {
        if (!incomingInvite) return;
        joinRoom(incomingInvite.code);
        setIncomingInvite(null);
    };

    const syncBoardState = (nextRoom) => {
        const nextGame = new Chess(nextRoom.fen);
        if (nextGame.isCheckmate()) {
            nextRoom.status = 'finished';
            nextRoom.winner = nextGame.turn() === 'w' ? 'b' : 'w';
        } else if (isGameFinished(nextGame)) {
            nextRoom.status = 'finished';
            nextRoom.winner = 'draw';
        } else if (!nextRoom.guestId) {
            nextRoom.status = 'waiting';
        } else {
            nextRoom.status = 'playing';
        }
        nextRoom.turn = nextGame.turn();
        nextRoom.updatedAt = currentTimestamp();
        return nextRoom;
    };

    const commitMove = useCallback((from, to) => {
        const game = new Chess(activeRoom ? activeRoom.fen : localGame.fen());
        if (!activeRoom) {
            if (isFreeMove) {
                const piece = game.get(from);
                if (!piece) {
                    return;
                }

                game.remove(from);
                game.put(piece, to);
                setLocalGame(game);
                setSelectedSquare(null);
                setNotice(`${piece.type.toUpperCase()} moved.`);
                return;
            }

            const move = game.move({ from, to, promotion: 'q' });
            if (!move) {
                setNotice('That move is not legal.');
                return;
            }

            setLocalGame(game);
            setSelectedSquare(null);
            setNotice(`${move.san} played.`);
            return;
        }

        const move = game.move({ from, to, promotion: 'q' });

        if (!move) {
            setNotice('That move is not legal.');
            return;
        }

        const mySide = resolvePlayerColor(activeRoom, profile?.id);
        if (!mySide) {
            setNotice('Join the room to move pieces.');
            return;
        }

        if (activeRoom.status === 'finished') {
            setNotice('This room is already finished.');
            return;
        }

        if (activeRoom.turn !== mySide || game.turn() !== mySide) {
            setNotice('Wait for your turn.');
            return;
        }

        const nextRoom = syncBoardState({
            ...activeRoom,
            fen: game.fen(),
            history: [...(activeRoom.history ?? []), { san: move.san, from, to, color: move.color, at: currentTimestamp() }],
        });

        saveRoom(nextRoom);
        setSelectedSquare(null);
        setNotice(`${move.san} played.`);
    }, [activeRoom, isFreeMove, localGame, profile?.id, saveRoom]);

    useEffect(() => {
        if (!activeHandFound || !profile || !targetedSquare) {
            previousPinchRef.current = isPinching;
            return;
        }

        const game = activeRoom ? activeGame : localGame;
        const piece = game.get(targetedSquare);
        const canControlPiece = activeRoom
            ? Boolean(myColor && piece && piece.color === myColor)
            : Boolean(piece && (isFreeMove || piece.color === game.turn()));

        if (isPinching && !previousPinchRef.current && !selectedSquare && piece && canControlPiece && piece.color === game.turn()) {
            window.requestAnimationFrame(() => setSelectedSquare(targetedSquare));
        }

        if (!isPinching && previousPinchRef.current && selectedSquare) {
            if (targetedSquare && targetedSquare !== selectedSquare) {
                window.requestAnimationFrame(() => commitMove(selectedSquare, targetedSquare));
            }
            window.requestAnimationFrame(() => setSelectedSquare(null));
        }

        previousPinchRef.current = isPinching;
    }, [activeHandFound, activeGame, activeRoom, commitMove, isFreeMove, isPinching, localGame, myColor, profile, selectedSquare, targetedSquare]);

    const onSquareClick = (square) => {
        const game = activeRoom ? activeGame : localGame;
        const piece = game.get(square);
        const currentColor = activeRoom ? resolvePlayerColor(activeRoom, profile?.id) : null;

        if (!selectedSquare) {
            if (!piece) return;
            if (activeRoom && currentColor && piece.color !== currentColor) return;
            if (piece.color !== game.turn()) return;
            setSelectedSquare(square);
            return;
        }

        if (selectedSquare === square) {
            setSelectedSquare(null);
            return;
        }

        if (piece && piece.color === game.turn() && (!activeRoom || !currentColor || piece.color === currentColor)) {
            setSelectedSquare(square);
            return;
        }

        if (legalTargets[square]) {
            commitMove(selectedSquare, square);
            return;
        }

        setSelectedSquare(null);
    };

    const resetLocalGame = () => {
        if (activeRoom) return;
        setLocalGame(new Chess());
        setSelectedSquare(null);
        setNotice('Practice board reset.');
    };

    const copyRoomCode = async () => {
        if (!activeRoom) return;
        try {
            await navigator.clipboard.writeText(activeRoom.code);
            setNotice(`Room ${activeRoom.code} copied.`);
        } catch {
            setNotice(`Room ${activeRoom.code}.`);
        }
    };

    const moveHistory = activeRoom ? activeHistory : [];
    const topPlayerCount = onlinePlayers.length;
    const activeRoomLabel = activeRoom ? `${activeRoom.code}` : 'No room selected';
    const roomStatus = activeRoom ? activeRoom.status : profile?.mode === 'solo' ? 'practice' : 'lobby';

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#050607] text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(200,255,46,0.18),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_35%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:72px_72px]" />

            <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
                <header className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c8ff2e] text-black shadow-[0_0_40px_rgba(200,255,46,0.3)]">
                            <Crown size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-zinc-500">Chess Air</p>
                            <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Onboarding-first chess lobby</h1>
                            <p className="text-sm text-zinc-400">Challenge someone online, or share a room code and join from another tab or browser.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={topPlayerCount ? 'success' : 'neutral'}>
                            <Wifi size={11} className="mr-1" /> {topPlayerCount} online
                        </Pill>
                        <Pill tone={activeHandFound ? 'success' : 'neutral'}>
                            <Sparkles size={11} className="mr-1" /> {activeHandFound ? 'Hand ready' : 'Searching hand'}
                        </Pill>
                        <Pill tone="accent">
                            <Globe size={11} className="mr-1" /> {activeRoomLabel}
                        </Pill>
                        <ActionButton variant="soft" onClick={openOnboarding} icon={UserRound} className="px-4 py-2.5">Profile</ActionButton>
                        <ActionButton variant="ghost" onClick={quickChallenge} icon={PartyPopper} className="px-4 py-2.5">Quick duel</ActionButton>
                    </div>
                </header>

                {notice && (
                    <div className="flex items-center justify-between rounded-3xl border border-[#c8ff2e]/20 bg-[#c8ff2e]/10 px-4 py-3 text-sm text-[#f3ffd0]">
                        <span>{notice}</span>
                        <button onClick={() => setNotice('')} className="rounded-full p-1 transition hover:bg-white/10"><X size={14} /></button>
                    </div>
                )}

                {incomingInvite && (
                    <div className="flex flex-col gap-3 rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-50 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-100/70">Incoming invite</p>
                            <h3 className="font-display text-xl font-semibold text-white">{incomingInvite.from} wants to play room {incomingInvite.code}</h3>
                        </div>
                        <div className="flex gap-2">
                            <ActionButton variant="solid" icon={Check} onClick={acceptInvite}>Accept</ActionButton>
                            <ActionButton variant="soft" icon={X} onClick={() => setIncomingInvite(null)}>Dismiss</ActionButton>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-6">
                        <Panel title="Hand control" eyebrow="MVP" icon={ShieldAlert}>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm">
                                    <span className="text-zinc-500">Tracking</span>
                                    <span className={activeHandFound ? 'font-bold text-[#c8ff2e]' : 'font-bold text-zinc-400'}>{activeHandFound ? 'Live' : 'Waiting'}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                                        <span>Sensitivity</span>
                                        <span>{sensitivity.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.5"
                                        step="0.1"
                                        value={sensitivity}
                                        onChange={(event) => setSensitivity(parseFloat(event.target.value))}
                                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-[#c8ff2e]"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                                    <span>Free move mode</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsFreeMove(!isFreeMove)}
                                        className={`relative h-4 w-8 rounded-full transition-colors ${isFreeMove ? 'bg-[#c8ff2e]' : 'bg-zinc-800'}`}
                                    >
                                        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${isFreeMove ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                    </button>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] leading-6 text-zinc-400">
                                    <p className="mb-1 font-bold text-white">MVP tip</p>
                                    <p>{isFreeMove ? 'Free move is enabled for practice. Pinch a piece, then release over a target square.' : 'Pinch the piece you want to move with thumb and index finger, then release to drop it on a square.'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="rounded-2xl bg-white/5 px-3 py-3 text-center">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pinch</div>
                                        <div className={`mt-1 font-bold ${isPinching ? 'text-[#c8ff2e]' : 'text-zinc-400'}`}>{isPinching ? 'Locked' : 'Ready'}</div>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 px-3 py-3 text-center">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Force</div>
                                        <div className="mt-1 font-bold text-white">{gestureIntensity}%</div>
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        <Panel title="Lobby" eyebrow="Multiplayer" icon={Users}>
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <ActionButton icon={Sparkles} onClick={quickChallenge} variant="solid">Find opponent</ActionButton>
                                    <ActionButton icon={Plus} onClick={createRoom} variant="soft">Create room</ActionButton>
                                </div>

                                <Field label="Room code" hint="A friend can paste this code to join the same room.">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                            <input
                                                value={roomCodeInput}
                                                onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                                                placeholder="ABC123"
                                                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 font-mono text-lg uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 focus:border-[#c8ff2e]/60 focus:ring-2 focus:ring-[#c8ff2e]/20"
                                            />
                                        </div>
                                        <ActionButton icon={ArrowRight} onClick={() => joinRoom(roomCodeInput)} variant="solid">Join</ActionButton>
                                    </div>
                                </Field>

                                <div className="rounded-[26px] border border-white/10 bg-black/30 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">Your profile</p>
                                            <p className="font-display text-lg font-semibold text-white">{profile?.handle ?? 'Guest'}</p>
                                        </div>
                                        <Pill tone={profile?.mode === 'solo' ? 'neutral' : 'accent'}>{profile?.mode ?? 'duel'}</Pill>
                                    </div>
                                    <div className="grid gap-2 text-sm text-zinc-300">
                                        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2"><span className="text-zinc-500">Live rooms</span><span className="font-bold text-white">{Object.values(rooms).filter((room) => room.status === 'waiting' || room.status === 'playing').length}</span></div>
                                        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2"><span className="text-zinc-500">Presence</span><span className="font-bold text-white">{topPlayerCount} active</span></div>
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        <Panel title="Online now" eyebrow="Discovery" icon={Globe}>
                            <div className="space-y-3">
                                {onlinePlayers.length > 0 ? (
                                    onlinePlayers.map((player) => (
                                        <div key={player.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-display text-lg font-semibold text-white">{player.handle}</p>
                                                    <p className="text-xs text-zinc-500">{player.roomCode ? `In room ${player.roomCode}` : 'Available right now'}</p>
                                                </div>
                                                <Pill tone={player.roomCode ? 'neutral' : 'success'}>{player.roomCode ? 'Busy' : 'Open'}</Pill>
                                            </div>
                                            <div className="mt-3 flex gap-2">
                                                <ActionButton
                                                    variant="soft"
                                                    icon={PartyPopper}
                                                    onClick={() => {
                                                        const code = createRoomCode();
                                                        const nextRoom = {
                                                            code,
                                                            hostId: profile?.id ?? createId(),
                                                            hostHandle: profile?.handle ?? 'Player',
                                                            guestId: null,
                                                            guestHandle: null,
                                                            status: 'waiting',
                                                            fen: new Chess().fen(),
                                                            history: [],
                                                            winner: null,
                                                            turn: 'w',
                                                            createdAt: currentTimestamp(),
                                                            updatedAt: currentTimestamp(),
                                                        };
                                                        saveRoom(nextRoom);
                                                        setActiveRoomCode(code);
                                                        setRoomCodeInput(code);
                                                        broadcastSync({
                                                            type: 'invite',
                                                            origin: profile?.id ?? 'system',
                                                            toId: player.id,
                                                            fromHandle: profile?.handle ?? 'Player',
                                                            invite: { code, from: profile?.handle ?? 'Player', roomId: code },
                                                        });
                                                        setNotice(`Invite sent to ${player.handle}.`);
                                                    }}
                                                >
                                                    Challenge
                                                </ActionButton>
                                                <ActionButton variant="ghost" icon={Copy} onClick={copyRoomCode} disabled={!activeRoom}>
                                                    Share current code
                                                </ActionButton>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-[22px] border border-dashed border-white/10 bg-black/25 p-6 text-center text-sm text-zinc-500">
                                        No one else is online yet. Create a room and share the code, or open the app in another tab.
                                    </div>
                                )}
                            </div>
                        </Panel>

                        <Panel title="Room status" eyebrow="Current session" icon={Link2}>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm">
                                    <span className="text-zinc-500">Code</span>
                                    <span className="font-mono text-base font-bold tracking-[0.28em] text-white">{activeRoom?.code ?? '---'}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm">
                                    <span className="text-zinc-500">State</span>
                                    <span className="font-bold text-white capitalize">{roomStatus}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm">
                                    <span className="text-zinc-500">Turn</span>
                                    <span className="font-bold text-white">{boardGame.turn() === 'w' ? 'White' : 'Black'}</span>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <ActionButton variant="soft" icon={Copy} onClick={copyRoomCode} disabled={!activeRoom}>Copy code</ActionButton>
                                    <ActionButton variant="ghost" icon={X} onClick={leaveRoom} disabled={!activeRoom}>Leave</ActionButton>
                                </div>
                            </div>
                        </Panel>
                    </div>

                    <div className="space-y-6">
                        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:p-6">
                            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">Game board</p>
                                    <h2 className="font-display text-3xl font-semibold tracking-tight text-white">{activeRoom ? `Room ${activeRoom.code}` : 'Practice board'}</h2>
                                    <p className="text-sm text-zinc-400">{activeRoom ? `${activeRoom.status === 'waiting' ? 'Waiting for a guest' : 'Live room sync active'}` : 'You can play locally while you wait for someone to join.'}</p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Pill tone={activeRoom ? 'accent' : 'neutral'}>{activeRoom ? `You are ${myColor === 'w' ? 'White' : 'Black'}` : 'Local play'}</Pill>
                                    <Pill tone="success">{boardGame.turn() === 'w' ? 'White to move' : 'Black to move'}</Pill>
                                    {boardGame.isCheck() && <Pill tone="danger">Check</Pill>}
                                </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                                <div ref={boardRef} className={`relative overflow-hidden rounded-[30px] border border-white/10 bg-black/40 p-3 ${activeRoom ? 'ring-1 ring-[#c8ff2e]/15' : ''}`}>
                                    {activeRoom?.status === 'waiting' && (
                                        <div className="absolute left-4 top-4 z-20 rounded-2xl border border-[#c8ff2e]/20 bg-[#c8ff2e]/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#e8ffb5]">
                                            Share room code
                                        </div>
                                    )}

                                    <video ref={videoRef} className="hidden" playsInline />
                                    <canvas
                                        ref={canvasRef}
                                        width={640}
                                        height={480}
                                        className="pointer-events-none absolute inset-0 z-20 h-full w-full scale-x-[-1] opacity-30"
                                    />

                                    {activeHandFound && !isFreeMove && !activeRoom && (
                                        <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-2xl border border-[#c8ff2e]/20 bg-black/60 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c8ff2e]">
                                            Thumb + index control
                                        </div>
                                    )}

                                    {activeHandFound && (
                                        <div
                                            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                                            style={{ left: `${pointerPos.x}%`, top: `${pointerPos.y}%` }}
                                        >
                                            <div className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 ${isPinching ? 'scale-75 border-[#c8ff2e] bg-[#c8ff2e]/10' : 'border-white/30 bg-black/30'} ${selectedPiece ? 'shadow-[0_0_30px_rgba(200,255,46,0.18)]' : ''}`}>
                                                {selectedPiece && isPinching && (
                                                    <span className={`text-3xl drop-shadow-[0_0_10px_rgba(200,255,46,0.45)] ${selectedPiece.color === 'w' ? 'text-white' : 'text-[#c8ff2e]'}`}>
                                                        {PIECES[selectedPiece.type]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeHandFound && (
                                        <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-md">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Cursor</div>
                                            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                                                <span>{targetedSquare.toUpperCase()}</span>
                                                <span className="text-zinc-500">{isTargetLegal ? 'legal target' : 'hover target'}</span>
                                            </div>
                                            <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                                                {selectedPiece ? `${selectedSquare.toUpperCase()} lifted` : targetedPiece ? `${targetedPiece.color === 'w' ? 'White' : 'Black'} ${PIECES[targetedPiece.type]}` : 'Thumb + index ready'}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mx-auto grid aspect-square w-full max-w-[min(88vw,620px)] grid-cols-8 overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:max-w-[620px]">
                                        {visibleSquares.map((square) => {
                                            const piece = boardGame.get(square);
                                            const rank = square[1];
                                            const file = square[0];
                                            const dark = (FILES.indexOf(file) + Number(rank)) % 2 === 1;
                                            const source = selectedSquare === square;
                                            const target = targetedSquare === square;

                                            return (
                                                <button
                                                    key={square}
                                                    onClick={() => onSquareClick(square)}
                                                    className={`relative flex items-center justify-center transition-all duration-150 ${dark ? 'bg-[#0e1013]' : 'bg-[#ece8db]'} ${source ? 'ring-2 ring-inset ring-[#c8ff2e] bg-[#c8ff2e]/20' : ''} ${target && !source ? 'shadow-[inset_0_0_0_2px_rgba(200,255,46,0.35)]' : ''}`}
                                                >
                                                    {((boardOrientation === 'white' && file === 'a') || (boardOrientation === 'black' && file === 'h')) && (
                                                        <span className={`absolute left-1 top-1 text-[10px] font-bold uppercase ${dark ? 'text-zinc-500' : 'text-zinc-500/80'}`}>{rank}</span>
                                                    )}
                                                    {((boardOrientation === 'white' && rank === '1') || (boardOrientation === 'black' && rank === '8')) && (
                                                        <span className={`absolute bottom-1 right-1 text-[10px] font-bold uppercase ${dark ? 'text-zinc-500' : 'text-zinc-500/80'}`}>{file}</span>
                                                    )}

                                                    {legalTargets[square] && <span className="absolute h-3.5 w-3.5 rounded-full bg-[#c8ff2e]/35 shadow-[0_0_20px_rgba(200,255,46,0.45)]" />}
                                                    {piece && !(source && isPinching) && (
                                                        <span className={`relative select-none text-4xl sm:text-5xl ${piece.color === 'w' ? 'text-white [text-shadow:0_4px_16px_rgba(255,255,255,0.18)]' : 'text-[#90c400] [text-shadow:0_4px_16px_rgba(144,196,0,0.22)]'}`}>
                                                            {PIECES[piece.type]}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                        <Pill tone="neutral">{activeRoom ? 'Synced room' : 'Local training'}</Pill>
                                        <Pill tone={activeRoom ? 'success' : 'accent'}>{activeRoom ? `${activeHistory.length} moves shared` : 'No network dependency'}</Pill>
                                    </div>
                                </div>

                                <div className="flex flex-col rounded-[28px] border border-white/10 bg-black/30 p-4">
                                    <div className="mb-4 flex items-center gap-2 text-zinc-400">
                                        <History size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-[0.28em]">Move log</span>
                                    </div>
                                    <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
                                        {moveHistory.length > 0 ? (
                                            moveHistory.map((entry, index) => (
                                                <div key={`${entry.san}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm">
                                                    <span className="text-zinc-500">{index + 1}</span>
                                                    <span className={`font-bold ${entry.color === 'w' ? 'text-white' : 'text-[#c8ff2e]'}`}>{entry.san}</span>
                                                    <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">{entry.color === 'w' ? 'White' : 'Black'}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm text-zinc-500">
                                                No moves yet. Select one of your pieces to begin.
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <ActionButton icon={RefreshCcw} variant="soft" onClick={activeRoom ? undefined : resetLocalGame} className="flex-1" disabled={!!activeRoom}>
                                            Reset board
                                        </ActionButton>
                                        <ActionButton icon={Copy} variant="ghost" onClick={copyRoomCode} className="flex-1" disabled={!activeRoom}>
                                            Copy code
                                        </ActionButton>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 pb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-600">
                    <span>Local multiplayer framework with room codes and live presence.</span>
                    <span>Tab sync uses BroadcastChannel + storage events.</span>
                </footer>
            </main>

            {onboardingOpen && (
                <OnboardingModal
                    draft={draft}
                    setDraft={setDraft}
                    onSubmit={finishOnboarding}
                    onClose={() => setOnboardingOpen(false)}
                    step={onboardingStep}
                    setStep={setOnboardingStep}
                />
            )}
        </div>
    );
}

export default App;