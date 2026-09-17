// 画面切替、表示更新、演出呼出（仕様書 8章・12章、Phase2実装指示書 6・8章、Phase3実装指示書 6・9・15章）。
import * as storage from './storage.js';
import { CONFIG, CPU_LEVELS, CPU_LEVEL_ORDER } from './config.js';
import { getTitleForScore, calcSuccessRate } from './scoring.js';

const el = {};
let cellEls = [];
let reduceMotion = false;

// CPUバトルの2盤面（player/cpu）を、ソロ用のcellElsとは別に管理する。
const battleBoards = {
  player: { boardEl: null, cellEls: [] },
  cpu: { boardEl: null, cellEls: [] }
};

// 2人バトルの2盤面（p1/p2）。CPUバトルのbattleBoardsとは別に管理する。
const twoPlayerBoards = {
  p1: { boardEl: null, cellEls: [] },
  p2: { boardEl: null, cellEls: [] }
};

function cacheDom() {
  el.screens = document.querySelectorAll('.screen');
  el.titleBest = document.getElementById('title-best-score');
  el.soundModeLabel = document.getElementById('sound-mode-label');
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
  el.statSuccess = document.getElementById('stat-success');
  el.statRate = document.getElementById('stat-rate');
  el.stat10 = document.getElementById('stat-10');
  el.stat20 = document.getElementById('stat-20');
  el.stat30 = document.getElementById('stat-30');
  el.stat40 = document.getElementById('stat-40');
  el.statSilverFever = document.getElementById('stat-silver-fever');
  el.statSwapDestroy = document.getElementById('stat-swap-destroy');
  el.statCleared = document.getElementById('stat-cleared');

  // CPUバトル関連
  el.btnCpuBattle = document.getElementById('btn-cpu-battle');
  el.cpuLevelSlider = document.getElementById('cpu-level-slider');
  el.cpuLevelCurrentName = document.getElementById('cpu-level-current-name');
  el.cpuLevelDescription = document.getElementById('cpu-level-description');
  el.cpuLevelRecord = document.getElementById('cpu-level-record');
  // CPU戦のバトル形式選択（スコアバトル/ごちゃまぜバトル）とオジャマON/OFF。
  // 2人バトルの形式選択（.battle-format-btn/#btn-ojama-toggle）とはIDが異なる
  // 別要素のため、状態が混ざらないよう画面単位でクエリする。
  el.cpuFormatButtons = document.querySelectorAll('#screen-cpu-select .battle-format-btn');
  el.cpuOjamaToggleBtn = document.getElementById('btn-cpu-ojama-toggle');

  el.screenBattle = document.getElementById('screen-battle');
  el.cpuBoard = document.getElementById('cpu-board');
  el.playerBoard = document.getElementById('player-board');
  el.battleHudTime = document.getElementById('battle-hud-time');
  el.battleHudFormula = document.getElementById('battle-hud-formula');
  el.battleHudFormulaRow = document.getElementById('battle-hud-formula-row');
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
  el.battleResultLevelLabel = document.getElementById('battle-result-level-label');
  el.battlePlayerTitle = document.getElementById('battle-player-title');
  el.battleCpuTitle = document.getElementById('battle-cpu-title');
  // 1P・CPUを横並びで比較する結果画面の表（player/cpuの2列）。
  el.battleStatNormal = { player: document.getElementById('battle-stat-normal-player'), cpu: document.getElementById('battle-stat-normal-cpu') };
  el.battleStatFever = { player: document.getElementById('battle-stat-fever-player'), cpu: document.getElementById('battle-stat-fever-cpu') };
  el.battleStatRate = { player: document.getElementById('battle-stat-rate-player'), cpu: document.getElementById('battle-stat-rate-cpu') };
  el.battleStatSuccess = { player: document.getElementById('battle-stat-success-player'), cpu: document.getElementById('battle-stat-success-cpu') };
  el.battleStat10 = { player: document.getElementById('battle-stat-10-player'), cpu: document.getElementById('battle-stat-10-cpu') };
  el.battleStat20 = { player: document.getElementById('battle-stat-20-player'), cpu: document.getElementById('battle-stat-20-cpu') };
  el.battleStat30 = { player: document.getElementById('battle-stat-30-player'), cpu: document.getElementById('battle-stat-30-cpu') };
  el.battleStat40 = { player: document.getElementById('battle-stat-40-player'), cpu: document.getElementById('battle-stat-40-cpu') };
  el.battleStatSilver = { player: document.getElementById('battle-stat-silver-player'), cpu: document.getElementById('battle-stat-silver-cpu') };
  el.battleStatSwapDestroy = { player: document.getElementById('battle-stat-swapdestroy-player'), cpu: document.getElementById('battle-stat-swapdestroy-cpu') };
  el.battleStatCleared = { player: document.getElementById('battle-stat-cleared-player'), cpu: document.getElementById('battle-stat-cleared-cpu') };

  // ごちゃまぜバトルCPU戦（スコアバトルCPU戦=battle-*とは別画面）。p1=プレイヤー・
  // p2=CPUとして扱い、オジャマ関連要素は既存の汎用マップにbattle同様'mcb'
  // スコープとして統合する。
  el.screenMixedCpuBattle = document.getElementById('screen-mixed-cpu-battle');
  el.mcbBoardPlayer = document.getElementById('mcb-board-player');
  el.mcbBoardCpu = document.getElementById('mcb-board-cpu');
  el.mcbHudTime = document.getElementById('mcb-hud-time');
  el.mcbHudFormula = document.getElementById('mcb-hud-formula');
  el.mcbHudFormulaRow = document.getElementById('mcb-hud-formula-row');
  el.mcbCpuLevelLabel = document.getElementById('mcb-cpu-level-label');
  el.mcbGaugePlayer = document.getElementById('mcb-gauge-player');
  el.mcbFloatingLayer = document.getElementById('mcb-floating-layer');
  el.mcbCountdownOverlay = document.getElementById('mcb-countdown-overlay');
  el.mcbCountdownLabel = document.getElementById('mcb-countdown-label');
  el.mcbTimeupOverlay = document.getElementById('mcb-timeup-overlay');
  el.mcbPlayerSilverBadge = document.getElementById('mcb-player-silver-badge');
  el.mcbCpuSilverBadge = document.getElementById('mcb-cpu-silver-badge');

  el.mcbOutcome = document.getElementById('mcb-outcome');
  el.mcbPlayerScore = document.getElementById('mcb-player-score');
  el.mcbCpuScore = document.getElementById('mcb-cpu-score');
  el.mcbResultLevelLabel = document.getElementById('mcb-result-level-label');
  el.mcbStatNormal = { player: document.getElementById('mcb-stat-normal-player'), cpu: document.getElementById('mcb-stat-normal-cpu') };
  el.mcbStatFever = { player: document.getElementById('mcb-stat-fever-player'), cpu: document.getElementById('mcb-stat-fever-cpu') };
  el.mcbStatRate = { player: document.getElementById('mcb-stat-rate-player'), cpu: document.getElementById('mcb-stat-rate-cpu') };
  el.mcbStatSuccess = { player: document.getElementById('mcb-stat-success-player'), cpu: document.getElementById('mcb-stat-success-cpu') };
  el.mcbStat10 = { player: document.getElementById('mcb-stat-10-player'), cpu: document.getElementById('mcb-stat-10-cpu') };
  el.mcbStat20 = { player: document.getElementById('mcb-stat-20-player'), cpu: document.getElementById('mcb-stat-20-cpu') };
  el.mcbStat30 = { player: document.getElementById('mcb-stat-30-player'), cpu: document.getElementById('mcb-stat-30-cpu') };
  el.mcbStat40 = { player: document.getElementById('mcb-stat-40-player'), cpu: document.getElementById('mcb-stat-40-cpu') };
  el.mcbStatSilver = { player: document.getElementById('mcb-stat-silver-player'), cpu: document.getElementById('mcb-stat-silver-cpu') };
  el.mcbStatSwapDestroy = { player: document.getElementById('mcb-stat-swapdestroy-player'), cpu: document.getElementById('mcb-stat-swapdestroy-cpu') };
  el.mcbStatCleared = { player: document.getElementById('mcb-stat-cleared-player'), cpu: document.getElementById('mcb-stat-cleared-cpu') };

  // 2人バトル関連
  el.btnTwoPlayer = document.getElementById('btn-two-player');
  el.screenTwoPlayer = document.getElementById('screen-two-player');
  el.tpBoard = { p1: document.getElementById('tp-board-p1'), p2: document.getElementById('tp-board-p2') };
  el.tpHudTime = { p1: document.getElementById('tp-hud-time-p1'), p2: document.getElementById('tp-hud-time-p2') };
  el.tpHudFormula = { p1: document.getElementById('tp-hud-formula-p1'), p2: document.getElementById('tp-hud-formula-p2') };
  el.tpFloatingLayer = { p1: document.getElementById('tp-floating-layer-p1'), p2: document.getElementById('tp-floating-layer-p2') };
  el.tpCountdownOverlay = { p1: document.getElementById('tp-countdown-overlay-p1'), p2: document.getElementById('tp-countdown-overlay-p2') };
  el.tpCountdownLabel = { p1: document.getElementById('tp-countdown-label-p1'), p2: document.getElementById('tp-countdown-label-p2') };
  el.tpTimeupOverlay = { p1: document.getElementById('tp-timeup-overlay-p1'), p2: document.getElementById('tp-timeup-overlay-p2') };
  el.tpPauseOverlay = { p1: document.getElementById('tp-pause-overlay-p1'), p2: document.getElementById('tp-pause-overlay-p2') };
  el.tpSilverBadge = { p1: document.getElementById('tp-silver-badge-p1'), p2: document.getElementById('tp-silver-badge-p2') };
  el.tpGaugeP1 = document.getElementById('tp-gauge-p1');

  el.tpOutcome = document.getElementById('tp-outcome');
  el.tpResultScore = { p1: document.getElementById('tp-score-p1'), p2: document.getElementById('tp-score-p2') };
  el.tpResultTitle = { p1: document.getElementById('tp-title-p1'), p2: document.getElementById('tp-title-p2') };
  el.tpStatScore = { p1: document.getElementById('tp-stat-score-p1'), p2: document.getElementById('tp-stat-score-p2') };
  el.tpStatNormal = { p1: document.getElementById('tp-stat-normal-p1'), p2: document.getElementById('tp-stat-normal-p2') };
  el.tpStatFeverScore = { p1: document.getElementById('tp-stat-feverscore-p1'), p2: document.getElementById('tp-stat-feverscore-p2') };
  el.tpStatRate = { p1: document.getElementById('tp-stat-rate-p1'), p2: document.getElementById('tp-stat-rate-p2') };
  el.tpStatSuccess = { p1: document.getElementById('tp-stat-success-p1'), p2: document.getElementById('tp-stat-success-p2') };
  el.tpStat10 = { p1: document.getElementById('tp-stat-10-p1'), p2: document.getElementById('tp-stat-10-p2') };
  el.tpStat20 = { p1: document.getElementById('tp-stat-20-p1'), p2: document.getElementById('tp-stat-20-p2') };
  el.tpStat30 = { p1: document.getElementById('tp-stat-30-p1'), p2: document.getElementById('tp-stat-30-p2') };
  el.tpStat40 = { p1: document.getElementById('tp-stat-40-p1'), p2: document.getElementById('tp-stat-40-p2') };
  el.tpStatSilver = { p1: document.getElementById('tp-stat-silver-p1'), p2: document.getElementById('tp-stat-silver-p2') };
  el.tpStatSwapDestroy = { p1: document.getElementById('tp-stat-swapdestroy-p1'), p2: document.getElementById('tp-stat-swapdestroy-p2') };
  el.tpStatCleared = { p1: document.getElementById('tp-stat-cleared-p1'), p2: document.getElementById('tp-stat-cleared-p2') };

  // 対戦形式選択（Phase5実装指示書4章）
  el.formatButtons = document.querySelectorAll('.battle-format-btn');
  el.ojamaToggleBtn = document.getElementById('btn-ojama-toggle');

  // ごちゃまぜバトル関連（Phase5実装指示書）
  el.mbBoard = { p1: document.getElementById('mb-board-p1'), p2: document.getElementById('mb-board-p2') };
  el.mbHudTime = { p1: document.getElementById('mb-hud-time-p1'), p2: document.getElementById('mb-hud-time-p2') };
  el.mbHudFormula = { p1: document.getElementById('mb-hud-formula-p1'), p2: document.getElementById('mb-hud-formula-p2') };
  el.mbFloatingLayer = { p1: document.getElementById('mb-floating-layer-p1'), p2: document.getElementById('mb-floating-layer-p2') };
  el.mbCountdownOverlay = { p1: document.getElementById('mb-countdown-overlay-p1'), p2: document.getElementById('mb-countdown-overlay-p2') };
  el.mbCountdownLabel = { p1: document.getElementById('mb-countdown-label-p1'), p2: document.getElementById('mb-countdown-label-p2') };
  el.mbTimeupOverlay = { p1: document.getElementById('mb-timeup-overlay-p1'), p2: document.getElementById('mb-timeup-overlay-p2') };
  el.mbPauseOverlay = { p1: document.getElementById('mb-pause-overlay-p1'), p2: document.getElementById('mb-pause-overlay-p2') };
  el.mbSilverBadge = { p1: document.getElementById('mb-silver-badge-p1'), p2: document.getElementById('mb-silver-badge-p2') };
  el.mbOjamaOverlay = { p1: document.getElementById('mb-ojama-overlay-p1'), p2: document.getElementById('mb-ojama-overlay-p2') };
  el.mbGaugeP1 = document.getElementById('mb-gauge-p1');
  el.screenMixedBattle = document.getElementById('screen-mixed-battle');

  el.mbOutcome = document.getElementById('mb-outcome');
  el.mbResultScore = { p1: document.getElementById('mb-score-p1'), p2: document.getElementById('mb-score-p2') };
  el.mbStatScore = { p1: document.getElementById('mb-stat-score-p1'), p2: document.getElementById('mb-stat-score-p2') };
  el.mbStatNormal = { p1: document.getElementById('mb-stat-normal-p1'), p2: document.getElementById('mb-stat-normal-p2') };
  el.mbStatFeverScore = { p1: document.getElementById('mb-stat-feverscore-p1'), p2: document.getElementById('mb-stat-feverscore-p2') };
  el.mbStatRate = { p1: document.getElementById('mb-stat-rate-p1'), p2: document.getElementById('mb-stat-rate-p2') };
  el.mbStatSuccess = { p1: document.getElementById('mb-stat-success-p1'), p2: document.getElementById('mb-stat-success-p2') };
  el.mbStat10 = { p1: document.getElementById('mb-stat-10-p1'), p2: document.getElementById('mb-stat-10-p2') };
  el.mbStat20 = { p1: document.getElementById('mb-stat-20-p1'), p2: document.getElementById('mb-stat-20-p2') };
  el.mbStat30 = { p1: document.getElementById('mb-stat-30-p1'), p2: document.getElementById('mb-stat-30-p2') };
  el.mbStat40 = { p1: document.getElementById('mb-stat-40-p1'), p2: document.getElementById('mb-stat-40-p2') };
  el.mbStatSilver = { p1: document.getElementById('mb-stat-silver-p1'), p2: document.getElementById('mb-stat-silver-p2') };
  el.mbStatSwapDestroy = { p1: document.getElementById('mb-stat-swapdestroy-p1'), p2: document.getElementById('mb-stat-swapdestroy-p2') };
  el.mbStatCleared = { p1: document.getElementById('mb-stat-cleared-p1'), p2: document.getElementById('mb-stat-cleared-p2') };

  // オジャマ用オーバーレイ（スコアバトル=tp・ごちゃまぜ=mbの両方に用意する）。
  // CPU戦（スコアバトルCPU=battle）はOjamaControllerをp1=プレイヤー・p2=CPUとして
  // 再利用する。オジャマは自動発動のためボタンはなく、各画面のオーバーレイ・
  // 受信ラベルだけを用意する（オジャマ被弾表示・視覚効果のため）。
  el.ojamaOverlays = {
    tp: { p1: document.getElementById('tp-ojama-overlay-p1'), p2: document.getElementById('tp-ojama-overlay-p2') },
    mb: { p1: document.getElementById('mb-ojama-overlay-p1'), p2: document.getElementById('mb-ojama-overlay-p2') },
    battle: { p1: document.getElementById('battle-ojama-overlay-player'), p2: document.getElementById('battle-ojama-overlay-cpu') },
    mcb: { p1: document.getElementById('mcb-ojama-overlay-player'), p2: document.getElementById('mcb-ojama-overlay-cpu') }
  };
  el.ojamaMeteorOverlays = {
    tp: { p1: document.getElementById('tp-ojama-meteor-p1'), p2: document.getElementById('tp-ojama-meteor-p2') },
    mb: { p1: document.getElementById('mb-ojama-meteor-p1'), p2: document.getElementById('mb-ojama-meteor-p2') },
    battle: { p1: document.getElementById('battle-ojama-meteor-player'), p2: document.getElementById('battle-ojama-meteor-cpu') },
    mcb: { p1: document.getElementById('mcb-ojama-meteor-player'), p2: document.getElementById('mcb-ojama-meteor-cpu') }
  };
  el.hudFormulaRow = {
    tp: { p1: document.getElementById('tp-hud-formula-row-p1'), p2: document.getElementById('tp-hud-formula-row-p2') },
    mb: { p1: document.getElementById('mb-hud-formula-row-p1'), p2: document.getElementById('mb-hud-formula-row-p2') },
    // CPU側には数式表示がそもそもないため、「ハイド」を受けても対象がなくnoopになる。
    battle: { p1: document.getElementById('battle-hud-formula-row'), p2: null },
    mcb: { p1: document.getElementById('mcb-hud-formula-row'), p2: null }
  };
  el.ojamaReceivedLabels = {
    tp: { p1: document.getElementById('tp-ojama-received-p1'), p2: document.getElementById('tp-ojama-received-p2') },
    mb: { p1: document.getElementById('mb-ojama-received-p1'), p2: document.getElementById('mb-ojama-received-p2') },
    battle: { p1: document.getElementById('battle-ojama-received-player'), p2: document.getElementById('battle-ojama-received-cpu') },
    mcb: { p1: document.getElementById('mcb-ojama-received-player'), p2: document.getElementById('mcb-ojama-received-cpu') }
  };
  el.ojamaReceivedType = {
    tp: { p1: document.getElementById('tp-ojama-received-type-p1'), p2: document.getElementById('tp-ojama-received-type-p2') },
    mb: { p1: document.getElementById('mb-ojama-received-type-p1'), p2: document.getElementById('mb-ojama-received-type-p2') },
    battle: { p1: document.getElementById('battle-ojama-received-type-player'), p2: document.getElementById('battle-ojama-received-type-cpu') },
    mcb: { p1: document.getElementById('mcb-ojama-received-type-player'), p2: document.getElementById('mcb-ojama-received-type-cpu') }
  };
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
  bgmOff: '効果音のみ',
  bgmRandom: 'BGMランダム',
  bgm1: 'BGM1',
  bgm2: 'BGM2',
  bgm3: 'BGM3',
  bgm4: 'BGM4',
  bgm5: 'BGM5',
  off: '音なし'
};

