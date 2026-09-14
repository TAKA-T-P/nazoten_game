// 画面切替、表示更新、演出呼出（仕様書 8章・12章、Phase2実装指示書 6・8章、Phase3実装指示書 6・9・15章）。
import * as storage from './storage.js';
import { CPU_LEVELS } from './config.js';
import { getTitleForScore, calcSuccessRate } from './scoring.js';

const el = {};
let cellEls = [];
let reduceMotion = false;

// CPUバトルの2盤面（player/cpu）を、ソロ用のcellElsとは別に管理する。
const battleBoards = {
  player: { boardEl: null, cellEls: [] },
  cpu: { boardEl: null, cellEls: [] }
};

function cacheDom() {
  el.screens = document.querySelectorAll('.screen');
  el.titleBest = document.getElementById('title-best-score');
  el.btnSoundMode = document.getElementById('btn-sound-mode');
  el.screenGame = document.getElementById('screen-game');
  el.board = document.getElementById('board');
  el.hudTime = document.getElementById('hud-time');
  el.hudScore = document.getElementById('hud-score');
  el.hudBest = document.getElementById('hud-best');
  el.hudFormula = document.getElementById('hud-formula');
  el.countdownOverlay = document.getElementById('countdown-overlay');
  el.countdownLabel = document.getElementById('countdown-label');
  el.feverStartBanner = document.getElementById('fever-start-banner');
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

  // CPUバトル関連
  el.btnCpuBattle = document.getElementById('btn-cpu-battle');
  el.cpuLevelButtons = document.querySelectorAll('.cpu-level-btn');
  el.cpuLevelDescription = document.getElementById('cpu-level-description');
  el.cpuLevelRecord = document.getElementById('cpu-level-record');

  el.screenBattle = document.getElementById('screen-battle');
  el.cpuBoard = document.getElementById('cpu-board');
  el.playerBoard = document.getElementById('player-board');
  el.battleHudTime = document.getElementById('battle-hud-time');
  el.battleHudFormula = document.getElementById('battle-hud-formula');
  el.battleCpuLevelLabel = document.getElementById('battle-cpu-level-label');
  el.battleGaugePlayer = document.getElementById('battle-gauge-player');
  el.battleFloatingLayer = document.getElementById('battle-floating-layer');
  el.battleCountdownOverlay = document.getElementById('battle-countdown-overlay');
  el.battleCountdownLabel = document.getElementById('battle-countdown-label');
  el.battleTimeupOverlay = document.getElementById('battle-timeup-overlay');

  el.battleOutcome = document.getElementById('battle-outcome');
  el.battleResultNewBest = document.getElementById('battle-result-newbest');
  el.battlePlayerScore = document.getElementById('battle-player-score');
  el.battleCpuScore = document.getElementById('battle-cpu-score');
  el.battleScoreDiff = document.getElementById('battle-score-diff');
  el.battleResultLevelLabel = document.getElementById('battle-result-level-label');
  el.battlePlayerTitle = document.getElementById('battle-player-title');
  el.battleCpuTitle = document.getElementById('battle-cpu-title');
  el.battleBreakdownNormal = document.getElementById('battle-breakdown-normal');
  el.battleBreakdownFever = document.getElementById('battle-breakdown-fever');
  el.battleBreakdownTotal = document.getElementById('battle-breakdown-total');
  el.battleStatSuccess = document.getElementById('battle-stat-success');
  el.battleStatFailure = document.getElementById('battle-stat-failure');
  el.battleStatRate = document.getElementById('battle-stat-rate');
  el.battleStat10 = document.getElementById('battle-stat-10');
  el.battleStat20 = document.getElementById('battle-stat-20');
  el.battleStat30 = document.getElementById('battle-stat-30');
  el.battleStat40 = document.getElementById('battle-stat-40');
  el.battleStatDestroy = document.getElementById('battle-stat-destroy');
  el.battleStatCpuSuccess = document.getElementById('battle-stat-cpu-success');
  el.battleStatCpuFailure = document.getElementById('battle-stat-cpu-failure');
  el.battleStatCpuDestroy = document.getElementById('battle-stat-cpu-destroy');
  el.battleRecordSummary = document.getElementById('battle-record-summary');
}

export function init() {
  cacheDom();
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  refreshSoundModeButton();
  el.titleBest.textContent = storage.getBestScore();
}

export function showScreen(name) {
  el.screens.forEach((s) => {
    s.hidden = s.dataset.screen !== name;
  });
}

const SOUND_MODE_LABELS = {
  bgm: 'BGMあり',
  seOnly: '効果音のみ',
  off: '音なし'
};

