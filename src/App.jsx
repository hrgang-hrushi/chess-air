import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import {
    RotateCcw,
    Trophy,
    ShieldAlert,
    Target,
    RefreshCw,
    Activity,
    History as HistoryIcon,
    Undo2,
    Settings2
} from 'lucide-react';

const App = () => {
    const [game, setGame] = useState(new Chess());
    const [moveFrom, setMoveFrom] = useState(null);
    const [optionSquares, setOptionSquares] = useState({});
    const [history, setHistory] = useState([]);
    const [winner, setWinner] = useState(null);
    const [gestureIntensity, setGestureIntensity] = useState(0);
    const [sensitivity, setSensitivity] = useState(1.2);
    const [isFreeMove, setIsFreeMove] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const boardRef = useRef(null);

    const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 });
    const [isPinching, setIsPinching] = useState(false);
    const [activeHandFound, setActiveHandFound] = useState(false);

    const rawTarget = useRef({ x: 50, y: 50 });
    const pinchBuffer = useRef([]);

    const LERP = 0.15;

    useEffect(() => {
        let frame;
        const loop = () => {
            setPointerPos(prev => ({
                x: prev.x + (rawTarget.current.x - prev.x) * LERP,
                y: prev.y + (rawTarget.current.y - prev.y) * LERP
            }));
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const loadMediaPipe = async () => {
            const scripts = [
                'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
                'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
                'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'
            ];
            for (const src of scripts) {
                if (!document.querySelector(`script[src="${src}"]`)) {
                    await new Promise(r => {
                        const s = document.createElement('script');
                        s.src = src; s.onload = r; document.head.appendChild(s);
                    });
                }
            }
            initTracking();
        };
        loadMediaPipe();
    }, []);

    const initTracking = () => {
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

                const dist = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
                const intensity = Math.max(0, Math.min(100, Math.round((0.10 - dist) * 1200)));
                setGestureIntensity(intensity);

                pinchBuffer.current.push(dist < 0.05);
                if (pinchBuffer.current.length > 5) pinchBuffer.current.shift();
                setIsPinching(pinchBuffer.current.filter(Boolean).length >= 4);

                const mirrorX = 1 - index.x;
                const screenCenterX = 0.5;
                const screenCenterY = 0.5;

                let offsetX = (mirrorX - screenCenterX) * sensitivity;
                let offsetY = (index.y - screenCenterY) * sensitivity;

                let targetX = (offsetX + 0.5) * 100;
                let targetY = (offsetY + 0.5) * 100;

                const snap = (val) => {
                    const gridStep = 100 / 8;
                    const center = (Math.floor(val / gridStep) * gridStep) + (gridStep / 2);
                    const distToCenter = Math.abs(val - center);
                    if (distToCenter < gridStep * 0.35) {
                        return val + (center - val) * 0.6;
                    }
                    return val;
                };

                rawTarget.current = {
                    x: Math.max(0, Math.min(100, snap(targetX))),
                    y: Math.max(0, Math.min(100, snap(targetY)))
                };

                window.drawConnectors(ctx, lms, window.HAND_CONNECTIONS, { color: '#ccff00', lineWidth: 1 });
            } else {
                setActiveHandFound(false);
                setIsPinching(false);
                setGestureIntensity(0);
            }
        });

        const camera = new window.Camera(videoRef.current, {
            onFrame: async () => { await hands.send({ image: videoRef.current }); },
            width: 1280, height: 720,
        });
        camera.start();
    };

    const checkGameOver = (currentChess) => {
        if (currentChess.isCheckmate()) { setWinner(currentChess.turn() === 'w' ? 'b' : 'w'); return true; }
        if (currentChess.isDraw()) { setWinner('draw'); return true; }
        return false;
    };

    const getSquareFromCoords = useCallback(() => {
        const col = Math.floor((pointerPos.x / 100) * 8);
        const row = Math.floor((pointerPos.y / 100) * 8);
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
            return `${String.fromCharCode(97 + col)}${8 - row}`;
        }
        return null;
    }, [pointerPos]);

    useEffect(() => {
        if (!activeHandFound || winner) return;
        const square = getSquareFromCoords();

        if (isPinching) {
            if (!moveFrom && square) {
                const piece = game.get(square);
                if (piece && (isFreeMove || piece.color === game.turn())) {
                    setMoveFrom(square);
                    if (!isFreeMove) {
                        const moves = game.moves({ square, verbose: true });
                        const opts = {};
                        moves.forEach(m => opts[m.to] = true);
                        setOptionSquares(opts);
                    }
                }
            }
        } else if (moveFrom) {
            if (square && square !== moveFrom) {
                try {
                    const newGame = new Chess(game.fen());
                    if (isFreeMove) {
                        const piece = newGame.get(moveFrom);
                        newGame.remove(moveFrom);
                        newGame.put(piece, square);
                        setHistory(h => [...h, { san: `${piece.type.toUpperCase()}${moveFrom}->${square}`, color: piece.color, fen: game.fen() }]);
                        setGame(newGame);
                    } else {
                        const move = newGame.move({ from: moveFrom, to: square, promotion: 'q' });
                        if (move) {
                            setHistory(h => [...h, { san: move.san, color: move.color, fen: game.fen() }]);
                            setGame(newGame);
                            checkGameOver(newGame);
                        }
                    }
                } catch (e) { }
            }
            setMoveFrom(null);
            setOptionSquares({});
        }
    }, [isPinching, pointerPos, activeHandFound, moveFrom, game, getSquareFromCoords, winner]);

    const undoMove = () => {
        if (history.length === 0 || winner) return;
        const lastMove = history[history.length - 1];
        setGame(new Chess(lastMove.fen));
        setHistory(history.slice(0, -1));
        setMoveFrom(null);
        setOptionSquares({});
    };

    const resetGame = () => {
        setGame(new Chess());
        setHistory([]);
        setWinner(null);
        setMoveFrom(null);
    };

    return (
        <div className="min-h-screen bg-[#080808] text-zinc-100 font-mono p-4 flex flex-col items-center justify-center overflow-hidden select-none">
            <video ref={videoRef} className="hidden" playsInline />

            <div className="w-full max-w-6xl flex justify-between items-center mb-6 bg-zinc-900/80 border border-white/5 p-4 rounded-2xl backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Interface</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${activeHandFound ? 'bg-[#ccff00]' : 'bg-red-600'}`} />
                            <span className="text-xs font-bold uppercase tracking-tight">{activeHandFound ? 'Link Ready' : 'Searching...'}</span>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Turn Control</span>
                        <span className={`text-xs font-bold uppercase ${game.turn() === 'w' ? 'text-white' : 'text-[#ccff00]'}`}>
                            {game.turn() === 'w' ? 'White' : 'Black'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={undoMove}
                        disabled={history.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-white hover:text-black disabled:opacity-30 rounded-xl transition-all border border-white/5 text-[10px] font-bold uppercase"
                    >
                        <Undo2 size={14} /> Undo Move
                    </button>
                    <button onClick={resetGame} className="p-2.5 bg-zinc-800 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-white/5">
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-stretch justify-center w-full max-w-6xl relative">
                <div className="w-full lg:w-64 flex flex-col gap-4">
                    <div className="bg-zinc-900/40 p-5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-4 text-[#ccff00]">
                            <Settings2 size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Tracking Params</span>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-[9px] text-zinc-500 uppercase font-bold">
                                    <span>Sensitivity</span>
                                    <span>{sensitivity.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range" min="0.5" max="2.5" step="0.1"
                                    value={sensitivity}
                                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ccff00]"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase font-bold">
                                    <span>Free Move Mode</span>
                                    <button
                                        onClick={() => setIsFreeMove(!isFreeMove)}
                                        className={`w-8 h-4 rounded-full transition-colors relative ${isFreeMove ? 'bg-[#ccff00]' : 'bg-zinc-800'}`}
                                    >
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isFreeMove ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                                    </button>
                                </div>
                            </div>
                            <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                                <p className="text-[9px] text-zinc-500 leading-tight">
                                    <span className="text-white block mb-1">PRO-TIP:</span>
                                    {isFreeMove
                                        ? "Free Move Enabled: You can move any piece to any square regardless of turns or rules."
                                        : "If the cursor is moving too far, decrease sensitivity. If it's hard to reach corners, increase it."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900/40 p-5 rounded-2xl border border-white/5 flex-1">
                        <div className="flex items-center gap-2 mb-3 text-white">
                            <Activity size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Biometrics</span>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] text-zinc-600 uppercase">Pinch Force</span>
                                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#ccff00] transition-all duration-75" style={{ width: `${gestureIntensity}%` }} />
                                </div>
                            </div>
                            <div className={`p-3 rounded-lg border flex justify-between items-center transition-all ${isPinching ? 'bg-[#ccff00]/10 border-[#ccff00]/30' : 'bg-black/40 border-white/5'}`}>
                                <span className="text-[9px] text-zinc-500 uppercase font-bold">Grip Status</span>
                                <span className={`text-[10px] font-black ${isPinching ? 'text-[#ccff00]' : 'text-zinc-800'}`}>{isPinching ? 'LOCKED' : 'READY'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div ref={boardRef} className={`relative p-1 bg-zinc-900 rounded-xl shadow-2xl border transition-all duration-500 overflow-hidden ${isFreeMove ? 'border-[#ccff00] ring-4 ring-[#ccff00]/20' : 'border-white/10'}`}>
                    {isFreeMove && (
                        <div className="absolute top-4 left-4 z-[150] px-2 py-1 bg-[#ccff00] text-black text-[8px] font-black uppercase rounded tracking-tighter animate-pulse">
                            Sandbox Active
                        </div>
                    )}
                    {winner && (
                        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
                            <div className="text-center">
                                <Trophy size={60} className="text-[#ccff00] mx-auto mb-4" />
                                <h2 className="text-4xl font-black mb-6">SESSION COMPLETE</h2>
                                <button onClick={resetGame} className="px-10 py-4 bg-[#ccff00] text-black rounded-full font-black text-xs hover:scale-105 transition-transform flex items-center gap-2 mx-auto">
                                    <RefreshCw size={16} /> RE-INITIALIZE
                                </button>
                            </div>
                        </div>
                    )}

                    <video ref={(el) => { if (el) el.srcObject = videoRef.current?.srcObject; }} autoPlay muted className="absolute inset-0 w-full h-full object-cover opacity-10 scale-x-[-1] pointer-events-none" />
                    <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full z-10 pointer-events-none opacity-30 scale-x-[-1]" />

                    {activeHandFound && !winner && (
                        <div className="absolute z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-75" style={{ left: `${pointerPos.x}%`, top: `${pointerPos.y}%` }}>
                            <div className={`w-14 h-14 rounded-lg border-2 transition-all flex items-center justify-center ${isPinching ? 'border-[#ccff00] scale-75 bg-[#ccff00]/10' : 'border-white/30 scale-100'}`}>
                                {isPinching && moveFrom && (
                                    <div className="text-4xl text-[#ccff00] drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]">
                                        {{ p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }[game.get(moveFrom)?.type]}
                                    </div>
                                )}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-[#ccff00] opacity-50" />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-[#ccff00] opacity-50" />
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-[#ccff00] opacity-50" />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-[#ccff00] opacity-50" />
                            </div>
                        </div>
                    )}

                    <div id="chess-board" className="relative z-20 grid grid-cols-8 bg-black/40" style={{ width: 'min(90vw, 560px)', height: 'min(90vw, 560px)' }}>
                        {Array.from({ length: 64 }).map((_, i) => {
                            const file = String.fromCharCode(97 + (i % 8));
                            const rank = 8 - Math.floor(i / 8);
                            const sq = `${file}${rank}`;
                            const p = game.get(sq);
                            const isDark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
                            const isSource = moveFrom === sq;

                            return (
                                <div key={sq} className={`relative flex items-center justify-center transition-all duration-200 ${isDark ? 'bg-zinc-900/40' : 'bg-white/5'} ${isSource ? 'bg-[#ccff00]/20 ring-2 ring-inset ring-[#ccff00]/40' : ''}`} style={{ aspectRatio: '1/1' }}>
                                    {optionSquares[sq] && <div className="absolute w-2.5 h-2.5 rounded-full bg-[#ccff00]/30 shadow-[0_0_12px_rgba(204,255,0,0.6)] animate-pulse" />}
                                    {p && !(isSource && isPinching) && (
                                        <div className={`text-4xl sm:text-5xl select-none drop-shadow-lg ${p.color === 'w' ? 'text-white' : 'text-[#ccff00]'}`}>
                                            {{ p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }[p.type]}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="w-full lg:w-64 bg-zinc-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-[560px]">
                    <div className="flex items-center gap-2 mb-4 text-zinc-500">
                        <HistoryIcon size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Neural Log</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                        {history.map((h, i) => (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-lg text-[10px] bg-black/40 border border-white/5`}>
                                <span className="text-zinc-600 font-bold">{i + 1}</span>
                                <span className={h.color === 'w' ? 'text-white font-black' : 'text-[#ccff00] font-black'}>{h.san}</span>
                                <span className="text-[8px] text-zinc-700 uppercase">{h.color === 'w' ? 'White' : 'Black'}</span>
                            </div>
                        ))}
                        {history.length === 0 && <div className="text-[9px] text-zinc-700 italic text-center mt-10">Waiting for first sequence...</div>}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #ccff00;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(204,255,0,0.4);
        }
      `}} />

            <div className="mt-8 mb-4 text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] opacity-50">
                Weekend Project by Hrushikesh Gangala
            </div>
        </div>
    );
};

export default App;