export function refreshSoundModeButton() {
  const mode = storage.getSoundMode();
  el.soundModeLabel.textContent = SOUND_MODE_LABELS[mode] || SOUND_MODE_LABELS.bgmOff;
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
// シルバー・フィーバーはisFever===falseかつmultiplier>1で判定する
// （ミリオン・フィーバーとシルバー・フィーバーは重複しないため）。
function buildFloatingLabel(detail) {
  const isSilver = !detail.isFever && detail.multiplier > 1;
  if (detail.isFever) return detail.isForty ? 'FORTY! + FEVER ×3' : 'FEVER ×3';
  if (isSilver) return detail.isForty ? 'FORTY! + SILVER ×2' : 'SILVER ×2';
  if (detail.isForty) return 'FORTY!';
  return null;
}

function showFloatingScore(detail) {
  const lastIndex = detail.indices[detail.indices.length - 1];
  const cellEl = cellEls[lastIndex];
  const boardRect = el.board.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const isSilver = !detail.isFever && detail.multiplier > 1;
  const label = buildFloatingLabel(detail);

  const floatEl = document.createElement('div');
  const classes = ['floating-score'];
  if (detail.isForty) classes.push('floating-forty');
  if (detail.isFever) classes.push('floating-fever');
  if (isSilver) classes.push('floating-silver');
  floatEl.className = classes.join(' ');
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = `${label ? `<span class="floating-label">${label}</span>` : ''}<span>+${detail.points}</span>`;

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

// シルバー・フィーバー（5マスで合計10）の盤面配色を切り替える。
// ミリオン・フィーバーとの優先関係はCSS側の:not(.fever)ガードで解決するため、
// ここでは発動状態をそのままクラスに反映するだけでよい。
export function setSilverFeverActive(active) {
  el.screenGame.classList.toggle('silver-fever', active);
}

export function showTimeUp() {
  el.timeupOverlay.hidden = false;
}

export function hideTimeUp() {
  el.timeupOverlay.hidden = true;
  el.feverStartBanner.hidden = true;
  setFeverActive(false);
  setSilverFeverActive(false);
}

function formatRate(rate) {
  if (rate === null) return '—';
  return `${Math.round(rate)}%`;
}

// 2人バトル系の結果画面（スコアバトル・ごちゃまぜバトル）の記録一覧表で、
// 1P・2Pを比べて大きい方に.stat-highlightを付ける（黄色背景・黒文字）。
// 成功率のように表示用の文字列と比較用の生数値が異なる項目のために、
// compare用の値を別途受け取れるようにする（省略時はvalueをそのまま使う）。
// pairはキー名が{p1,p2}・{player,cpu}のどちらでもよい2要素のオブジェクト。
// Object.valuesで順序どおり（1つ目・2つ目）取り出して汎用的に扱う。
function setStatWithHighlight(pair, value1, value2, compare1 = value1, compare2 = value2) {
  const [el1, el2] = Object.values(pair);
  el1.textContent = String(value1);
  el2.textContent = String(value2);
  const bothNumbers = typeof compare1 === 'number' && typeof compare2 === 'number';
  el1.classList.toggle('stat-highlight', bothNumbers && compare1 > compare2);
  el2.classList.toggle('stat-highlight', bothNumbers && compare2 > compare1);
}

export function renderResult({ score, stats, isNewBest }) {
  el.resultScore.textContent = String(score);
  el.resultNewBest.hidden = !isNewBest;
  el.resultTitle.textContent = getTitleForScore(score);

  el.breakdownNormal.textContent = String(stats.normalScore);
  el.breakdownFever.textContent = String(stats.feverScore);

  el.statRate.textContent = formatRate(calcSuccessRate(stats));
  el.statSuccess.textContent = String(stats.successCount);
  el.stat10.textContent = String(stats.sumCounts[10]);
  el.stat20.textContent = String(stats.sumCounts[20]);
  el.stat30.textContent = String(stats.sumCounts[30]);
  el.stat40.textContent = String(stats.sumCounts[40]);
  el.statSilverFever.textContent = String(stats.silverFeverCount);
  el.statSwapDestroy.textContent = String(stats.swapCount + stats.destroyCount);
  el.statCleared.textContent = String(stats.clearedCellCount);
}

// --- CPUバトル -------------------------------------------------------------

// 通算成績は勝利数のみを表示する（仕様変更：以前は「0勝0敗0分」だった）。
function formatRecord(record) {
  return `${record.wins}勝`;
}

export function updateCpuLevelSelection(level) {
  const index = CPU_LEVEL_ORDER.indexOf(level);
  el.cpuLevelSlider.value = String(index >= 0 ? index : 0);
  el.cpuLevelCurrentName.textContent = CPU_LEVELS[level].name;
  el.cpuLevelDescription.textContent = CPU_LEVELS[level].description;
}

// スライダーの現在値（0〜5）を強さレベル（'1'〜'5'・'MAX'）へ変換する。
export function getCpuLevelFromSliderValue() {
  return CPU_LEVEL_ORDER[Number(el.cpuLevelSlider.value)];
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

// シルバー・フィーバーはプレイヤー・CPUで独立して発動するため、盤面ごとに
// 別クラスを切り替える（css/battle.cssの.player-silver-fever/.cpu-silver-fever）。
export function setBattlePlayerSilverFeverActive(active) {
  el.screenBattle.classList.toggle('player-silver-fever', active);
}

export function setBattleCpuSilverFeverActive(active) {
  el.screenBattle.classList.toggle('cpu-silver-fever', active);
}

export function showBattleTimeUp() {
  el.battleTimeupOverlay.hidden = false;
}

export function hideBattleTimeUp() {
  el.battleTimeupOverlay.hidden = true;
  setBattleFeverActive(false);
  setBattlePlayerSilverFeverActive(false);
  setBattleCpuSilverFeverActive(false);
  clearOjamaEffect('battle', 'p1');
  clearOjamaEffect('battle', 'p2');
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

export function renderBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats, isNewBest }) {
  el.battleOutcome.textContent = OUTCOME_LABELS[outcome] || '';
  el.battleOutcome.classList.remove('outcome-win', 'outcome-lose', 'outcome-draw');
  el.battleOutcome.classList.add(`outcome-${outcome}`);
  el.battleResultNewBest.hidden = !isNewBest;

  el.battlePlayerScore.textContent = String(playerScore);
  el.battleCpuScore.textContent = String(cpuScore);
  el.battleResultLevelLabel.textContent = CPU_LEVELS[level].label;
  el.battlePlayerTitle.textContent = getTitleForScore(playerScore);
  el.battleCpuTitle.textContent = `CPU: ${getTitleForScore(cpuScore)}`;

  setStatWithHighlight(el.battleStatNormal, playerStats.normalScore, cpuStats.normalScore);
  setStatWithHighlight(el.battleStatFever, playerStats.feverScore, cpuStats.feverScore);
  const playerRate = calcSuccessRate(playerStats);
  const cpuRate = calcSuccessRate(cpuStats);
  setStatWithHighlight(el.battleStatRate, formatRate(playerRate), formatRate(cpuRate), playerRate, cpuRate);
  setStatWithHighlight(el.battleStatSuccess, playerStats.successCount, cpuStats.successCount);
  setStatWithHighlight(el.battleStat10, playerStats.sumCounts[10], cpuStats.sumCounts[10]);
  setStatWithHighlight(el.battleStat20, playerStats.sumCounts[20], cpuStats.sumCounts[20]);
  setStatWithHighlight(el.battleStat30, playerStats.sumCounts[30], cpuStats.sumCounts[30]);
  setStatWithHighlight(el.battleStat40, playerStats.sumCounts[40], cpuStats.sumCounts[40]);
  setStatWithHighlight(el.battleStatSilver, playerStats.silverFeverCount, cpuStats.silverFeverCount);
  setStatWithHighlight(el.battleStatSwapDestroy, playerStats.swapCount + playerStats.destroyCount, cpuStats.swapCount + cpuStats.destroyCount);
  setStatWithHighlight(el.battleStatCleared, playerStats.clearedCellCount, cpuStats.clearedCellCount);
}

// --- 2人バトル（Phase4実装指示書） -------------------------------------------

const TWO_PLAYER_ACTORS = ['p1', 'p2'];

export function getTwoPlayerBoardElements() {
  return { p1: el.tpBoard.p1, p2: el.tpBoard.p2 };
}

function updateTwoPlayerHudFormula(actor, indices, values, sum, isValid) {
  const target = el.tpHudFormula[actor];
  target.classList.toggle('formula-valid', isValid && indices.length >= 2);
  target.textContent = indices.length === 0 ? ' ' : `${values.join(' + ')} = ${sum}`;
}

export function renderTwoPlayerBoards(p1Board, p2Board) {
  twoPlayerBoards.p1.boardEl = el.tpBoard.p1;
  twoPlayerBoards.p2.boardEl = el.tpBoard.p2;
  renderCellsInto(twoPlayerBoards.p1, p1Board);
  renderCellsInto(twoPlayerBoards.p2, p2Board);
  TWO_PLAYER_ACTORS.forEach((actor) => updateTwoPlayerHudFormula(actor, [], [], 0, false));
}

export function updateTwoPlayerSelection(actor, detail) {
  const target = twoPlayerBoards[actor];
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
  updateTwoPlayerHudFormula(actor, detail.indices, detail.values, detail.sum, detail.isValid);
}

function clearTwoPlayerSelectionMarks(actor, index) {
  const cellEl = twoPlayerBoards[actor].cellEls[index];
  cellEl.classList.remove('selected', 'selected-valid');
  const badge = cellEl.querySelector('.order-badge');
  if (badge) badge.remove();
}

export function playTwoPlayerFailEffect(actor, indices) {
  indices.forEach((i) => {
    clearTwoPlayerSelectionMarks(actor, i);
    if (reduceMotion) return;
    const cellEl = twoPlayerBoards[actor].cellEls[i];
    cellEl.classList.add('fail-shake');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('fail-shake'), { once: true });
  });
}

function showTwoPlayerFloatingScore(actor, detail) {
  const target = twoPlayerBoards[actor];
  const lastIndex = detail.indices[detail.indices.length - 1];
  const cellEl = target.cellEls[lastIndex];
  const boardRect = target.boardEl.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const isSilver = !detail.isFever && detail.multiplier > 1;
  const label = buildFloatingLabel(detail);

  const floatEl = document.createElement('div');
  const classes = ['floating-score'];
  if (detail.isForty) classes.push('floating-forty');
  if (detail.isFever) classes.push('floating-fever');
  if (isSilver) classes.push('floating-silver');
  floatEl.className = classes.join(' ');
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = `${label ? `<span class="floating-label">${label}</span>` : ''}<span>+${detail.points}</span>`;

  el.tpFloatingLayer[actor].appendChild(floatEl);
  const remove = () => floatEl.remove();
  floatEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1200);
}

