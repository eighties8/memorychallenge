"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ROWS = 5;
const BASE_COLS = 2;
const LEVEL_SECONDS = 30;

const ENCOURAGEMENTS_FLAWLESS = [
  "You're on a roll!",
  "Wow, that was fast — keep it going!",
  "Fantastic focus!",
  "Nice! Your memory is sharp.",
  "Great pace — next one!",
  "Smooth moves!",
  "Impressive!",
  "Crushing it!",
  "Keep that streak alive!",
] as const;

const ENCOURAGEMENTS_GOOD = [
  "Great job — keep going!",
  "Solid work!",
  "Nice progress!",
  "Well done — next level awaits.",
] as const;

const ENCOURAGEMENTS_OKAY = [
  "Good persistence!",
  "Nice recovery — you got it.",
  "You're figuring it out — keep steady.",
  "You found the path!",
] as const;

const ENCOURAGEMENTS_RETRY = [
  "Practice makes perfect. Keep working.",
  "Progress over perfection — on to the next!",
  "Every try counts. You finished it!",
  "Stick with it — you're improving.",
] as const;

const TIME_CRUNCH = [
  "Just in the nick of time!",
  "Whew, that was a close one!",
  "Clutch finish!",
  "You beat the buzzer!",
] as const;

type WrongFlash = { row: number; col: number } | null;
type CelebrationCell = { row: number; col: number; color: string } | null;

