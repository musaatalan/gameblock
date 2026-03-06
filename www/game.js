(function () {
  'use strict';

  const GRID_SIZE = 9;
  const HIGH_SCORE_KEY = 'blokPatlatEnYuksekSkor';
  const SOUND_ENABLED_KEY = 'blokPatlatSesAcik';
  const CELL_COLORS = [
    '#ff5722', '#ff9800', '#ffeb3b', '#76ff03', '#00e5ff', '#e040fb', '#00bcd4', '#ff4081',
    '#69f0ae', '#ffab00'
  ];

  // Blok şekilleri: her biri [satır, sütun] ofsetleri (en üst-sol referans)
  // "Dev blok" için 3x3 kare eklendi.
  const SHAPE_DEFS = [
    { shape: [[0,0]], weight: 14 },
    { shape: [[0,0],[0,1]], weight: 12 },
    { shape: [[0,0],[1,0]], weight: 12 },
    { shape: [[0,0],[0,1],[0,2]], weight: 10 },
    { shape: [[0,0],[1,0],[2,0]], weight: 10 },
    { shape: [[0,0],[0,1],[0,2],[0,3]], weight: 7 },
    { shape: [[0,0],[1,0],[2,0],[3,0]], weight: 7 },
    { shape: [[0,0],[0,1],[0,2],[0,3],[0,4]], weight: 4, minLevel: 1 },
    { shape: [[0,0],[1,0],[2,0],[3,0],[4,0]], weight: 4, minLevel: 1 },

    { shape: [[0,0],[0,1],[1,0],[1,1]], weight: 9 }, // 2x2
    { shape: [[0,0],[0,1],[0,2],[1,0]], weight: 7 },  // L
    { shape: [[0,0],[0,1],[0,2],[1,2]], weight: 7 },
    { shape: [[0,0],[1,0],[2,0],[2,1]], weight: 6 },
    { shape: [[0,1],[1,1],[2,0],[2,1]], weight: 6 },

    { shape: [[0,0],[0,1],[1,1],[1,2]], weight: 6 },  // Z
    { shape: [[0,1],[0,2],[1,0],[1,1]], weight: 6 },  // S
    { shape: [[0,0],[0,1],[0,2],[1,1]], weight: 6 },  // T
    { shape: [[0,1],[1,0],[1,1],[1,2]], weight: 6 },
    { shape: [[0,0],[1,0],[1,1],[1,2]], weight: 6 },
    { shape: [[0,2],[1,0],[1,1],[1,2]], weight: 6 },

    { shape: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], weight: 3, minLevel: 1 }, // 2x3
    { shape: [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]], weight: 3, minLevel: 1 }, // 3x2
    { shape: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]], weight: 2 }, // 3x3 (dev)
    { shape: [[0,1],[1,0],[1,1],[1,2],[2,1]], weight: 3, minLevel: 2 }, // +
  ];

  let grid = [];
  let score = 0;
  let level = 0;
  let linesCleared = 0;
  let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
  let currentPieces = [];
  let selectedPieceIndex = null;
  let gameOver = false;
  let particles = [];
  let clearingAnim = null;
  let placementFlashUntil = 0;
  let animId = null;
  let shadowCell = null;
  let dragPieceIndex = null;
  let dragClientX = 0;
  let dragClientY = 0;
  let soundEnabled = (localStorage.getItem(SOUND_ENABLED_KEY) ?? '1') === '1';
  let audioCtx = null;

  const canvas = document.getElementById('game-grid');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score-display');
  const levelEl = document.getElementById('level-display');
  const highScoreEl = document.getElementById('high-score-display');
  const soundToggleEl = document.getElementById('sound-toggle');
  const piecesSlot = document.getElementById('pieces-slot');
  const gridContainer = document.getElementById('grid-container');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const gameoverMessageEl = document.getElementById('gameover-message');
  const gameoverScoreEl = document.getElementById('gameover-score');
  const gameoverLevelEl = document.getElementById('gameover-level');
  const gameoverNewRecordEl = document.getElementById('gameover-new-record');
  const gameoverRestartBtn = document.getElementById('gameover-restart');

  function updateHighScoreDisplay() {
    if (highScoreEl) highScoreEl.textContent = String(highScore);
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function beep(opts) {
    if (!soundEnabled) return;
    const ac = ensureAudio();
    if (!ac) return;
    if (ac.state === 'suspended') {
      // Tarayıcı bazı durumlarda kullanıcı etkileşimi sonrası resume ister; deniyoruz.
      ac.resume().catch(() => {});
    }

    const now = ac.currentTime;
    const duration = opts.duration ?? 0.08;
    const freq = opts.freq ?? 440;
    const type = opts.type ?? 'sine';
    const gainPeak = opts.gain ?? 0.08;
    const detune = opts.detune ?? 0;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (detune) osc.detune.setValueAtTime(detune, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playPlaceSfx() {
    // kısa, “klik” gibi
    beep({ freq: 740, type: 'square', duration: 0.05, gain: 0.06 });
    beep({ freq: 520, type: 'triangle', duration: 0.06, gain: 0.04, detune: -20 });
  }

  function playClearSfx(lines) {
    // satır/sütun patlama: daha tok + biraz daha uzun
    const base = 260 + Math.min(4, lines) * 70;
    beep({ freq: base, type: 'sawtooth', duration: 0.10, gain: 0.07 });
    beep({ freq: base * 1.5, type: 'triangle', duration: 0.12, gain: 0.05 });
  }

  function initGrid() {
    grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
  }

  function shapeWidthHeight(shape) {
    const rows = Math.max(...shape.map(p => p[0])) + 1;
    const cols = Math.max(...shape.map(p => p[1])) + 1;
    return { rows, cols };
  }

  function effectiveWeight(def) {
    const cells = def.shape.length;
    const { rows, cols } = shapeWidthHeight(def.shape);
    const isLongLine = (rows === 1 && cols >= 4) || (cols === 1 && rows >= 4);
    const isTiny = cells <= 2;
    const isBig = cells >= 6;
    const isHuge = cells >= 9;

    let w = def.weight;
    // Oyun gittikçe zorlaşsın: küçük parçaları azalt, büyük/uzun parçaları artır.
    if (isTiny) w *= Math.max(0.15, 1 - level * 0.07);
    if (cells === 4) w *= Math.max(0.35, 1 - level * 0.035);
    if (isLongLine) w *= 1 + level * 0.07;
    if (isBig) w *= 1 + level * 0.09;
    if (isHuge) w *= 1 + level * 0.14;

    return Math.max(0.2, Math.min(40, w));
  }

  function pickShape() {
    const available = SHAPE_DEFS.filter(d => (d.minLevel ?? 0) <= level);
    const total = available.reduce((sum, d) => sum + effectiveWeight(d), 0);
    let r = Math.random() * total;
    for (const d of available) {
      r -= effectiveWeight(d);
      if (r <= 0) return d.shape;
    }
    return available[available.length - 1].shape;
  }

  function getEndMessage() {
    const msgs = [
      'Bir daha dene! Bu sefer daha iyi olacak.',
      'Güzel oynadın! Bir tur daha mı?',
      'Harikaydın! Rekor kırmaya çok yakınsın.',
      'Efsane deneme! Tekrar başla ve zorlaştır!',
      'Tam kıvamında. Devam!'
    ];
    if (score >= 2000) return 'Efsane! Skorun çok iyi. Rekor kır!';
    if (level >= 6) return 'Zor seviyelere çıktın! Helal.';
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  function showGameOver() {
    gameOver = true;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    placementFlashUntil = 0;
    clearingAnim = null;
    particles = [];
    shadowCell = null;
    const isNewRecord = score > highScore && score > 0;
    if (isNewRecord) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      updateHighScoreDisplay();
    }
    if (gameoverNewRecordEl) {
      gameoverNewRecordEl.classList.toggle('hidden', !isNewRecord);
    }
    if (gameoverMessageEl) gameoverMessageEl.textContent = getEndMessage();
    if (gameoverScoreEl) gameoverScoreEl.textContent = String(score);
    if (gameoverLevelEl) gameoverLevelEl.textContent = String(level);
    if (gameoverOverlay) gameoverOverlay.classList.remove('hidden');
  }

  function getRandomPieces(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const colorIndex = Math.floor(Math.random() * CELL_COLORS.length);
      list.push({ shape: pickShape(), color: CELL_COLORS[colorIndex] });
    }
    return list;
  }

  function spawnFloatText(text) {
    if (!gridContainer) return;
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    gridContainer.appendChild(el);
    el.addEventListener('animationend', function () { el.remove(); });
  }

  function getGridRect() {
    const rect = canvas.getBoundingClientRect();
    return {
      w: rect.width,
      h: rect.height,
      cellW: rect.width / GRID_SIZE,
      cellH: rect.height / GRID_SIZE
    };
  }

  function spawnPlacementParticles(cellPositions, color) {
    const rect = getGridRect();
    const cellW = rect.cellW;
    const cellH = rect.cellH;
    for (const pos of cellPositions) {
      const cx = (pos.col + 0.5) * cellW;
      const cy = (pos.row + 0.5) * cellH;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          color: color,
          size: 4 + Math.random() * 4
        });
      }
    }
  }

  function drawParticles() {
    if (particles.length === 0) return;
    const rect = getGridRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.w;
    const h = rect.h;
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.03;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  function drawGrid() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cellW = w / GRID_SIZE;
    const cellH = h / GRID_SIZE;

    ctx.clearRect(0, 0, w, h);

    const now = Date.now();
    const isPlacementFlash = placementFlashUntil > now;
    const flashElapsed = now - (placementFlashUntil - 280);
    const flashAlpha = isPlacementFlash ? 0.5 * Math.max(0, 1 - flashElapsed / 280) : 0;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const value = grid[r][c];
        let isClearing = false;
        let clearProgress = 0;
        if (clearingAnim) {
          const elapsed = now - clearingAnim.startTime;
          const flashDur = 180;
          const shrinkDur = 220;
          if (clearingAnim.rows.indexOf(r) >= 0 || clearingAnim.cols.indexOf(c) >= 0) {
            isClearing = true;
            if (elapsed < flashDur) {
              clearProgress = 0;
            } else {
              clearProgress = Math.min(1, (elapsed - flashDur) / shrinkDur);
            }
          }
        }
        if (isClearing && clearProgress >= 1) continue;
        if (value > 0) {
          const color = CELL_COLORS[(value - 1) % CELL_COLORS.length];
          if (isClearing && clearProgress === 0) {
            ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
            ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, cellW, cellH);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            continue;
          }
          if (isClearing && clearProgress > 0 && clearProgress < 1) {
            const scale = 1 - clearProgress;
            ctx.save();
            ctx.translate(x + cellW / 2, y + cellH / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(x + cellW / 2), -(y + cellH / 2));
            drawBlockCell(ctx, x, y, cellW, cellH, color);
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.strokeRect(x, y, cellW, cellH);
            continue;
          }
          drawBlockCell(ctx, x, y, cellW, cellH, color);
        } else if (!isClearing) {
          ctx.fillStyle = 'rgba(13, 71, 161, 0.9)';
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        }
        if (!isClearing) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellW, cellH);
        }
      }
    }
    if (flashAlpha > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + flashAlpha + ')';
      ctx.fillRect(0, 0, w, h);
    }
    if (dragPieceIndex !== null && currentPieces[dragPieceIndex] && !clearingAnim && placementFlashUntil <= now) {
      const piece = currentPieces[dragPieceIndex];
      const rect = canvas.getBoundingClientRect();
      const cx = (dragClientX - rect.left);
      const cy = (dragClientY - rect.top);
      const offsetY = cellH * 2.2;
      const rows = Math.max(...piece.shape.map(p => p[0])) + 1;
      const cols = Math.max(...piece.shape.map(p => p[1])) + 1;
      const left = cx - (cols * cellW) / 2;
      const top = cy - offsetY - (rows * cellH) / 2;
      piece.shape.forEach(([dr, dc]) => {
        drawBlockCell(ctx, left + dc * cellW, top + dr * cellH, cellW, cellH, piece.color);
      });
    }
  }

  function drawBlockCell(ctx, x, y, w, h, color) {
    const pad = 2;
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + pad, y + pad, (w - pad * 2) * 0.4, (h - pad * 2) * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + pad + (w - pad * 2) * 0.5, y + pad + (h - pad * 2) * 0.6, (w - pad * 2) * 0.5, (h - pad * 2) * 0.4);
  }

  function drawGhostPiece(ctx, shape, row, col, color, cellW, cellH, isValid, offsetX, offsetY) {
    offsetX = offsetX || 0;
    offsetY = offsetY || 0;
    ctx.save();
    const displayColor = isValid ? color : '#e57373';
    shape.forEach(([dr, dc]) => {
      const x = (col + dc) * cellW + offsetX;
      const y = (row + dr) * cellH + offsetY;
      drawBlockCell(ctx, x, y, cellW, cellH, displayColor);
    });
    ctx.restore();
  }

  function renderPieceCanvas(shape, color, size = 36) {
    const rows = Math.max(...shape.map(p => p[0])) + 1;
    const cols = Math.max(...shape.map(p => p[1])) + 1;
    const cellSize = Math.min(size / rows, size / cols) - 2;
    const offX = (size - cols * cellSize) / 2;
    const offY = (size - rows * cellSize) / 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.className = 'piece-canvas';
    const cx = c.getContext('2d');
    shape.forEach(([r, col]) => {
      drawBlockCell(cx, offX + col * cellSize, offY + r * cellSize, cellSize, cellSize, color);
    });
    return c;
  }

  function canPlace(shape, row, col) {
    for (const [dr, dc] of shape) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
      if (grid[r][c] !== 0) return false;
    }
    return true;
  }

  function placePiece(shape, row, col, colorIndex) {
    const colorId = (colorIndex % CELL_COLORS.length) + 1;
    for (const [dr, dc] of shape) {
      grid[row + dr][col + dc] = colorId;
    }
  }

  function getFullLines() {
    const rowsToRemove = [];
    const colsToRemove = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r].every(c => c > 0)) rowsToRemove.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (grid[r][c] === 0) { full = false; break; }
      }
      if (full) colsToRemove.push(c);
    }
    return { rows: rowsToRemove, cols: colsToRemove };
  }

  function applyClearLines(rows, cols) {
    rows.forEach(r => { grid[r].fill(0); });
    cols.forEach(c => {
      for (let r = 0; r < GRID_SIZE; r++) grid[r][c] = 0;
    });
    return rows.length + cols.length;
  }

  function addScore(cells, lines) {
    const base = cells * 10;
    const lineBonus = lines * (100 + level * 20);
    score += base + lineBonus;
    linesCleared += lines;
    level = Math.floor(linesCleared / 5);
    scoreEl.textContent = score;
    levelEl.textContent = level;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      updateHighScoreDisplay();
    }
    scoreEl.classList.add('score-pop');
    clearTimeout(scoreEl._popTimer);
    scoreEl._popTimer = setTimeout(function () { scoreEl.classList.remove('score-pop'); }, 250);
  }

  function runAfterEffects(lineCount) {
    const cells = currentPlacedCells || 0;
    addScore(cells, lineCount || 0);
    currentPieces.splice(currentPlacedPieceIndex, 1);
    currentPieces.push(getRandomPieces(1)[0]);
    selectedPieceIndex = null;
    currentPlacedPieceIndex = null;
    currentPlacedCells = null;
    clearingAnim = null;
    renderPieces();
    drawGrid();
    checkGameOver();
    if (animId) cancelAnimationFrame(animId);
    animId = null;
  }

  let currentPlacedPieceIndex = null;
  let currentPlacedCells = null;

  function tryPlaceSelected(row, col) {
    if (selectedPieceIndex === null || gameOver) return;
    if (clearingAnim || placementFlashUntil > Date.now()) return;
    const piece = currentPieces[selectedPieceIndex];
    if (!piece) return;
    if (!canPlace(piece.shape, row, col)) return;
    const colorIndex = CELL_COLORS.indexOf(piece.color) >= 0 ? CELL_COLORS.indexOf(piece.color) : 0;
    placePiece(piece.shape, row, col, colorIndex);
    playPlaceSfx();
    const cellPositions = piece.shape.map(([dr, dc]) => ({ row: row + dr, col: col + dc }));
    spawnPlacementParticles(cellPositions, piece.color);
    placementFlashUntil = Date.now() + 280;
    currentPlacedPieceIndex = selectedPieceIndex;
    currentPlacedCells = piece.shape.length;
    const { rows, cols } = getFullLines();
    function tick() {
      const now = Date.now();
      drawGrid();
      drawParticles();
      if (particles.length > 0 || placementFlashUntil > now) {
        animId = requestAnimationFrame(tick);
        return;
      }
      if (rows.length > 0 || cols.length > 0) {
        if (!clearingAnim) {
          clearingAnim = { rows, cols, startTime: Date.now() };
        }
        const elapsed = now - clearingAnim.startTime;
        if (elapsed < 400) {
          animId = requestAnimationFrame(tick);
          return;
        }
        applyClearLines(rows, cols);
        clearingAnim = null;
        const lc = rows.length + cols.length;
        playClearSfx(lc);
        if (lc === 1) spawnFloatText('SÜPER!');
        else if (lc === 2) spawnFloatText('KOMBO x2');
        else spawnFloatText('MEGA KOMBO x' + lc);
        runAfterEffects(lc);
      } else {
        runAfterEffects(0);
      }
    }
    tick();
  }

  function checkGameOver() {
    let anyCanPlace = false;
    for (const piece of currentPieces) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlace(piece.shape, r, c)) { anyCanPlace = true; break; }
        }
        if (anyCanPlace) break;
      }
      if (anyCanPlace) break;
    }
    if (!anyCanPlace && currentPieces.length > 0) {
      setTimeout(showGameOver, 120);
    }
  }

  function startDrag(i, clientX, clientY) {
    if (gameOver || clearingAnim || placementFlashUntil > Date.now()) return;
    dragPieceIndex = i;
    dragClientX = clientX;
    dragClientY = clientY;
    shadowCell = null;
    drawGrid();
  }

  function updateDrag(clientX, clientY) {
    if (dragPieceIndex === null) return;
    dragClientX = clientX;
    dragClientY = clientY;
    if (!animId) drawGrid();
  }

  function endDrag(clientX, clientY) {
    if (dragPieceIndex === null) return;
    const idx = dragPieceIndex;
    dragPieceIndex = null;
    const cell = getCellFromClient(clientX, clientY);
    if (cell) {
      selectedPieceIndex = idx;
      tryPlaceSelected(cell.row, cell.col);
    }
    selectedPieceIndex = null;
    document.querySelectorAll('.piece-btn').forEach((b, j) => b.classList.toggle('selected', false));
    drawGrid();
  }

  function renderPieces() {
    piecesSlot.innerHTML = '';
    currentPieces.forEach((piece, i) => {
      const btn = document.createElement('button');
      btn.className = 'piece-btn' + (i === selectedPieceIndex ? ' selected' : '');
      btn.type = 'button';
      btn.appendChild(renderPieceCanvas(piece.shape, piece.color, 48));
      btn.addEventListener('click', (e) => {
        if (dragPieceIndex !== null) return;
        selectedPieceIndex = selectedPieceIndex === i ? null : i;
        document.querySelectorAll('.piece-btn').forEach((b, j) => b.classList.toggle('selected', j === selectedPieceIndex));
      });
      btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(i, e.clientX, e.clientY);
      });
      btn.addEventListener('touchstart', (e) => {
        if (e.touches.length) startDrag(i, e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      piecesSlot.appendChild(btn);
    });
  }

  function getCellFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const cellW = rect.width / GRID_SIZE;
    const cellH = rect.height / GRID_SIZE;
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) return { row, col };
    return null;
  }

  function getCellFromEvent(e) {
    const t = e.touches?.[0] || e.changedTouches?.[0];
    const x = e.clientX ?? t?.clientX;
    const y = e.clientY ?? t?.clientY;
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return null;
    return getCellFromClient(x, y);
  }

  function handleGridClick(e) {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (cell) tryPlaceSelected(cell.row, cell.col);
  }

  function updateShadow(e) {
    const cell = getCellFromEvent(e);
    if (cell && shadowCell && shadowCell.row === cell.row && shadowCell.col === cell.col) return;
    if (!cell && !shadowCell) return;
    shadowCell = cell;
    if (!animId) drawGrid();
  }

  function clearShadow() {
    if (!shadowCell) return;
    shadowCell = null;
    if (!animId) drawGrid();
  }

  function startGame() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    particles = [];
    clearingAnim = null;
    placementFlashUntil = 0;
    shadowCell = null;
    dragPieceIndex = null;
    highScore = Math.max(highScore, parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10));
    updateHighScoreDisplay();
    initGrid();
    score = 0;
    level = 0;
    linesCleared = 0;
    currentPieces = getRandomPieces(3);
    selectedPieceIndex = null;
    gameOver = false;
    if (gameoverOverlay) gameoverOverlay.classList.add('hidden');
    if (gameoverNewRecordEl) gameoverNewRecordEl.classList.add('hidden');
    scoreEl.textContent = '0';
    levelEl.textContent = '0';
    renderPieces();
    drawGrid();
  }

  // Canvas boyutu değişince yeniden çiz
  const resizeObserver = new ResizeObserver(() => { drawGrid(); });
  resizeObserver.observe(canvas);

  canvas.addEventListener('click', handleGridClick);
  canvas.addEventListener('mousemove', updateShadow);
  canvas.addEventListener('mouseleave', clearShadow);
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length) updateShadow(e);
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    if (e.touches.length) updateShadow(e);
  }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    if (e.touches.length === 0) {
      clearShadow();
      e.preventDefault();
      handleGridClick(e);
    }
  }, { passive: false });
  canvas.addEventListener('touchcancel', clearShadow);

  document.addEventListener('mousemove', (e) => {
    if (dragPieceIndex !== null) updateDrag(e.clientX, e.clientY);
    else updateShadow(e);
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0 && dragPieceIndex !== null) {
      endDrag(e.clientX, e.clientY);
    }
  });
  document.addEventListener('touchmove', (e) => {
    if (dragPieceIndex !== null && e.touches.length) {
      e.preventDefault();
      updateDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length) updateShadow(e);
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (e.touches.length === 0 && dragPieceIndex !== null) {
      const t = e.changedTouches[0];
      if (t) endDrag(t.clientX, t.clientY);
      else dragPieceIndex = null;
    } else if (e.touches.length === 0) {
      clearShadow();
      handleGridClick(e);
    }
  }, { passive: false });
  document.addEventListener('touchcancel', (e) => {
    if (e.touches.length === 0) dragPieceIndex = null;
  });

  // ——— Hoş geldin ekranı ———
  var welcomeAccepted = false;
  function goToGame() {
    if (welcomeAccepted) return;
    welcomeAccepted = true;
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    ensureAudio();
    startGame();
  }
  var acceptBtn = document.getElementById('accept-btn');
  acceptBtn.addEventListener('click', function (e) {
    e.preventDefault();
    goToGame();
  });
  acceptBtn.addEventListener('touchend', function (e) {
    e.preventDefault();
    goToGame();
  }, { passive: false });
  document.getElementById('terms-link').addEventListener('click', function (e) {
    e.preventDefault();
    alert('Kullanım Koşulları sayfası bu örnekte yer almıyor.');
  });
  document.getElementById('privacy-link').addEventListener('click', function (e) {
    e.preventDefault();
    alert('Gizlilik Politikası sayfası bu örnekte yer almıyor.');
  });

  // ——— Ayarlar ———
  document.getElementById('settings-btn').addEventListener('click', function () {
    document.getElementById('settings-overlay').classList.remove('hidden');
  });
  document.getElementById('close-settings').addEventListener('click', function () {
    document.getElementById('settings-overlay').classList.add('hidden');
  });
  document.getElementById('settings-overlay').addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
  });
  if (soundToggleEl) {
    soundToggleEl.checked = soundEnabled;
    soundToggleEl.addEventListener('change', function () {
      soundEnabled = !!this.checked;
      localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled ? '1' : '0');
      if (soundEnabled) ensureAudio();
    });
  }
  document.getElementById('skin-toggle').addEventListener('change', function () {
    document.body.classList.toggle('skin-light', this.checked);
  });
  document.getElementById('replay-btn').addEventListener('click', function () {
    document.getElementById('settings-overlay').classList.add('hidden');
    startGame();
  });
  document.getElementById('more-games-btn').addEventListener('click', function () {
    alert('Daha fazla oyun yakında!');
  });
  document.getElementById('more-settings-btn').addEventListener('click', function () {
    alert('Ek ayarlar yakında!');
  });

  if (gameoverRestartBtn) {
    gameoverRestartBtn.addEventListener('click', function () {
      startGame();
    });
  }
  if (gameoverOverlay) {
    gameoverOverlay.addEventListener('click', function (e) {
      if (e.target === gameoverOverlay) gameoverOverlay.classList.add('hidden');
    });
  }

  drawGrid();
})();