export function playTwoPlayerSuccessEffect(actor, detail) {
  detail.indices.forEach((i) => clearTwoPlayerSelectionMarks(actor, i));
  showTwoPlayerFloatingScore(actor, detail);
}

export function clearTwoPlayerCells(actor, indices) {
  const target = twoPlayerBoards[actor];
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

export function refillTwoPlayerCells(actor, cells) {
  const target = twoPlayerBoards[actor];
  cells.forEach(({ index, value }) => {
    const cellEl = target.cellEls[index];
    cellEl.classList.remove('empty');
    cellEl.querySelector('.cell-value').textContent = String(value);
    cellEl.classList.add('popping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('popping'), { once: true });
  });
}

export function updateTwoPlayerSwapSelection(actor, index) {
  twoPlayerBoards[actor].cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('swap-selected', i === index);
  });
}

export function applyTwoPlayerSwap(actor, indices, values) {
  indices.forEach((index, i) => {
    const cellEl = twoPlayerBoards[actor].cellEls[index];
    cellEl.classList.remove('swap-selected');
    cellEl.querySelector('.cell-value').textContent = String(values[i]);
    cellEl.classList.add('swapping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('swapping'), { once: true });
  });
}

// 共通の1つの時計から、P1・P2両方の残り時間表示を同じ値で更新する（仕様書9.2章）。
export function updateTwoPlayerTimer(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.tpHudTime.p1.textContent = String(seconds);
  el.tpHudTime.p2.textContent = String(seconds);
}

export function showTwoPlayerCountdown(label) {
  TWO_PLAYER_ACTORS.forEach((actor) => {
    const overlay = el.tpCountdownOverlay[actor];
    const labelEl = el.tpCountdownLabel[actor];
    overlay.hidden = false;
    labelEl.textContent = label;
    labelEl.classList.remove('countdown-pop');
    void labelEl.offsetWidth; // reflow to restart animation
    labelEl.classList.add('countdown-pop');
    if (label === 'BATTLE!') {
      setTimeout(() => { overlay.hidden = true; }, 450);
    }
  });
}

export function setTwoPlayerFeverActive(active) {
  el.screenTwoPlayer.classList.toggle('fever', active);
}

// シルバー・フィーバーはP1・P2で独立して発動するため、盤面ごとに別クラスを切り替える
// （css/two-player.cssの.p1-silver-fever/.p2-silver-fever）。
export function setTwoPlayerSilverFeverActive(actor, active) {
  el.screenTwoPlayer.classList.toggle(`${actor}-silver-fever`, active);
}

export function showTwoPlayerTimeUp() {
  TWO_PLAYER_ACTORS.forEach((actor) => { el.tpTimeupOverlay[actor].hidden = false; });
}

export function hideTwoPlayerTimeUp() {
  TWO_PLAYER_ACTORS.forEach((actor) => { el.tpTimeupOverlay[actor].hidden = true; });
  setTwoPlayerFeverActive(false);
  setTwoPlayerSilverFeverActive('p1', false);
  setTwoPlayerSilverFeverActive('p2', false);
  clearOjamaEffect('tp', 'p1');
  clearOjamaEffect('tp', 'p2');
  hideTwoPlayerPause();
}

// ポーズ確認（Phase6：もどる→ポーズボタン化）。P1・P2両方のゾーンへ同時に
// 表示し、押した側から見て正しい向きで読めるようにする（timeup-overlayと
// 同じ「両ゾーンに1つずつ用意する」方式）。
export function showTwoPlayerPause() {
  TWO_PLAYER_ACTORS.forEach((actor) => { el.tpPauseOverlay[actor].hidden = false; });
}

export function hideTwoPlayerPause() {
  TWO_PLAYER_ACTORS.forEach((actor) => { el.tpPauseOverlay[actor].hidden = true; });
}

// 点差ベースのゲージ表示を更新する（仕様書16章）。P1側の幅を直接指定し、P2側は
// flex:1で残りを埋める（css/two-player.css参照）。
export function updateTwoPlayerGauge(detail) {
  const pct = Math.max(0, Math.min(100, detail.p1Percent));
  el.tpGaugeP1.style.width = `${pct}%`;
}

// CPU戦結果画面と同じ「単一の勝敗表示」に統一する（以前のP1・P2別々表示から変更）。
const TWO_PLAYER_OUTCOME_LABELS = {
  p1win: '1P WIN!',
  p2win: '2P WIN!',
  draw: 'DRAW!'
};

export function renderTwoPlayerResult({ outcome, p1Score, p2Score, p1Stats, p2Stats }) {
  el.tpOutcome.textContent = TWO_PLAYER_OUTCOME_LABELS[outcome] || '';
  el.tpOutcome.classList.remove('outcome-p1win', 'outcome-p2win', 'outcome-draw');
  el.tpOutcome.classList.add(`outcome-${outcome}`);

  el.tpResultScore.p1.textContent = String(p1Score);
  el.tpResultScore.p2.textContent = String(p2Score);
  el.tpResultTitle.p1.textContent = getTitleForScore(p1Score);
  el.tpResultTitle.p2.textContent = getTitleForScore(p2Score);

  setStatWithHighlight(el.tpStatScore, p1Score, p2Score);
  setStatWithHighlight(el.tpStatNormal, p1Stats.normalScore, p2Stats.normalScore);
  setStatWithHighlight(el.tpStatFeverScore, p1Stats.feverScore, p2Stats.feverScore);
  const p1Rate = calcSuccessRate(p1Stats);
  const p2Rate = calcSuccessRate(p2Stats);
  setStatWithHighlight(el.tpStatRate, formatRate(p1Rate), formatRate(p2Rate), p1Rate, p2Rate);
  setStatWithHighlight(el.tpStatSuccess, p1Stats.successCount, p2Stats.successCount);
  setStatWithHighlight(el.tpStat10, p1Stats.sumCounts[10], p2Stats.sumCounts[10]);
  setStatWithHighlight(el.tpStat20, p1Stats.sumCounts[20], p2Stats.sumCounts[20]);
  setStatWithHighlight(el.tpStat30, p1Stats.sumCounts[30], p2Stats.sumCounts[30]);
  setStatWithHighlight(el.tpStat40, p1Stats.sumCounts[40], p2Stats.sumCounts[40]);
  setStatWithHighlight(el.tpStatSilver, p1Stats.silverFeverCount, p2Stats.silverFeverCount);
  setStatWithHighlight(
    el.tpStatSwapDestroy,
    p1Stats.swapCount + p1Stats.destroyCount,
    p2Stats.swapCount + p2Stats.destroyCount
  );
  setStatWithHighlight(el.tpStatCleared, p1Stats.clearedCellCount, p2Stats.clearedCellCount);
}

// --- 対戦形式選択・オジャマ設定（Phase5実装指示書4章） -----------------------

export function updateFormatSelection(format) {
  el.formatButtons.forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.format === format);
  });
}

