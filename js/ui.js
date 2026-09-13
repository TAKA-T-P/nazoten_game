// 画面切替、表示更新、演出呼出（仕様書 8章・12章、Phase2実装指示書 6・8章）。
import * as storage from './storage.js';
import { getTitleForScore, calcSuccessRate } from './scoring.js';

const el = {};
let cellEls = [];
let reduceMotion = false;

function cacheDom() {
  el.screens = document.querySelectorAll('.screen');
  el.titleBest = document.getElementById('title-best-score');
  el.btnSoundTitle = document.getElementById('btn-sound-title');
  el.screenGame = document.getElementById('screen-game');
  el.board = document.getElementById('board');
  el.hudTime = document.getElementById('hud-time');
  el.hudScore = document.getElementById('hud-score');
  el.hudBest = document.getElementById('hud-best');
  el.hudFormula = document.getElementById('hud-formula');
  el.btnSoundGame = document.getElementById('btn-sound-game');
  el.countdownOverlay = document.getElementById('countdown-overlay');
  el.countdownLabel = document.getElementById('countdown-label');
  el.feverStartOverlay = document.getElementById('fever-start-overlay');
  el.timeupOverlay = document.getElementById('timeup-overlay');
  el.floatingLayer = document.getElementById('floating-layer');
  el.resultNewBest = document.getElementById('result-newbest');
  el.resultScore = document.getElementById('result-score');
  el.resultTitle = document.getElementById('result-title');
  el.breakdownNormal = document.getElementById('breakdown-normal');
  el.breakdownFever = document.getElementById('breakdown-fever');
  el.breakdownTotal = document.getElementById('breakdown-total');
  el.statSuccess = document.getElementById('stat-success');
  el.statFailure = document.getElementById('stat-failure');
  el.statRate = document.getElementById('stat-rate');
  el.stat10 = document.getElementById('stat-10');
  el.stat20 = document.getElementById('stat-20');
  el.stat30 = document.getElementById('stat-30');
  el.stat40 = document.getElementById('stat-40');
  el.statFeverSuccess = document.getElementById('stat-fever-success');
  el.statCleared = document.getElementById('stat-cleared');
  el.statHighest = document.getElementById('stat-highest');
  el.statFeverHighest = document.getElementById('stat-fever-highest');
}

export function init() {
  cacheDom();
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  refreshSoundButtons();
  el.titleBest.textContent = storage.getBestScore();
}

export function showScreen(name) {
  el.screens.forEach((s) => {
    s.hidden = s.dataset.screen !== name;
  });
}

export function refreshSoundButtons() {
  const on = storage.isSoundEnabled();
  const label = on ? '🔊' : '🔇';
  el.btnSoundTitle.textContent = label;
  el.btnSoundGame.textContent = label;
}

export function updateBestScoreDisplays() {
  el.titleBest.textContent = storage.getBestScore();
  el.hudBest.textContent = storage.getBestScore();
}

export function getBoardElement() {
  return el.board;
}

export function renderBoard(board) {
  el.board.innerHTML = '';
  cellEls = [];
  for (let i = 0; i < board.size; i++) {
    const cellEl = document.createElement('div');
    cellEl.className = 'cell';
    cellEl.dataset.cellIndex = String(i);
    const valueEl = document.createElement('span');
    valueEl.className = 'cell-value';
    valueEl.textContent = String(board.getValue(i));
    cellEl.appendChild(valueEl);
    el.board.appendChild(cellEl);
    cellEls.push(cellEl);
  }
  updateHudFormula([], [], 0, false);
}

export function updateSelection(detail) {
  const selected = new Set(detail.indices);
  const showValid = detail.isValid && detail.indices.length >= 2;
  cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', selected.has(i));
    cellEl.classList.toggle('selected-valid', selected.has(i) && showValid);
    const badge = cellEl.querySelector('.order-badge');
    if (badge) badge.remove();
  });
  detail.indices.forEach((cellIndex, order) => {
    const badge = document.createElement('span');
    badge.className = 'order-badge';
    badge.textContent = String(order + 1);
    cellEls[cellIndex].appendChild(badge);
  });
  updateHudFormula(detail.indices, detail.values, detail.sum, detail.isValid);
}

function updateHudFormula(indices, values, sum, isValid) {
  el.hudFormula.classList.toggle('formula-valid', isValid && indices.length >= 2);
  if (indices.length === 0) {
    el.hudFormula.textContent = ' ';
    return;
  }
  el.hudFormula.textContent = `${values.join(' + ')} = ${sum}`;
}

function clearCellSelectionMarks(index) {
  const cellEl = cellEls[index];
  cellEl.classList.remove('selected', 'selected-valid');
  const badge = cellEl.querySelector('.order-badge');
  if (badge) badge.remove();
}

