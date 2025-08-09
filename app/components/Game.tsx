"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ROWS = 5;
const BASE_COLS = 2;

const ENCOURAGEMENTS = [
  "You're on a roll!",
  "Wow, that was fast — keep it going!",
  "Fantastic focus!",
  "Nice! Your memory is sharp.",
  "Great pace — next one!",
  "Boom! Nailed it.",
  "Smooth moves!",
  "Impressive!",
  "Crushing it!",
  "Keep that streak alive!",
] as const;

type WrongFlash = { row: number; col: number } | null;
type RainbowCell = { row: number; col: number; color: string } | null;

export default function Game() {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [cols, setCols] = useState(BASE_COLS);
  const [activeRow, setActiveRow] = useState(ROWS - 1);
  const [activeCol, setActiveCol] = useState(0);
  const [safePath, setSafePath] = useState<Set<string>>(() => new Set());
  const [visitedSafe, setVisitedSafe] = useState<Set<string>>(() => new Set());
  const [wrongFlash, setWrongFlash] = useState<WrongFlash>(null);
  const [rainbowCells, setRainbowCells] = useState<RainbowCell[]>([]);
  const [statusText, setStatusText] = useState('');
  const [overlayMessage, setOverlayMessage] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);

  // Shared audio context (created on first user gesture)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new Ctx();
      } catch {
        return null;
      }
    }
    const instance = audioCtxRef.current;
    if (!instance) return null;
    if (instance.state === 'suspended') {
      instance.resume().catch(() => {});
    }
    return instance;
  }, []);

  const gridTemplateColumnsStyle = useMemo(
    () => ({ gridTemplateColumns: `repeat(${cols}, 80px)` }),
    [cols]
  );

  const generatePath = useCallback((colsArg: number): Set<string> => {
    const next = new Set<string>();
    for (let r = 0; r < ROWS; r += 1) {
      const c = Math.floor(Math.random() * colsArg);
      next.add(`${r}-${c}`);
    }
    return next;
  }, []);

  const startLevel = useCallback((newPattern = true) => {
    const nextCols = BASE_COLS + Math.floor((currentLevel - 1) / 5);
    setCols(nextCols);
    if (newPattern) {
      setSafePath(generatePath(nextCols));
      setVisitedSafe(new Set());
    }
    setRainbowCells([]);
    setActiveRow(ROWS - 1);
    setActiveCol(0);
  }, [currentLevel, generatePath]);

  useEffect(() => {
    // initial
    startLevel(true);
    // Prepare audio on first interaction
    const handleFirstInteraction = () => {
      getAudioContext();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highlightEncouragement = useCallback((): string => {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    return msg;
  }, []);

  // Sound effects using shared AudioContext
  const playCorrectSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
      oscillator.onended = () => {
        try { oscillator.disconnect(); gainNode.disconnect(); } catch {}
      };
    } catch {}
  }, [getAudioContext]);

  const playWrongSound = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(200, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
      oscillator.onended = () => {
        try { oscillator.disconnect(); gainNode.disconnect(); } catch {}
      };
    } catch {}
  }, [getAudioContext]);

  const moveLeft = useCallback(() => {
    setActiveCol((c) => Math.max(0, c - 1));
  }, []);

  const moveRight = useCallback(() => {
    setActiveCol((c) => Math.min(cols - 1, c + 1));
  }, [cols]);

  const moveUp = useCallback(() => {
    // Only allow moving up if the current row is completed
    const isCurrentRowCompleted = Array.from(safePath).some(key => {
      const [row] = key.split('-');
      return parseInt(row) === activeRow && visitedSafe.has(key);
    });
    if (isCurrentRowCompleted && activeRow > 0) {
      setActiveRow((r) => r - 1);
    }
  }, [activeRow, safePath, visitedSafe]);

  const resetLevelSamePattern = useCallback(() => {
    setVisitedSafe(new Set());
    setWrongFlash(null);
    setRainbowCells([]);
    setActiveRow(ROWS - 1);
    setActiveCol(0);
  }, []);

  const selectCell = useCallback(() => {
    const key = `${activeRow}-${activeCol}`;
    const isSafe = safePath.has(key);

    if (isSafe) {
      playCorrectSound();
      setVisitedSafe((prev) => new Set(prev).add(key));
      const nextRow = activeRow - 1;
      if (nextRow < 0) {
        const justCleared = currentLevel;
        const nextLevel = justCleared + 1;
        const encouragement = highlightEncouragement();
        // Flash green tiles on/off for 2 seconds, then proceed
        const greenTiles: RainbowCell[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < cols; c++) {
            const k = `${r}-${c}`;
            if (safePath.has(k)) {
              greenTiles.push({ row: r, col: c, color: '#2bb36b' });
            }
          }
        }
        let on = true;
        setRainbowCells(greenTiles);
        const intervalMs = 200;
        const totalMs = 2000;
        let elapsed = 0;
        const iv = setInterval(() => {
          on = !on;
          setRainbowCells(on ? greenTiles : []);
          elapsed += intervalMs;
          if (elapsed >= totalMs) {
            clearInterval(iv);
            setRainbowCells([]);
            setOverlayMessage(`${encouragement}\nLevel ${justCleared} Passed!\nPrepare for Level ${nextLevel}!`);
            setOverlayVisible(true);
            setTimeout(() => {
              setOverlayVisible(false);
              setStatusText('');
              setCurrentLevel(nextLevel);
              const nextCols = BASE_COLS + Math.floor((nextLevel - 1) / 5);
              setCols(nextCols);
              setSafePath(generatePath(nextCols));
              setVisitedSafe(new Set());
              setActiveRow(ROWS - 1);
              setActiveCol(0);
            }, 1100);
          }
        }, intervalMs);
        return;
      }
      setActiveRow(nextRow);
    } else {
      playWrongSound();
      setWrongFlash({ row: activeRow, col: activeCol });
      setTimeout(() => setWrongFlash(null), 300);
      setTimeout(() => {
        resetLevelSamePattern();
      }, 320);
    }
  }, [activeRow, activeCol, cols, currentLevel, generatePath, highlightEncouragement, playCorrectSound, playWrongSound, resetLevelSamePattern, safePath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') moveLeft();
      else if (e.key === 'ArrowRight') moveRight();
      else if (e.key === 'ArrowUp') moveUp();
      else if (e.key === ' ' || e.key === 'Enter') selectCell();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveLeft, moveRight, moveUp, selectCell]);

  const renderCell = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    const isActive = activeRow === rowIndex && activeCol === colIndex;
    const isVisitedSafe = visitedSafe.has(key);
    const isWrong = wrongFlash && wrongFlash.row === rowIndex && wrongFlash.col === colIndex;
    const rainbowCell = rainbowCells.find(cell => cell?.row === rowIndex && cell?.col === colIndex);

    const classNames = [
      'cell',
      isActive ? 'active' : '',
      isVisitedSafe ? 'safe' : '',
      isWrong ? 'wrong' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const style = rainbowCell ? {
      background: rainbowCell.color,
      borderColor: rainbowCell.color,
      boxShadow: `0 0 20px ${rainbowCell.color}`,
      transition: 'all 0.3s ease'
    } : {};

    return (
      <div
        key={key}
        className={classNames}
        data-row={rowIndex}
        data-col={colIndex}
        style={style}
      />
    );
  };

  const rows = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      rows.push(renderCell(r, c));
    }
  }

  return (
    <div id="game-container">
      <div id="overlay" className={overlayVisible ? 'show' : ''}>
        <div className="overlay-text">{overlayMessage}</div>
      </div>
      <h1>Brain Train - Memory Challenge</h1>
      <div id="grid" style={gridTemplateColumnsStyle}>
        {rows}
      </div>
      <div id="mobile-controls">
        <button onClick={moveLeft} aria-label="Move left">←</button>
        <button onClick={moveUp} aria-label="Move up">↑</button>
        <button onClick={moveRight} aria-label="Move right">→</button>
        <button onClick={selectCell} aria-label="Select">✔</button>
      </div>
      <p id="status" className="subtle">{statusText}</p>
    </div>
  );
}