export function updateOjamaToggle(enabled) {
  el.ojamaToggleBtn.textContent = enabled ? 'ON' : 'OFF';
  el.ojamaToggleBtn.classList.toggle('is-on', enabled);
  el.ojamaToggleBtn.setAttribute('aria-pressed', String(enabled));
}

// CPU戦（バトル形式とCPUの強さを選ぶ画面）専用。2人バトルの形式選択とは別要素・
// 別状態のため、同じCSSクラスを再利用しつつ関数だけを分ける。
export function updateCpuBattleFormatSelection(format) {
  el.cpuFormatButtons.forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.format === format);
  });
}

export function updateCpuBattleOjamaToggle(enabled) {
  el.cpuOjamaToggleBtn.textContent = enabled ? 'ON' : 'OFF';
  el.cpuOjamaToggleBtn.classList.toggle('is-on', enabled);
  el.cpuOjamaToggleBtn.setAttribute('aria-pressed', String(enabled));
}

// --- ごちゃまぜバトル（Phase5実装指示書5〜14章） ------------------------------
// 盤面は1つだけ共有されるが、DOM表示はP1用・P2用の2組を持つ（仕様書6.1章）。
// 自分の選択は既存の.selected/.selected-validを使い、相手の選択は
// .opp-selected-p1/.opp-selected-p2という別クラスで、もう一方の盤面にだけ重ねて
// 表示する（仕様書7.2章）。

