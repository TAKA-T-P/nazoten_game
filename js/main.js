// 初期化、各モジュールの接続（仕様書 15.1章）。
import { CONFIG } from './config.js';
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import { NazotenGame, STATUS } from './game.js';
import { BattleController, STATUS as BATTLE_STATUS } from './battle.js';

function initAudioOnce() {
  audio.init();
  audio.resume();
  audio.setSoundMode(storage.getSoundMode());
  window.removeEventListener('pointerdown', initAudioOnce);
  window.removeEventListener('keydown', initAudioOnce);
}

function main() {
  ui.init();
  audio.setSoundMode(storage.getSoundMode());

  // 最初のユーザー操作でAudioContextを開始する（モバイルの自動再生制限対策）。
  window.addEventListener('pointerdown', initAudioOnce, { once: true });
  window.addEventListener('keydown', initAudioOnce, { once: true });

  const boardEl = ui.getBoardElement();
  const game = new NazotenGame(boardEl);

  game.addEventListener('statechange', (e) => {
    if (e.detail.status === STATUS.PLAYING) ui.hideTimeUp();
  });
  game.addEventListener('boardinit', (e) => {
    // 新しいプレイの開始時に前回の TIME UP! / フィーバー演出を確実に消しておく。
    // これをしないと、リトライ直後のカウントダウン中も前回のオーバーレイが
    // 盤面を覆ったままになり、3・2・1が見えなくなる。
    ui.hideTimeUp();
    ui.updateTimer(CONFIG.gameDurationMs);
    ui.renderBoard(e.detail.board);
  });
  game.addEventListener('countdown', (e) => ui.showCountdown(e.detail.label));
  game.addEventListener('feverstart', () => {
    ui.setFeverActive(true);
    ui.showFeverStart();
  });
  game.addEventListener('timeupdate', (e) => ui.updateTimer(e.detail.remainingMs));
  game.addEventListener('scoreupdate', (e) => ui.updateScore(e.detail.score));
  game.addEventListener('selectionupdate', (e) => ui.updateSelection(e.detail));
  game.addEventListener('success', (e) => ui.playSuccessEffect(e.detail));
  game.addEventListener('fail', (e) => ui.playFailEffect(e.detail.indices));
  game.addEventListener('cellsclear', (e) => ui.clearCells(e.detail.indices));
  game.addEventListener('cellsrefill', (e) => ui.refillCells(e.detail.cells));
  game.addEventListener('swapselectionupdate', (e) => ui.updateSwapSelection(e.detail.index));
  game.addEventListener('swap', (e) => ui.applySwap(e.detail.indices, e.detail.values));
  game.addEventListener('timeup', () => ui.showTimeUp());
  game.addEventListener('result', (e) => {
    const isNewBest = storage.submitScore(e.detail.score);
    ui.updateBestScoreDisplays();
    ui.renderResult({ score: e.detail.score, stats: e.detail.stats, isNewBest });
    ui.showScreen('result');
  });

  function startCountdownAndPlay() {
    ui.showScreen('game');
    game.startNewGame();
  }

  document.getElementById('btn-start').addEventListener('click', () => {
    if (storage.hasSeenCurrentTutorial()) {
      startCountdownAndPlay();
    } else {
      ui.showScreen('howto');
    }
  });

  document.getElementById('btn-howto').addEventListener('click', () => {
    ui.showScreen('howto');
  });

  document.getElementById('btn-howto-start').addEventListener('click', () => {
    storage.markTutorialSeen();
    startCountdownAndPlay();
  });

  document.getElementById('btn-howto-back').addEventListener('click', () => {
    ui.showScreen('title');
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    startCountdownAndPlay();
  });

  document.getElementById('btn-result-title').addEventListener('click', () => {
    game.backToTitle();
    ui.updateBestScoreDisplays();
    ui.showScreen('title');
  });

  document.getElementById('btn-back-title').addEventListener('click', () => {
    game.backToTitle();
    ui.updateBestScoreDisplays();
    ui.showScreen('title');
  });

  document.getElementById('btn-retry-game').addEventListener('click', () => {
    startCountdownAndPlay();
  });

  document.getElementById('btn-sound-mode').addEventListener('click', () => {
    const next = storage.cycleSoundMode();
    audio.setSoundMode(next);
    ui.refreshSoundModeButton();
  });

  // --- CPUバトル（Phase3実装指示書） ---------------------------------------
  const playerBoardEl = ui.getPlayerBoardElement();
  const battle = new BattleController(playerBoardEl);

  battle.addEventListener('statechange', (e) => {
    if (e.detail.status === BATTLE_STATUS.PLAYING) ui.hideBattleTimeUp();
  });
  battle.addEventListener('boardinit', (e) => {
    ui.hideBattleTimeUp();
    ui.updateBattleTimer(CONFIG.gameDurationMs);
    ui.renderBattleBoards(e.detail.playerBoard, e.detail.cpuBoard);
    ui.updateBattleCpuLevelLabel(e.detail.level);
  });
  battle.addEventListener('countdown', (e) => ui.showBattleCountdown(e.detail.label));
  battle.addEventListener('feverstart', () => ui.setBattleFeverActive(true));
  battle.addEventListener('timeupdate', (e) => ui.updateBattleTimer(e.detail.remainingMs));
  battle.addEventListener('playerselectionupdate', (e) => ui.updatePlayerBattleSelection(e.detail));
  battle.addEventListener('playersuccess', (e) => ui.clearSuccessSelectionMarks('player', e.detail.indices));
  battle.addEventListener('playerfail', (e) => ui.playBattleFailEffect('player', e.detail.indices));
  battle.addEventListener('playercellsclear', (e) => ui.clearBattleCells('player', e.detail.indices));
  battle.addEventListener('playercellsrefill', (e) => ui.refillBattleCells('player', e.detail.cells));
  battle.addEventListener('playerswapselectionupdate', (e) => ui.updatePlayerSwapSelection(e.detail.index));
  battle.addEventListener('playerswap', (e) => ui.applyPlayerSwap(e.detail.indices, e.detail.values));
  battle.addEventListener('cpuselectionupdate', (e) => ui.updateCpuSelection(e.detail.indices));
  battle.addEventListener('cpufail', (e) => ui.playBattleFailEffect('cpu', e.detail.indices));
  battle.addEventListener('cpucellsclear', (e) => ui.clearBattleCells('cpu', e.detail.indices));
  battle.addEventListener('cpucellsrefill', (e) => ui.refillBattleCells('cpu', e.detail.cells));
  battle.addEventListener('gaugeupdate', (e) => ui.updateBattleGauge(e.detail));
  battle.addEventListener('timeup', () => ui.showBattleTimeUp());
  battle.addEventListener('result', (e) => {
    const { outcome, level, playerScore, cpuScore, playerStats, cpuStats } = e.detail;
    const isNewBest = storage.submitCpuBattleResult({ level, outcome, playerScore, cpuScore });
    const record = storage.getCpuRecord(level);
    ui.renderBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats, isNewBest, record });
    ui.showScreen('battle-result');
  });

  function startBattleCountdown(level) {
    ui.showScreen('battle');
    battle.startBattle(level);
  }

  function showCpuSelectScreen() {
    const level = storage.getSelectedCpuLevel();
    ui.updateCpuLevelSelection(level);
    ui.updateCpuLevelRecord(storage.getCpuRecord(level));
    ui.showScreen('cpu-select');
  }

  document.getElementById('btn-cpu-battle').addEventListener('click', () => {
    if (storage.hasSeenCpuBattleTutorial()) {
      showCpuSelectScreen();
    } else {
      ui.showScreen('cpu-howto');
    }
  });

  document.getElementById('btn-cpu-howto-start').addEventListener('click', () => {
    storage.markCpuBattleTutorialSeen();
    showCpuSelectScreen();
  });

  document.getElementById('btn-cpu-howto-back').addEventListener('click', () => {
    ui.showScreen('title');
  });

  document.querySelectorAll('.cpu-level-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = btn.dataset.level;
      storage.setSelectedCpuLevel(level);
      ui.updateCpuLevelSelection(level);
      ui.updateCpuLevelRecord(storage.getCpuRecord(level));
    });
  });

  document.getElementById('btn-cpu-start').addEventListener('click', () => {
    startBattleCountdown(storage.getSelectedCpuLevel());
  });

  document.getElementById('btn-cpu-select-back').addEventListener('click', () => {
    ui.showScreen('title');
  });

  document.getElementById('btn-cpu-rules').addEventListener('click', () => {
    ui.showScreen('cpu-howto');
  });

  document.getElementById('btn-battle-back').addEventListener('click', () => {
    battle.backToTitle();
    ui.showScreen('title');
  });

  document.getElementById('btn-battle-retry').addEventListener('click', () => {
    startBattleCountdown(battle.level);
  });

  document.getElementById('btn-battle-rematch').addEventListener('click', () => {
    startBattleCountdown(battle.level);
  });

  document.getElementById('btn-battle-change-level').addEventListener('click', () => {
    battle.backToTitle();
    showCpuSelectScreen();
  });

  document.getElementById('btn-battle-result-title').addEventListener('click', () => {
    battle.backToTitle();
    ui.showScreen('title');
  });

  ui.updateBestScoreDisplays();
  ui.showScreen('title');
}

document.addEventListener('DOMContentLoaded', main);