export function refreshSoundModeButton() {
  const mode = storage.getSoundMode();
  el.btnSoundMode.textContent = SOUND_MODE_LABELS[mode] || SOUND_MODE_LABELS.bgm;
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

// 数字入れかえ：1つ目に選んだマスだけをハイライトする（indexがnullなら全解除）。
export function updateSwapSelection(index) {
  cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('swap-selected', i === index);
  });
}

export function applySwap(indices, values) {
  indices.forEach((index, i) => {
    const cellEl = cellEls[index];
    cellEl.classList.remove('swap-selected');
    cellEl.querySelector('.cell-value').textContent = String(values[i]);
    cellEl.classList.add('swapping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('swapping'), { once: true });
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

// 残り10秒になった瞬間の開始演出。スコア表示直下のバナーとして表示し、
// 盤面の数字とは重ならない位置で0.8〜1.2秒程度自動的に消える。
export function showFeverStart() {
  el.feverStartBanner.hidden = false;
  setTimeout(() => {
    el.feverStartBanner.hidden = true;
  }, 1000);
}

export function showTimeUp() {
  el.timeupOverlay.hidden = false;
}

export function hideTimeUp() {
  el.timeupOverlay.hidden = true;
  el.feverStartBanner.hidden = true;
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
  el.statHighest.textContent = String(stats.highestNormalScore);
  el.statFeverHighest.textContent = String(stats.highestFeverScore);
}

// --- CPUバトル -------------------------------------------------------------

function formatRecord(record) {
  return `${record.wins}勝${record.losses}敗${record.draws}分`;
}

export function updateCpuLevelSelection(level) {
  el.cpuLevelButtons.forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.level === level);
  });
  el.cpuLevelDescription.textContent = CPU_LEVELS[level].description;
}

export function updateCpuLevelRecord(record) {
  el.cpuLevelRecord.textContent = `通算成績：${formatRecord(record)}`;
}

export function updateBattleCpuLevelLabel(level) {
  el.battleCpuLevelLabel.textContent = CPU_LEVELS[level].label;
}

export function getPlayerBoardElement() {
  return el.playerBoard;
}

function renderCellsInto(target, board) {
  target.boardEl.innerHTML = '';
  target.cellEls = [];
  for (let i = 0; i < board.size; i++) {
    const cellEl = document.createElement('div');
    cellEl.className = 'cell';
    cellEl.dataset.cellIndex = String(i);
    const valueEl = document.createElement('span');
    valueEl.className = 'cell-value';
    valueEl.textContent = String(board.getValue(i));
    cellEl.appendChild(valueEl);
    target.boardEl.appendChild(cellEl);
    target.cellEls.push(cellEl);
  }
}

export function renderBattleBoards(playerBoard, cpuBoard) {
  battleBoards.player.boardEl = el.playerBoard;
  battleBoards.cpu.boardEl = el.cpuBoard;
  renderCellsInto(battleBoards.player, playerBoard);
  renderCellsInto(battleBoards.cpu, cpuBoard);
  updateBattleHudFormula([], [], 0, false);
}

function updateBattleHudFormula(indices, values, sum, isValid) {
  el.battleHudFormula.classList.toggle('formula-valid', isValid && indices.length >= 2);
  el.battleHudFormula.textContent = indices.length === 0 ? ' ' : `${values.join(' + ')} = ${sum}`;
}

export function updatePlayerBattleSelection(detail) {
  const target = battleBoards.player;
  const selected = new Set(detail.indices);
  const showValid = detail.isValid && detail.indices.length >= 2;
  target.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', selected.has(i));
    cellEl.classList.toggle('selected-valid', selected.has(i) && showValid);
    const badge = cellEl.querySelector('.order-badge');
    if (badge) badge.remove();
  });
  detail.indices.forEach((cellIndex, order) => {
    const badge = document.createElement('span');
    badge.className = 'order-badge';
    badge.textContent = String(order + 1);
    target.cellEls[cellIndex].appendChild(badge);
  });
  updateBattleHudFormula(detail.indices, detail.values, detail.sum, detail.isValid);
}

// CPU盤面は正確な合計を表示せず、なぞっているマスの色だけで進行を伝える
//（仕様書6.4章）。
export function updateCpuSelection(indices) {
  const target = battleBoards.cpu;
  const selected = new Set(indices);
  target.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', selected.has(i));
  });
}

function clearBattleSelectionMarks(which, index) {
  const cellEl = battleBoards[which].cellEls[index];
  cellEl.classList.remove('selected', 'selected-valid');
  const badge = cellEl.querySelector('.order-badge');
  if (badge) badge.remove();
}

export function playBattleFailEffect(which, indices) {
  indices.forEach((i) => {
    clearBattleSelectionMarks(which, i);
    if (reduceMotion) return;
    const cellEl = battleBoards[which].cellEls[i];
    cellEl.classList.add('fail-shake');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('fail-shake'), { once: true });
  });
}

export function clearSuccessSelectionMarks(which, indices) {
  indices.forEach((i) => clearBattleSelectionMarks(which, i));
}