const mixedBoards = {
  p1: { boardEl: null, cellEls: [] },
  p2: { boardEl: null, cellEls: [] }
};

const mixedSelection = {
  p1: { indices: [], values: [], sum: 0, isValid: false },
  p2: { indices: [], values: [], sum: 0, isValid: false }
};

export function getMixedBattleBoardElements() {
  return { p1: el.mbBoard.p1, p2: el.mbBoard.p2 };
}

export function renderMixedBattleBoards(board) {
  mixedBoards.p1.boardEl = el.mbBoard.p1;
  mixedBoards.p2.boardEl = el.mbBoard.p2;
  renderCellsInto(mixedBoards.p1, board);
  renderCellsInto(mixedBoards.p2, board);
  mixedSelection.p1 = { indices: [], values: [], sum: 0, isValid: false };
  mixedSelection.p2 = { indices: [], values: [], sum: 0, isValid: false };
  updateMixedHudFormula('p1', [], [], 0, false);
  updateMixedHudFormula('p2', [], [], 0, false);
  updateMixedHighlights();
}

function updateMixedHudFormula(actor, indices, values, sum, isValid) {
  const target = el.mbHudFormula[actor];
  target.classList.toggle('formula-valid', isValid && indices.length >= 2);
  target.textContent = indices.length === 0 ? ' ' : `${values.join(' + ')} = ${sum}`;
}

// 両方のDOM盤面へ、自分の選択（強い枠）と相手の選択（色つきリング）を反映する。
// 毎回両方を丸ごと再計算することで、更新順序に依存しない一貫した表示にする。
function updateMixedHighlights() {
  const p1 = mixedSelection.p1;
  const p2 = mixedSelection.p2;
  const p1Set = new Set(p1.indices);
  const p2Set = new Set(p2.indices);
  const p1ShowValid = p1.isValid && p1.indices.length >= 2;
  const p2ShowValid = p2.isValid && p2.indices.length >= 2;

  const p1Target = mixedBoards.p1;
  p1Target.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', p1Set.has(i));
    cellEl.classList.toggle('selected-valid', p1Set.has(i) && p1ShowValid);
    cellEl.classList.toggle('opp-selected-p2', p2Set.has(i));
    const badge = cellEl.querySelector('.order-badge');
    if (badge) badge.remove();
  });
  p1.indices.forEach((cellIndex, order) => {
    const badge = document.createElement('span');
    badge.className = 'order-badge';
    badge.textContent = String(order + 1);
    p1Target.cellEls[cellIndex].appendChild(badge);
  });

  const p2Target = mixedBoards.p2;
  p2Target.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', p2Set.has(i));
    cellEl.classList.toggle('selected-valid', p2Set.has(i) && p2ShowValid);
    cellEl.classList.toggle('opp-selected-p1', p1Set.has(i));
    const badge = cellEl.querySelector('.order-badge');
    if (badge) badge.remove();
  });
  p2.indices.forEach((cellIndex, order) => {
    const badge = document.createElement('span');
    badge.className = 'order-badge';
    badge.textContent = String(order + 1);
    p2Target.cellEls[cellIndex].appendChild(badge);
  });
}