export function playFailEffect(indices) {
  indices.forEach((i) => {
    clearCellSelectionMarks(i);
    if (reduceMotion) return;
    const cellEl = cellEls[i];
    cellEl.classList.add('fail-shake');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('fail-shake'), { once: true });
  });
}

export function playSuccessEffect(detail) {
  detail.indices.forEach((i) => clearCellSelectionMarks(i));
  showFloatingScore(detail);
}

// detail は scoring.calculateScore() の戻り値 + indices を持つ success イベント detail。
function buildFloatingLabel(detail) {
  if (detail.isForty && detail.isFever) return 'FORTY! ×2 × FEVER ×3';
  if (detail.isForty) return 'FORTY! ×2';
  if (detail.isFever) return 'FEVER ×3';
  return null;
}

function showFloatingScore(detail) {
  const lastIndex = detail.indices[detail.indices.length - 1];
  const cellEl = cellEls[lastIndex];
  const boardRect = el.board.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const label = buildFloatingLabel(detail);
  const multiplierSuffix = detail.totalMultiplier > 1 ? ` ×${detail.totalMultiplier}` : '';

  const floatEl = document.createElement('div');
  const classes = ['floating-score'];
  if (detail.isForty) classes.push('floating-forty');
  if (detail.isFever) classes.push('floating-fever');
  floatEl.className = classes.join(' ');
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = `${label ? `<span class="floating-label">${label}</span>` : ''}<span>+${detail.points}${multiplierSuffix}</span>`;

  el.floatingLayer.appendChild(floatEl);
  const remove = () => floatEl.remove();
  floatEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1200);
}

export function clearCells(indices) {
  indices.forEach((i) => cellEls[i].classList.add('clearing'));
  setTimeout(() => {
    indices.forEach((i) => {
      const cellEl = cellEls[i];
      cellEl.classList.remove('clearing');
      cellEl.classList.add('empty');
      cellEl.querySelector('.cell-value').textContent = '';
    });
  }, 220);
}

export function refillCells(cells) {
  cells.forEach(({ index, value }) => {
    const cellEl = cellEls[index];
    cellEl.classList.remove('empty');
    cellEl.querySelector('.cell-value').textContent = String(value);
    cellEl.classList.add('popping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('popping'), { once: true });
  });
}

export function updateTimer(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.hudTime.textContent = String(seconds);
}

export function updateScore(score) {
  el.hudScore.textContent = String(score);
}

export function showCountdown(label) {
  el.countdownOverlay.hidden = false;
  el.countdownLabel.textContent = label;
  el.countdownLabel.classList.remove('countdown-pop');
  void el.countdownLabel.offsetWidth; // reflow to restart animation
  el.countdownLabel.classList.add('countdown-pop');
  if (label === 'START!') {
    setTimeout(() => {
      el.countdownOverlay.hidden = true;
    }, 450);
  }
}

// ミリオン・フィーバーの盤面配色・常時バッジを切り替える。
export function setFeverActive(active) {
  el.screenGame.classList.toggle('fever', active);
}

// 残り10秒になった瞬間の開始演出。0.8〜1.2秒程度で自動的に消える。
export function showFeverStart() {
  el.feverStartOverlay.hidden = false;
  setTimeout(() => {
    el.feverStartOverlay.hidden = true;
  }, 1000);
}

export function showTimeUp() {
  el.timeupOverlay.hidden = false;
}

export function hideTimeUp() {
  el.timeupOverlay.hidden = true;
  el.feverStartOverlay.hidden = true;
  setFeverActive(false);
}

function formatRate(rate) {
  if (rate === null) return '—';
  return `${Math.round(rate)}%`;
}

export function renderResult({ score, stats, isNewBest }) {
  el.resultScore.textContent = String(score);
  el.resultNewBest.hidden = !isNewBest;
  el.resultTitle.textContent = getTitleForScore(score);

  el.breakdownNormal.textContent = String(stats.normalScore);
  el.breakdownFever.textContent = String(stats.feverScore);
  el.breakdownTotal.textContent = String(stats.normalScore + stats.feverScore);

  el.statSuccess.textContent = String(stats.successCount);
  el.statFailure.textContent = String(stats.failureCount);
  el.statRate.textContent = formatRate(calcSuccessRate(stats));
  el.stat10.textContent = String(stats.sumCounts[10]);
  el.stat20.textContent = String(stats.sumCounts[20]);
  el.stat30.textContent = String(stats.sumCounts[30]);
  el.stat40.textContent = String(stats.sumCounts[40]);
  el.statFeverSuccess.textContent = String(stats.feverSuccessCount);
  el.statCleared.textContent = String(stats.clearedCellCount);
  el.statHighest.textContent = String(stats.highestSingleScore);
  el.statFeverHighest.textContent = String(stats.highestFeverScore);
}