export function clearBattleCells(which, indices) {
  const target = battleBoards[which];
  indices.forEach((i) => target.cellEls[i].classList.add('clearing'));
  setTimeout(() => {
    indices.forEach((i) => {
      const cellEl = target.cellEls[i];
      cellEl.classList.remove('clearing');
      cellEl.classList.add('empty');
      cellEl.querySelector('.cell-value').textContent = '';
    });
  }, 220);
}

export function refillBattleCells(which, cells) {
  const target = battleBoards[which];
  cells.forEach(({ index, value }) => {
    const cellEl = target.cellEls[index];
    cellEl.classList.remove('empty');
    cellEl.querySelector('.cell-value').textContent = String(value);
    cellEl.classList.add('popping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('popping'), { once: true });
  });
}

// 数字入れかえ（プレイヤー盤面のみ対応）。
export function updatePlayerSwapSelection(index) {
  battleBoards.player.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('swap-selected', i === index);
  });
}

export function applyPlayerSwap(indices, values) {
  indices.forEach((index, i) => {
    const cellEl = battleBoards.player.cellEls[index];
    cellEl.classList.remove('swap-selected');
    cellEl.querySelector('.cell-value').textContent = String(values[i]);
    cellEl.classList.add('swapping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('swapping'), { once: true });
  });
}

export function updateBattleTimer(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.battleHudTime.textContent = String(seconds);
}

export function showBattleCountdown(label) {
  el.battleCountdownOverlay.hidden = false;
  el.battleCountdownLabel.textContent = label;
  el.battleCountdownLabel.classList.remove('countdown-pop');
  void el.battleCountdownLabel.offsetWidth;
  el.battleCountdownLabel.classList.add('countdown-pop');
  if (label === 'BATTLE!') {
    setTimeout(() => {
      el.battleCountdownOverlay.hidden = true;
    }, 450);
  }
}

export function setBattleFeverActive(active) {
  el.screenBattle.classList.toggle('fever', active);
}

export function showBattleTimeUp() {
  el.battleTimeupOverlay.hidden = false;
}

export function hideBattleTimeUp() {
  el.battleTimeupOverlay.hidden = true;
  setBattleFeverActive(false);
}

// 点差ベースのゲージ表示を更新する。非表示（フィーバー中）はCSS側の.feverクラスで
// 制御するため、ここでは幅の計算だけを行う（仕様書9.2〜9.4章）。
export function updateBattleGauge(detail) {
  const pct = Math.max(0, Math.min(100, detail.playerPercent));
  el.battleGaugePlayer.style.width = `${pct}%`;
}

const OUTCOME_LABELS = {
  win: 'YOU WIN!',
  lose: 'YOU LOSE...',
  draw: 'DRAW!'
};

export function renderBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats, isNewBest, record }) {
  el.battleOutcome.textContent = OUTCOME_LABELS[outcome] || '';
  el.battleOutcome.classList.remove('outcome-win', 'outcome-lose', 'outcome-draw');
  el.battleOutcome.classList.add(`outcome-${outcome}`);
  el.battleResultNewBest.hidden = !isNewBest;

  el.battlePlayerScore.textContent = String(playerScore);
  el.battleCpuScore.textContent = String(cpuScore);
  el.battleScoreDiff.textContent = String(Math.abs(playerScore - cpuScore));
  el.battleResultLevelLabel.textContent = CPU_LEVELS[level].label;
  el.battlePlayerTitle.textContent = getTitleForScore(playerScore);
  el.battleCpuTitle.textContent = `CPU: ${getTitleForScore(cpuScore)}`;

  el.battleBreakdownNormal.textContent = String(playerStats.normalScore);
  el.battleBreakdownFever.textContent = String(playerStats.feverScore);
  el.battleBreakdownTotal.textContent = String(playerStats.normalScore + playerStats.feverScore);

  el.battleStatSuccess.textContent = String(playerStats.successCount);
  el.battleStatFailure.textContent = String(playerStats.failureCount);
  el.battleStatRate.textContent = formatRate(calcSuccessRate(playerStats));
  el.battleStat10.textContent = String(playerStats.sumCounts[10]);
  el.battleStat20.textContent = String(playerStats.sumCounts[20]);
  el.battleStat30.textContent = String(playerStats.sumCounts[30]);
  el.battleStat40.textContent = String(playerStats.sumCounts[40]);
  el.battleStatDestroy.textContent = String(playerStats.destroyCount);
  el.battleStatCpuSuccess.textContent = String(cpuStats.successCount);
  el.battleStatCpuFailure.textContent = String(cpuStats.failureCount);
  el.battleStatCpuDestroy.textContent = String(cpuStats.destroyCount);
  el.battleRecordSummary.textContent = formatRecord(record);
}