export function updateMixedSelection(actor, detail) {
  mixedSelection[actor] = { indices: detail.indices, values: detail.values, sum: detail.sum, isValid: detail.isValid };
  updateMixedHighlights();
  updateMixedHudFormula(actor, detail.indices, detail.values, detail.sum, detail.isValid);
}

function flashMixedCells(actor, indices) {
  const target = mixedBoards[actor];
  indices.forEach((i) => {
    if (reduceMotion) return;
    const cellEl = target.cellEls[i];
    cellEl.classList.add('fail-shake');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('fail-shake'), { once: true });
  });
}

export function playMixedFailEffect(actor, indices) {
  flashMixedCells(actor, indices);
}

// 横取りされて失敗扱いなしで解除されたときの、中立な短いフィードバック
// （仕様書8.3章：「先に取られた！」）。
export function playMixedStolenEffect(actor, indices) {
  const target = mixedBoards[actor];
  const lastIndex = indices[indices.length - 1];
  const cellEl = target.cellEls[lastIndex];
  const boardRect = target.boardEl.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const floatEl = document.createElement('div');
  floatEl.className = 'floating-score floating-stolen';
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = '<span class="floating-label">先に取られた！</span>';

  el.mbFloatingLayer[actor].appendChild(floatEl);
  const remove = () => floatEl.remove();
  floatEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1200);
}

export function playMixedBlockedEffect(actor, indices) {
  flashMixedCells(actor, indices);
}

function showMixedFloatingScore(actor, detail) {
  const target = mixedBoards[actor];
  const lastIndex = detail.indices[detail.indices.length - 1];
  const cellEl = target.cellEls[lastIndex];
  const boardRect = target.boardEl.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const isSilver = !detail.isFever && detail.multiplier > 1;
  const label = buildFloatingLabel(detail);

  const floatEl = document.createElement('div');
  const classes = ['floating-score'];
  if (detail.isForty) classes.push('floating-forty');
  if (detail.isFever) classes.push('floating-fever');
  if (isSilver) classes.push('floating-silver');
  floatEl.className = classes.join(' ');
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = `${label ? `<span class="floating-label">${label}</span>` : ''}<span>+${detail.points}</span>`;

  el.mbFloatingLayer[actor].appendChild(floatEl);
  const remove = () => floatEl.remove();
  floatEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1200);
}

export function playMixedSuccessEffect(actor, detail) {
  showMixedFloatingScore(actor, detail);
}

// 共有盤面のため、消去・補充は両方のDOM盤面へ同時に反映する（仕様書12章）。
export function clearMixedCells(indices) {
  ['p1', 'p2'].forEach((actor) => {
    const target = mixedBoards[actor];
    indices.forEach((i) => target.cellEls[i].classList.add('clearing'));
  });
  setTimeout(() => {
    ['p1', 'p2'].forEach((actor) => {
      const target = mixedBoards[actor];
      indices.forEach((i) => {
        const cellEl = target.cellEls[i];
        cellEl.classList.remove('clearing');
        cellEl.classList.add('empty');
        cellEl.querySelector('.cell-value').textContent = '';
      });
    });
  }, 220);
}

export function refillMixedCells(cells) {
  ['p1', 'p2'].forEach((actor) => {
    const target = mixedBoards[actor];
    cells.forEach(({ index, value }) => {
      const cellEl = target.cellEls[index];
      cellEl.classList.remove('empty');
      cellEl.querySelector('.cell-value').textContent = String(value);
      cellEl.classList.add('popping');
      cellEl.addEventListener('animationend', () => cellEl.classList.remove('popping'), { once: true });
    });
  });
  applyOjamaSmallToRefilledCells('mb', cells);
}

export function updateMixedSwapSelection(actor, index) {
  mixedBoards[actor].cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('swap-selected', i === index);
  });
}

// 共有盤面のため、入れかえも両方のDOM盤面へ同時に反映する。
export function applyMixedSwap(indices, values) {
  ['p1', 'p2'].forEach((actor) => {
    const target = mixedBoards[actor];
    indices.forEach((index, i) => {
      const cellEl = target.cellEls[index];
      cellEl.classList.remove('swap-selected');
      cellEl.querySelector('.cell-value').textContent = String(values[i]);
      cellEl.classList.add('swapping');
      cellEl.addEventListener('animationend', () => cellEl.classList.remove('swapping'), { once: true });
    });
  });
}

export function updateMixedTimer(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.mbHudTime.p1.textContent = String(seconds);
  el.mbHudTime.p2.textContent = String(seconds);
}

export function showMixedCountdown(label) {
  ['p1', 'p2'].forEach((actor) => {
    const overlay = el.mbCountdownOverlay[actor];
    const labelEl = el.mbCountdownLabel[actor];
    overlay.hidden = false;
    labelEl.textContent = label;
    labelEl.classList.remove('countdown-pop');
    void labelEl.offsetWidth;
    labelEl.classList.add('countdown-pop');
    if (label === 'BATTLE!') {
      setTimeout(() => { overlay.hidden = true; }, 450);
    }
  });
}

export function setMixedFeverActive(active) {
  el.screenMixedBattle.classList.toggle('fever', active);
}

export function setMixedSilverFeverActive(actor, active) {
  el.screenMixedBattle.classList.toggle(`${actor}-silver-fever`, active);
}

export function showMixedTimeUp() {
  ['p1', 'p2'].forEach((actor) => { el.mbTimeupOverlay[actor].hidden = false; });
}

export function hideMixedTimeUp() {
  ['p1', 'p2'].forEach((actor) => { el.mbTimeupOverlay[actor].hidden = true; });
  setMixedFeverActive(false);
  setMixedSilverFeverActive('p1', false);
  setMixedSilverFeverActive('p2', false);
  clearOjamaEffect('mb', 'p1');
  clearOjamaEffect('mb', 'p2');
  hideMixedPause();
}

export function showMixedPause() {
  ['p1', 'p2'].forEach((actor) => { el.mbPauseOverlay[actor].hidden = false; });
}

export function hideMixedPause() {
  ['p1', 'p2'].forEach((actor) => { el.mbPauseOverlay[actor].hidden = true; });
}

export function updateMixedGauge(detail) {
  const pct = Math.max(0, Math.min(100, detail.p1Percent));
  el.mbGaugeP1.style.width = `${pct}%`;
}

export function renderMixedBattleResult({ outcome, p1Score, p2Score, p1Stats, p2Stats }) {
  el.mbOutcome.textContent = TWO_PLAYER_OUTCOME_LABELS[outcome] || '';
  el.mbOutcome.classList.remove('outcome-p1win', 'outcome-p2win', 'outcome-draw');
  el.mbOutcome.classList.add(`outcome-${outcome}`);

  el.mbResultScore.p1.textContent = String(p1Score);
  el.mbResultScore.p2.textContent = String(p2Score);

  setStatWithHighlight(el.mbStatScore, p1Score, p2Score);
  setStatWithHighlight(el.mbStatNormal, p1Stats.normalScore, p2Stats.normalScore);
  setStatWithHighlight(el.mbStatFeverScore, p1Stats.feverScore, p2Stats.feverScore);
  const p1Rate = calcSuccessRate(p1Stats);
  const p2Rate = calcSuccessRate(p2Stats);
  setStatWithHighlight(el.mbStatRate, formatRate(p1Rate), formatRate(p2Rate), p1Rate, p2Rate);
  setStatWithHighlight(el.mbStatSuccess, p1Stats.successCount, p2Stats.successCount);
  setStatWithHighlight(el.mbStat10, p1Stats.sumCounts[10], p2Stats.sumCounts[10]);
  setStatWithHighlight(el.mbStat20, p1Stats.sumCounts[20], p2Stats.sumCounts[20]);
  setStatWithHighlight(el.mbStat30, p1Stats.sumCounts[30], p2Stats.sumCounts[30]);
  setStatWithHighlight(el.mbStat40, p1Stats.sumCounts[40], p2Stats.sumCounts[40]);
  setStatWithHighlight(el.mbStatSilver, p1Stats.silverFeverCount, p2Stats.silverFeverCount);
  setStatWithHighlight(
    el.mbStatSwapDestroy,
    p1Stats.swapCount + p1Stats.destroyCount,
    p2Stats.swapCount + p2Stats.destroyCount
  );
  setStatWithHighlight(el.mbStatCleared, p1Stats.clearedCellCount, p2Stats.clearedCellCount);
}