export default function Game() {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [cols, setCols] = useState(BASE_COLS);
  const [activeRow, setActiveRow] = useState(ROWS - 1);
  const [activeCol, setActiveCol] = useState(0);
  const [safePath, setSafePath] = useState<Set<string>>(() => new Set());
  const [visitedSafe, setVisitedSafe] = useState<Set<string>>(() => new Set());
  const [wrongFlash, setWrongFlash] = useState<WrongFlash>(null);
  const [celebrationCells, setCelebrationCells] = useState<CelebrationCell[]>([]);
  const [statusText, setStatusText] = useState('');
  const [overlayLines, setOverlayLines] = useState<string[]>([]);
  const [overlayFlawless, setOverlayFlawless] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [score, setScore] = useState(0);
  const [mistakesInLevel, setMistakesInLevel] = useState(0);
  // Remember the safe column on the starting (bottom) row after it is first selected
  const [startRowSafeCol, setStartRowSafeCol] = useState<number | null>(null);

  // Mobile detection - use ref for immediate access, state for re-renders
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileDetected, setIsMobileDetected] = useState(false);

  // Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(LEVEL_SECONDS);
  const timerRef = useRef<number | null>(null);
  const [isTimePenalty, setIsTimePenalty] = useState(false);
  const [isTimerFlashing, setIsTimerFlashing] = useState(false);

  // First row highlighting for mobile - only on level start or timer expiration
  const [isFirstRowHighlighted, setIsFirstRowHighlighted] = useState(false);

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

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startLevelTimer = useCallback((seconds: number = LEVEL_SECONDS) => {
    clearTimer();
    setIsTimePenalty(false);
    setIsTimerFlashing(false);
    setRemainingSeconds(seconds);
    timerRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // timeout reached
          clearTimer();
          setIsTimePenalty(true);
          setIsTimerFlashing(true);
          setStatusText("Time's up! Resetting...");
          // Pause for 3 seconds while flashing, then reset to same pattern and restart timer
          setTimeout(() => {
            setIsTimerFlashing(false);
            resetLevelSamePattern();
            startLevelTimer(LEVEL_SECONDS);
            
            // Highlight first row on mobile for timer expiration
            if (isMobileRef.current) {
              setIsFirstRowHighlighted(true);
              // Flash the first row 3 times over 1.5 seconds
              setTimeout(() => setIsFirstRowHighlighted(false), 500);
              setTimeout(() => setIsFirstRowHighlighted(true), 1000);
              setTimeout(() => setIsFirstRowHighlighted(false), 1500);
            }
          }, 3000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const startLevel = useCallback((newPattern = true) => {
    const nextCols = BASE_COLS + Math.floor((currentLevel - 1) / 5);
    setCols(nextCols);
    if (newPattern) {
      setSafePath(generatePath(nextCols));
      setVisitedSafe(new Set());
    }
    setCelebrationCells([]);
    setActiveRow(ROWS - 1);
    setActiveCol(0);
    setMistakesInLevel(0);
    setStartRowSafeCol(null); // new pattern: forget previous start-row safe
    startLevelTimer(LEVEL_SECONDS);
    
    // Highlight first row on mobile for level start
    if (isMobileRef.current) {
      setIsFirstRowHighlighted(true);
      // Flash the first row 3 times over 1.5 seconds
      setTimeout(() => setIsFirstRowHighlighted(false), 500);
      setTimeout(() => setIsFirstRowHighlighted(true), 1000);
      setTimeout(() => setIsFirstRowHighlighted(false), 1500);
    }
  }, [currentLevel, generatePath, startLevelTimer]);

  useEffect(() => {
    // Mobile detection
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                             (window.innerWidth <= 768) ||
                             ('ontouchstart' in window);
      console.log('Mobile detection:', {
        userAgent: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        width: window.innerWidth,
        hasTouch: 'ontouchstart' in window,
        isMobile: isMobileDevice
      });
      isMobileRef.current = isMobileDevice;
      setIsMobile(isMobileDevice);
      setIsMobileDetected(true);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Prepare audio on first interaction
    const handleFirstInteraction = () => {
      getAudioContext();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start the first level immediately after mobile detection
  useEffect(() => {
    console.log('Starting first level with isMobile:', isMobileRef.current);
    startLevel(true);
  }, []); // Only run once on mount

  const chooseEncouragement = useCallback((mistakes: number): string => {
    if (mistakes <= 0) {
      const list = ENCOURAGEMENTS_FLAWLESS;
      return list[Math.floor(Math.random() * list.length)];
    }
    if (mistakes <= 2) {
      const list = ENCOURAGEMENTS_GOOD;
      return list[Math.floor(Math.random() * list.length)];
    }
    if (mistakes <= 5) {
      const list = ENCOURAGEMENTS_OKAY;
      return list[Math.floor(Math.random() * list.length)];
    }
    const list = ENCOURAGEMENTS_RETRY;
    return list[Math.floor(Math.random() * list.length)];
  }, []);

  const chooseTimeCrunch = useCallback((): string => {
    const list = TIME_CRUNCH;
    return list[Math.floor(Math.random() * list.length)];
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

  // Short victory melody: da-da-dah
  const playLevelCompleteMelody = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes: Array<{ freq: number; dur: number; gap?: number }> = [
      { freq: 523.25, dur: 0.18, gap: 0.04 }, // C5
      { freq: 659.25, dur: 0.18, gap: 0.04 }, // E5
      { freq: 783.99, dur: 0.34, gap: 0.00 }, // G5 (longer)
    ];
    let start = ctx.currentTime;
    for (const { freq, dur, gap = 0.04 } of notes) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur - 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
      } catch {}
      start += dur + gap;
    }
  }, [getAudioContext]);

  // Input guards during time penalty or overlay
  const inputLocked = overlayVisible || isTimePenalty;

  const bottomSafeLocked = useMemo(() => {
    if (activeRow !== ROWS - 1) return false;
    if (startRowSafeCol === null) return false;
    if (activeCol !== startRowSafeCol) return false;
    const key = `${ROWS - 1}-${startRowSafeCol}`;
    return !visitedSafe.has(key);
  }, [activeRow, activeCol, startRowSafeCol, visitedSafe]);

  const moveLeft = useCallback(() => {
    if (inputLocked) return;
    if (bottomSafeLocked) return; // keep cursor on known safe bottom cell until activated
    setActiveCol((c) => Math.max(0, c - 1));
  }, [inputLocked, bottomSafeLocked]);

  const moveRight = useCallback(() => {
    if (inputLocked) return;
    if (bottomSafeLocked) return; // keep cursor on known safe bottom cell until activated
    setActiveCol((c) => Math.min(cols - 1, c + 1));
  }, [cols, inputLocked, bottomSafeLocked]);

  const moveUp = useCallback(() => {
    if (inputLocked) return;
    // Only allow moving up if the current row is completed
    const isCurrentRowCompleted = Array.from(safePath).some(key => {
      const [row] = key.split('-');
      return parseInt(row) === activeRow && visitedSafe.has(key);
    });
    if (isCurrentRowCompleted && activeRow > 0) {
      setActiveRow((r) => r - 1);
    }
  }, [activeRow, inputLocked, safePath, visitedSafe]);

  const resetLevelSamePattern = useCallback(() => {
    setVisitedSafe(new Set());
    setWrongFlash(null);
    setCelebrationCells([]);
    setActiveRow(ROWS - 1);
    setActiveCol((prev) => (startRowSafeCol !== null ? startRowSafeCol : 0));
    // keep mistakesInLevel as-is (still same level)
    

  }, [startRowSafeCol, isMobile]);

  const selectCell = useCallback(() => {
    if (inputLocked) return;
    const key = `${activeRow}-${activeCol}`;
    const isSafe = safePath.has(key);

    if (isSafe) {
      // If selecting the safe cell on the starting (bottom) row, remember its column for future resets
      if (activeRow === ROWS - 1) {
        setStartRowSafeCol(activeCol);
      }

      playCorrectSound();
      setVisitedSafe((prev) => new Set(prev).add(key));
      const nextRow = activeRow - 1;
      if (nextRow < 0) {
        const justCleared = currentLevel;
        const nextLevel = justCleared + 1;
        const flawless = mistakesInLevel === 0;
        const encouragement = chooseEncouragement(mistakesInLevel);
        const timeCrunch = remainingSeconds <= 5;
        const headline = timeCrunch ? chooseTimeCrunch() : encouragement;
        const gained = 100 + justCleared * 10 + (flawless ? 200 : 0);
        setScore((s) => s + gained);
        setStatusText(`+${gained} pts${flawless ? ' (Flawless!)' : ''}`);
        // Stop timer during transition
        clearTimer();
        // Play short victory melody alongside blinking
        playLevelCompleteMelody();
        // Flash green tiles on/off for 2 seconds, then proceed
        const greenTiles: CelebrationCell[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < cols; c++) {
            const k = `${r}-${c}`;
            if (safePath.has(k)) {
              greenTiles.push({ row: r, col: c, color: '#2bb36b' });
            }
          }
        }
        let on = true;
        setCelebrationCells(greenTiles);
        const intervalMs = 200;
        const totalMs = 2000;
        let elapsed = 0;
        const iv = setInterval(() => {
          on = !on;
          setCelebrationCells(on ? greenTiles : []);
          elapsed += intervalMs;
          if (elapsed >= totalMs) {
            clearInterval(iv);
            setCelebrationCells([]);
            setOverlayLines([
              headline,
              `Level ${justCleared} Passed!`,
              `Prepare for Level ${nextLevel}!`,
            ]);
            setOverlayFlawless(flawless);
            setOverlayVisible(true);
            // Clear first row highlighting when level is completed
            setIsFirstRowHighlighted(false);
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
              setMistakesInLevel(0);
              setStartRowSafeCol(null); // new pattern next level
              startLevelTimer(LEVEL_SECONDS);
            }, 1100);
          }
        }, intervalMs);
        return;
      }
      setActiveRow(nextRow);
    } else {
      playWrongSound();
      setMistakesInLevel((m) => m + 1);
      setWrongFlash({ row: activeRow, col: activeCol });
      // Clear first row highlighting when wrong tile is selected
      setIsFirstRowHighlighted(false);
      setTimeout(() => setWrongFlash(null), 300);
      setTimeout(() => {
        if (activeRow !== ROWS - 1) {
          // For rows above the first, reset to the start of the same pattern
          resetLevelSamePattern();
        }
        // If on the first row, do nothing so the cursor stays where the player left it
      }, 320);
    }
  }, [activeRow, activeCol, chooseEncouragement, chooseTimeCrunch, clearTimer, cols, currentLevel, generatePath, mistakesInLevel, playCorrectSound, playLevelCompleteMelody, playWrongSound, remainingSeconds, resetLevelSamePattern, safePath, startLevelTimer, inputLocked]);

  // Desktop keyboard controls (only active when not on mobile)
  useEffect(() => {
    if (isMobile) return; // Skip keyboard controls on mobile
    
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') moveLeft();
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') moveRight();
      else if (key === 'ArrowUp') moveUp();
      else if (key === ' ' || key === 'Enter' || key === 'w' || key === 'W') selectCell();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, moveLeft, moveRight, moveUp, selectCell]);

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const timerClass = useMemo(() => {
    if (remainingSeconds <= 5) return 'danger';
    if (remainingSeconds <= 10) return 'warn';
    return 'ok';
  }, [remainingSeconds]);

  // Optimized mobile touch handler - created once, not recreated on every render
  const handleMobileTouch = useCallback((rowIndex: number, colIndex: number) => {
    if (!isMobile || inputLocked) return;
    
    // Only allow interaction with tiles on the active row
    if (rowIndex !== activeRow) return;
    
    // Mobile-specific selection - select the specific tile that was touched
    const key = `${rowIndex}-${colIndex}`;
    const isSafe = safePath.has(key);
    
    if (isSafe) {
      // If selecting the safe cell on the starting (bottom) row, remember its column for future resets
      if (rowIndex === ROWS - 1) {
        setStartRowSafeCol(colIndex);
      }
      
      playCorrectSound();
      setVisitedSafe((prev) => new Set(prev).add(key));
      const nextRow = rowIndex - 1;
      if (nextRow < 0) {
        // Level completed logic
        const justCleared = currentLevel;
        const nextLevel = justCleared + 1;
        const flawless = mistakesInLevel === 0;
        const encouragement = chooseEncouragement(mistakesInLevel);
        const timeCrunch = remainingSeconds <= 5;
        const headline = timeCrunch ? chooseTimeCrunch() : encouragement;
        const gained = 100 + justCleared * 10 + (flawless ? 200 : 0);
        setScore((s) => s + gained);
        setStatusText(`+${gained} pts${flawless ? ' (Flawless!)' : ''}`);
        clearTimer();
        playLevelCompleteMelody();
        
        // Flash green tiles logic
        const greenTiles: CelebrationCell[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < cols; c++) {
            const k = `${r}-${c}`;
            if (safePath.has(k)) {
              greenTiles.push({ row: r, col: c, color: '#2bb36b' });
            }
          }
        }
        let on = true;
        setCelebrationCells(greenTiles);
        const intervalMs = 200;
        const totalMs = 2000;
        let elapsed = 0;
        const iv = setInterval(() => {
          on = !on;
          setCelebrationCells(on ? greenTiles : []);
          elapsed += intervalMs;
          if (elapsed >= totalMs) {
            clearInterval(iv);
            setCelebrationCells([]);
            setOverlayLines([
              headline,
              `Level ${justCleared} Passed!`,
              `Prepare for Level ${nextLevel}!`,
            ]);
            setOverlayFlawless(flawless);
            setOverlayVisible(true);
            // Clear first row highlighting when level is completed
            setIsFirstRowHighlighted(false);
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
              setMistakesInLevel(0);
              setStartRowSafeCol(null);
              startLevelTimer(LEVEL_SECONDS);
            }, 1100);
          }
        }, intervalMs);
        return;
      }
      setActiveRow(nextRow);
    } else {
      // Wrong tile selected
      playWrongSound();
      setMistakesInLevel((m) => m + 1);
      setWrongFlash({ row: rowIndex, col: colIndex });
      // Clear first row highlighting when wrong tile is selected
      setIsFirstRowHighlighted(false);
      setTimeout(() => setWrongFlash(null), 300);
      setTimeout(() => {
        if (rowIndex !== ROWS - 1) {
          resetLevelSamePattern();
        }
      }, 320);
    }
  }, [isMobile, inputLocked, activeRow, safePath, setStartRowSafeCol, playCorrectSound, setVisitedSafe, currentLevel, mistakesInLevel, chooseEncouragement, remainingSeconds, chooseTimeCrunch, setScore, setStatusText, clearTimer, playLevelCompleteMelody, cols, setCelebrationCells, setOverlayLines, setOverlayFlawless, setOverlayVisible, setCurrentLevel, setCols, setSafePath, setActiveRow, setActiveCol, setMistakesInLevel, startLevelTimer, playWrongSound, setWrongFlash, resetLevelSamePattern]);

  const renderCell = (rowIndex: number, colIndex: number) => {
    const key = `${rowIndex}-${colIndex}`;
    const isActive = activeRow === rowIndex && activeCol === colIndex;
    const isVisitedSafe = visitedSafe.has(key);
    const isWrong = wrongFlash && wrongFlash.row === rowIndex && wrongFlash.col === colIndex;
    const celebrationCell = celebrationCells.find(cell => cell?.row === rowIndex && cell?.col === colIndex);

    const classNames = [
      'cell',
      // Only show active styling on desktop (not on mobile)
      isActive && !isMobile ? 'active' : '',
      isVisitedSafe ? 'safe' : '',
      isWrong ? 'wrong' : '',
      // First row highlighting for mobile (bottom row where player starts)
      isMobile && isFirstRowHighlighted && rowIndex === ROWS - 1 ? 'first-row-highlight' : '',
    ]
      .filter(Boolean)
      .join(' ');
    

    


    const baseStyle = {
      cursor: isMobile ? 'default' : (isActive ? 'pointer' : 'default'),
    };

    // Apply celebration cell styling
    const style = celebrationCell ? {
      ...baseStyle,
      background: celebrationCell.color,
      borderColor: celebrationCell.color,
      boxShadow: `0 0 20px ${celebrationCell.color}`,
      transition: 'all 0.3s ease'
    } : baseStyle;



    return (
      <div
        key={key}
        className={classNames}
        data-row={rowIndex}
        data-col={colIndex}

        style={style}
        onClick={isMobile ? () => handleMobileTouch(rowIndex, colIndex) : undefined}
        role={isMobile ? "button" : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-label={isMobile ? `Cell at row ${rowIndex + 1}, column ${colIndex + 1}` : undefined}
      />
    );
  };

  // Memoize the grid rows to prevent unnecessary re-renders
  const rows = useMemo(() => {
    const gridRows = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        gridRows.push(renderCell(r, c));
      }
    }
    return gridRows;
  }, [renderCell, cols]);

  // Show loading screen until mobile detection is complete
  if (!isMobileDetected) {
    return (
      <div id="game-container">
        <h1>Mind Tile - Memory Challenge</h1>
        <p className="mobile-instructions loading">Detecting device type...</p>
      </div>
    );
  }

  return (
    <div id="game-container">
      <div id="overlay" className={overlayVisible ? 'show' : ''}>
        <div className="overlay-text">
          {overlayLines.map((line, i) => (
            <div key={i} className={i === 0 ? (overlayFlawless ? 'encouragement perfect' : 'encouragement') : ''}>{line}</div>
          ))}
        </div>
      </div>
      <h1>Mind Tile - Memory Challenge</h1>
      {/* Mobile-specific instructions */}
      {isMobile && (
        <p className="mobile-instructions">
          Tap any cell on the active row to select it as your choice.
        </p>
      )}
      <div id="play-area">
        <div className={`timer-box ${timerClass} ${isTimerFlashing ? 'flash' : ''}`} aria-label="time left">{formatTime(remainingSeconds)}</div>
        <div id="grid" style={gridTemplateColumnsStyle}>
          {rows}
        </div>
        <div className={`timer-box ${timerClass} ${isTimerFlashing ? 'flash' : ''}`} aria-label="time left">{formatTime(remainingSeconds)}</div>
      </div>

      <p id="status" className="subtle">{statusText}</p>
      <p id="score" className="subtle">Score: {score}</p>
    </div>
  );
}