// --- ごちゃまぜバトルCPU戦 ---------------------------------------------------
// レイアウトはCPUバトル（battleBoards/player・cpu）と同じ「上下2盤面・共通の
// 残り時間表示」を再利用し、共有盤面の重ね表示（相手選択リング）だけをmixed-
// battle.jsと同じ考え方で追加する。p1=プレイヤー・p2=CPUとして扱う。

const mcbBoards = {
  player: { boardEl: null, cellEls: [] },
  cpu: { boardEl: null, cellEls: [] }
};

const mcbSelection = {
  p1: { indices: [], values: [], sum: 0, isValid: false },
  p2: { indices: [] }
};

export function getMixedCpuBattleBoardElements() {
  return { player: el.mcbBoardPlayer, cpu: el.mcbBoardCpu };
}

export function renderMixedCpuBattleBoards(board) {
  mcbBoards.player.boardEl = el.mcbBoardPlayer;
  mcbBoards.cpu.boardEl = el.mcbBoardCpu;
  renderCellsInto(mcbBoards.player, board);
  renderCellsInto(mcbBoards.cpu, board);
  mcbSelection.p1 = { indices: [], values: [], sum: 0, isValid: false };
  mcbSelection.p2 = { indices: [] };
  updateMixedCpuHudFormula([], [], 0, false);
  updateMixedCpuHighlights();
}

export function updateMixedCpuCpuLevelLabel(level) {
  el.mcbCpuLevelLabel.textContent = CPU_LEVELS[level].label;
}

function updateMixedCpuHudFormula(indices, values, sum, isValid) {
  el.mcbHudFormula.classList.toggle('formula-valid', isValid && indices.length >= 2);
  el.mcbHudFormula.textContent = indices.length === 0 ? ' ' : `${values.join(' + ')} = ${sum}`;
}

// プレイヤー盤面には自分の選択（強い枠）とCPUの現在経路（色つきリング）の
// 両方を、CPU盤面にはCPU自身の選択だけを反映する（CPU盤面は正確な合計を
// 表示しない既存方針を踏襲）。
function updateMixedCpuHighlights() {
  const p1 = mcbSelection.p1;
  const p2Indices = mcbSelection.p2.indices;
  const p1Set = new Set(p1.indices);
  const p2Set = new Set(p2Indices);
  const p1ShowValid = p1.isValid && p1.indices.length >= 2;

  const playerTarget = mcbBoards.player;
  playerTarget.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', p1Set.has(i));
    cellEl.classList.toggle('selected-valid', p1Set.has(i) && p1ShowValid);
    cellEl.classList.toggle('opp-selected-p2', p2Set.has(i));
    const badge = cellEl.querySelector('.order-badge');
    if (badge) badge.remove();
  });
  p1.indices.forEach((cellIndex, order) => {
    const badge = document.createElement('span');
    badge.className = 'order-badge';
    badge.textContent = String(order + 1);
    playerTarget.cellEls[cellIndex].appendChild(badge);
  });

  const cpuTarget = mcbBoards.cpu;
  cpuTarget.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('selected', p2Set.has(i));
  });
}

export function updateMixedCpuPlayerSelection(detail) {
  mcbSelection.p1 = { indices: detail.indices, values: detail.values, sum: detail.sum, isValid: detail.isValid };
  updateMixedCpuHighlights();
  updateMixedCpuHudFormula(detail.indices, detail.values, detail.sum, detail.isValid);
}

export function updateMixedCpuCpuSelection(indices) {
  mcbSelection.p2 = { indices };
  updateMixedCpuHighlights();
}

function flashMixedCpuCells(actor, indices) {
  const target = actor === 'p2' ? mcbBoards.cpu : mcbBoards.player;
  indices.forEach((i) => {
    if (reduceMotion) return;
    const cellEl = target.cellEls[i];
    cellEl.classList.add('fail-shake');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('fail-shake'), { once: true });
  });
}

export function playMixedCpuFailEffect(actor, indices) {
  flashMixedCpuCells(actor, indices);
}

// 横取りされたときの中立フィードバックは、フローティング表示を持つ
// プレイヤー側でのみ表示する（CPU盤面にはfloating-layerがない）。
export function playMixedCpuStolenEffect(actor, indices) {
  if (actor !== 'p1') return;
  const target = mcbBoards.player;
  const lastIndex = indices[indices.length - 1];
  const cellEl = target.cellEls[lastIndex];
  const boardRect = target.boardEl.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const floatEl = document.createElement('div');
  floatEl.className = 'floating-score floating-stolen';
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = '<span class="floating-label">先に取られた！</span>';

  el.mcbFloatingLayer.appendChild(floatEl);
  const remove = () => floatEl.remove();
  floatEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1200);
}

export function playMixedCpuBlockedEffect(indices) {
  flashMixedCpuCells('p1', indices);
}

function showMixedCpuFloatingScore(detail) {
  const target = mcbBoards.player;
  const lastIndex = detail.indices[detail.indices.length - 1];
  const cellEl = target.cellEls[lastIndex];
  const boardRect = target.boardEl.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();

  const isSilver = !detail.isFever && detail.multiplier > 1;
  const label = buildFloatingLabel(detail);

  const floatEl = document.createElement('div');
  const classes = ['floating-score'];
  if (detail.isForty) classes.push('floating-forty');
  if (detail.isFever) classes.push('floating-fever');
  if (isSilver) classes.push('floating-silver');
  floatEl.className = classes.join(' ');
  floatEl.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  floatEl.style.top = `${cellRect.top - boardRect.top}px`;
  floatEl.innerHTML = `${label ? `<span class="floating-label">${label}</span>` : ''}<span>+${detail.points}</span>`;

  el.mcbFloatingLayer.appendChild(floatEl);
  const remove = () => floatEl.remove();
  floatEl.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1200);
}

// CPU側は既存のCPUバトル（battle.js）同様、フローティング得点表示を持たない。
export function playMixedCpuSuccessEffect(actor, detail) {
  if (actor === 'p1') showMixedCpuFloatingScore(detail);
}

export function clearMixedCpuCells(indices) {
  ['player', 'cpu'].forEach((who) => {
    const target = mcbBoards[who];
    indices.forEach((i) => target.cellEls[i].classList.add('clearing'));
  });
  setTimeout(() => {
    ['player', 'cpu'].forEach((who) => {
      const target = mcbBoards[who];
      indices.forEach((i) => {
        const cellEl = target.cellEls[i];
        cellEl.classList.remove('clearing');
        cellEl.classList.add('empty');
        cellEl.querySelector('.cell-value').textContent = '';
      });
    });
  }, 220);
}

export function refillMixedCpuCells(cells) {
  ['player', 'cpu'].forEach((who) => {
    const target = mcbBoards[who];
    cells.forEach(({ index, value }) => {
      const cellEl = target.cellEls[index];
      cellEl.classList.remove('empty');
      cellEl.querySelector('.cell-value').textContent = String(value);
      cellEl.classList.add('popping');
      cellEl.addEventListener('animationend', () => cellEl.classList.remove('popping'), { once: true });
    });
  });
  applyOjamaSmallToRefilledCells('mcb', cells);
}

// CPUは入れかえを行わないため、入れかえ選択の見た目はプレイヤー盤面だけに出す。
export function updateMixedCpuSwapSelection(index) {
  mcbBoards.player.cellEls.forEach((cellEl, i) => {
    cellEl.classList.toggle('swap-selected', i === index);
  });
}

export function applyMixedCpuSwap(indices, values) {
  ['player', 'cpu'].forEach((who) => {
    const target = mcbBoards[who];
    indices.forEach((index, i) => {
      const cellEl = target.cellEls[index];
      cellEl.classList.remove('swap-selected');
      cellEl.querySelector('.cell-value').textContent = String(values[i]);
      cellEl.classList.add('swapping');
      cellEl.addEventListener('animationend', () => cellEl.classList.remove('swapping'), { once: true });
    });
  });
}

export function updateMixedCpuTimer(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.mcbHudTime.textContent = String(seconds);
}

export function showMixedCpuCountdown(label) {
  el.mcbCountdownOverlay.hidden = false;
  el.mcbCountdownLabel.textContent = label;
  el.mcbCountdownLabel.classList.remove('countdown-pop');
  void el.mcbCountdownLabel.offsetWidth;
  el.mcbCountdownLabel.classList.add('countdown-pop');
  if (label === 'BATTLE!') {
    setTimeout(() => { el.mcbCountdownOverlay.hidden = true; }, 450);
  }
}

export function setMixedCpuFeverActive(active) {
  el.screenMixedCpuBattle.classList.toggle('fever', active);
}

export function setMixedCpuSilverFeverActive(actor, active) {
  el.screenMixedCpuBattle.classList.toggle(`${actor}-silver-fever`, active);
}

export function showMixedCpuTimeUp() {
  el.mcbTimeupOverlay.hidden = false;
}

export function hideMixedCpuTimeUp() {
  el.mcbTimeupOverlay.hidden = true;
  setMixedCpuFeverActive(false);
  setMixedCpuSilverFeverActive('p1', false);
  setMixedCpuSilverFeverActive('p2', false);
  clearOjamaEffect('mcb', 'p1');
  clearOjamaEffect('mcb', 'p2');
}

export function updateMixedCpuGauge(detail) {
  const pct = Math.max(0, Math.min(100, detail.p1Percent));
  el.mcbGaugePlayer.style.width = `${pct}%`;
}

export function renderMixedCpuBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats }) {
  el.mcbOutcome.textContent = OUTCOME_LABELS[outcome] || '';
  el.mcbOutcome.classList.remove('outcome-win', 'outcome-lose', 'outcome-draw');
  el.mcbOutcome.classList.add(`outcome-${outcome}`);

  el.mcbPlayerScore.textContent = String(playerScore);
  el.mcbCpuScore.textContent = String(cpuScore);
  el.mcbResultLevelLabel.textContent = CPU_LEVELS[level].label;

  setStatWithHighlight(el.mcbStatNormal, playerStats.normalScore, cpuStats.normalScore);
  setStatWithHighlight(el.mcbStatFever, playerStats.feverScore, cpuStats.feverScore);
  const playerRate = calcSuccessRate(playerStats);
  const cpuRate = calcSuccessRate(cpuStats);
  setStatWithHighlight(el.mcbStatRate, formatRate(playerRate), formatRate(cpuRate), playerRate, cpuRate);
  setStatWithHighlight(el.mcbStatSuccess, playerStats.successCount, cpuStats.successCount);
  setStatWithHighlight(el.mcbStat10, playerStats.sumCounts[10], cpuStats.sumCounts[10]);
  setStatWithHighlight(el.mcbStat20, playerStats.sumCounts[20], cpuStats.sumCounts[20]);
  setStatWithHighlight(el.mcbStat30, playerStats.sumCounts[30], cpuStats.sumCounts[30]);
  setStatWithHighlight(el.mcbStat40, playerStats.sumCounts[40], cpuStats.sumCounts[40]);
  setStatWithHighlight(el.mcbStatSilver, playerStats.silverFeverCount, cpuStats.silverFeverCount);
  setStatWithHighlight(el.mcbStatSwapDestroy, playerStats.swapCount + playerStats.destroyCount, cpuStats.swapCount + cpuStats.destroyCount);
  setStatWithHighlight(el.mcbStatCleared, playerStats.clearedCellCount, cpuStats.clearedCellCount);
}

// --- オジャマ（Phase5実装指示書16〜20章） -------------------------------------
// scope: 'tp'（スコアバトル）または'mb'（ごちゃまぜバトル）。両モードで同じ
// 見た目・処理を再利用する。

// スモール効果中に新しく補充された数字にも縮小率を割り当てる（仕様書18.3章）。
const ojamaSmallActive = {
  tp: { p1: false, p2: false },
  mb: { p1: false, p2: false },
  battle: { p1: false, p2: false },
  mcb: { p1: false, p2: false }
};

// battle・mcb（CPU戦の2形式）はp1=プレイヤー・p2=CPUとして扱う（既存の
// battleBoards/el.playerBoard・el.cpuBoardや、mcbBoards/el.mcbBoardPlayer・
// el.mcbBoardCpuをそのまま再利用する）。
function getBoardTarget(scope, actor) {
  if (scope === 'mb') return mixedBoards[actor];
  if (scope === 'battle') return actor === 'p2' ? battleBoards.cpu : battleBoards.player;
  if (scope === 'mcb') return actor === 'p2' ? mcbBoards.cpu : mcbBoards.player;
  return twoPlayerBoards[actor];
}

function getOjamaBoardEl(scope, actor) {
  if (scope === 'mb') return el.mbBoard[actor];
  if (scope === 'battle') return actor === 'p2' ? el.cpuBoard : el.playerBoard;
  if (scope === 'mcb') return actor === 'p2' ? el.mcbBoardCpu : el.mcbBoardPlayer;
  return el.tpBoard[actor];
}

function randomOjamaScale() {
  const { smallScaleMin, smallScaleMax } = OJAMA_SCALE_RANGE;
  return smallScaleMin + Math.random() * (smallScaleMax - smallScaleMin);
}

// config.jsの値をここで再宣言せず、main.js経由で一度だけ受け取る。
let OJAMA_SCALE_RANGE = { smallScaleMin: 0.35, smallScaleMax: 0.75 };
export function setOjamaScaleRange(range) {
  OJAMA_SCALE_RANGE = range;
}

function applyOjamaSmallToBoard(scope, actor) {
  const target = getBoardTarget(scope, actor);
  target.cellEls.forEach((cellEl) => {
    cellEl.style.setProperty('--ojama-scale', String(randomOjamaScale()));
  });
}

function applyOjamaSmallToRefilledCells(scope, cells) {
  ['p1', 'p2'].forEach((actor) => {
    if (!ojamaSmallActive[scope][actor]) return;
    const target = getBoardTarget(scope, actor);
    cells.forEach(({ index }) => {
      target.cellEls[index].style.setProperty('--ojama-scale', String(randomOjamaScale()));
    });
  });
}

function clearOjamaScale(scope, actor) {
  const target = getBoardTarget(scope, actor);
  target.cellEls.forEach((cellEl) => cellEl.style.removeProperty('--ojama-scale'));
}

export function startOjamaEffect(scope, actor, type) {
  const boardEl = getOjamaBoardEl(scope, actor);
  if (type === 'turn') {
    boardEl.classList.add('ojama-turn');
  } else if (type === 'small') {
    ojamaSmallActive[scope][actor] = true;
    boardEl.classList.add('ojama-small');
    applyOjamaSmallToBoard(scope, actor);
  } else if (type === 'hidden') {
    const overlay = el.ojamaOverlays[scope][actor];
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('ojama-hidden-anim');
      void overlay.offsetWidth;
      overlay.classList.add('ojama-hidden-anim');
    }
  } else if (type === 'meteor') {
    const overlay = el.ojamaMeteorOverlays[scope][actor];
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('ojama-meteor-anim');
      void overlay.offsetWidth;
      overlay.classList.add('ojama-meteor-anim');
    }
  } else if (type === 'formulaHide') {
    const row = el.hudFormulaRow[scope][actor];
    if (row) row.classList.add('ojama-formula-hide');
  }

  const typeEl = el.ojamaReceivedType[scope][actor];
  const labelEl = el.ojamaReceivedLabels[scope][actor];
  if (typeEl && labelEl) {
    typeEl.textContent = CONFIG.ojama.typeLabels[type] || '';
    labelEl.classList.add('is-active');
  }
}

export function clearOjamaEffect(scope, actor) {
  const boardEl = getOjamaBoardEl(scope, actor);
  boardEl.classList.remove('ojama-turn', 'ojama-small');
  ojamaSmallActive[scope][actor] = false;
  clearOjamaScale(scope, actor);
  const overlay = el.ojamaOverlays[scope][actor];
  if (overlay) {
    overlay.hidden = true;
    overlay.classList.remove('ojama-hidden-anim');
  }
  const meteorOverlay = el.ojamaMeteorOverlays[scope][actor];
  if (meteorOverlay) {
    meteorOverlay.hidden = true;
    meteorOverlay.classList.remove('ojama-meteor-anim');
  }
  const row = el.hudFormulaRow[scope][actor];
  if (row) row.classList.remove('ojama-formula-hide');
  const labelEl = el.ojamaReceivedLabels[scope][actor];
  if (labelEl) labelEl.classList.remove('is-active');
}
