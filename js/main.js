// 初期化、各モジュールの接続（仕様書 15.1章）。
import { CONFIG } from './config.js';
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import { NazotenGame, STATUS } from './game.js';
import { BattleController, STATUS as BATTLE_STATUS } from './battle.js';
import { MixedCpuBattleController, STATUS as MCB_STATUS } from './mixed-cpu-battle.js';
import { TwoPlayerController, STATUS as TP_STATUS } from './two-player.js';
import { MixedBattleController, STATUS as MB_STATUS } from './mixed-battle.js';
import * as help from './help.js';

function initAudioOnce() {
  audio.init();
  audio.resume();
  audio.setSoundMode(storage.getSoundMode());
  window.removeEventListener('pointerdown', initAudioOnce);
  window.removeEventListener('keydown', initAudioOnce);
}

// ダブルタップズームの防止。body/各画面のtouch-actionだけでは、盤面が密集する
// 2人対戦画面などで連続タップ操作（破壊操作など）を行った際に、ごくまれに
// ブラウザ側のダブルタップズームが働いてしまう端末がある。最後のtouchendから
// 一定時間内に次のtouchendが来た場合はブラウザ標準のズーム処理を確実に止める
// （この判定はゲーム側の入力処理とは独立しており、なぞり・破壊操作は影響を
// 受けない）。
function preventDoubleTapZoom() {
  let lastTouchEndAt = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEndAt <= 350) {
      e.preventDefault();
    }
    lastTouchEndAt = now;
  }, { passive: false });
}

function main() {
  // 起動のたびに必ず「効果音のみ」から始める（前回の選択は引き継がない）。
  storage.setSoundMode('bgmOff');
  ui.init();
  audio.setSoundMode(storage.getSoundMode());
  preventDoubleTapZoom();

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
  game.addEventListener('silverfeverstart', () => ui.setSilverFeverActive(true));
  game.addEventListener('silverfeverend', () => ui.setSilverFeverActive(false));
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
    startCountdownAndPlay();
  });

  help.init();

  document.getElementById('btn-howto').addEventListener('click', () => {
    ui.showScreen('howto-menu');
  });

  document.getElementById('btn-howto-menu-basic').addEventListener('click', (e) => {
    help.openSection('basic', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-score').addEventListener('click', (e) => {
    help.openSection('scoreBattle', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-mixed').addEventListener('click', (e) => {
    help.openSection('mixedBattle', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-back').addEventListener('click', () => {
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

  document.getElementById('btn-sound-prev').addEventListener('click', () => {
    const next = storage.stepSoundMode(-1);
    audio.setSoundMode(next);
    ui.refreshSoundModeButton();
  });

  document.getElementById('btn-sound-next').addEventListener('click', () => {
    const next = storage.stepSoundMode(1);
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
  battle.addEventListener('playersilverfeverstart', () => ui.setBattlePlayerSilverFeverActive(true));
  battle.addEventListener('playersilverfeverend', () => ui.setBattlePlayerSilverFeverActive(false));
  battle.addEventListener('cpusilverfeverstart', () => ui.setBattleCpuSilverFeverActive(true));
  battle.addEventListener('cpusilverfeverend', () => ui.setBattleCpuSilverFeverActive(false));
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
    ui.renderBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats, isNewBest });
    ui.showScreen('battle-result');
  });

  // 二重再生を避けるため、オジャマの警告音・解除音はeffectstart/effectendの
  // イベントを受けたmain.js側だけで鳴らす（two-player.js/mixed-battle.jsと同じ方針）。
  battle.ojama.addEventListener('effectstart', () => audio.playOjamaWarning());
  battle.ojama.addEventListener('effectend', () => audio.playOjamaEnd());
  battle.ojama.addEventListener('effectstart', (e) => ui.startOjamaEffect('battle', e.detail.targetActor, e.detail.type));
  battle.ojama.addEventListener('effectend', (e) => ui.clearOjamaEffect('battle', e.detail.targetActor));

  function startBattleCountdown(level) {
    ui.showScreen('battle');
    battle.startBattle(level, cpuOjamaEnabled);
  }

  function showCpuSelectScreen() {
    const level = storage.getSelectedCpuLevel();
    ui.updateCpuLevelSelection(level);
    ui.updateCpuLevelRecord(storage.getCpuRecord(level));
    ui.updateCpuBattleFormatSelection(selectedCpuBattleFormat);
    ui.updateCpuBattleOjamaToggle(cpuOjamaEnabled);
    ui.showScreen('cpu-select');
  }

  document.getElementById('btn-cpu-battle').addEventListener('click', () => {
    showCpuSelectScreen();
  });

  document.getElementById('cpu-level-slider').addEventListener('input', () => {
    const level = ui.getCpuLevelFromSliderValue();
    storage.setSelectedCpuLevel(level);
    ui.updateCpuLevelSelection(level);
    ui.updateCpuLevelRecord(storage.getCpuRecord(level));
  });

  // CPU戦のバトル形式（スコアバトル/ごちゃまぜバトル）・オジャマON/OFF。
  // 2人バトル側のselectedBattleFormat/ojamaEnabledとは独立した状態として持つ
  // （仕様：CPU戦にも同様の選択画面を用意するが、選択内容は別枠）。
  let selectedCpuBattleFormat = 'score';
  let cpuOjamaEnabled = CONFIG.ojama.defaultEnabled;

  document.querySelectorAll('#screen-cpu-select .battle-format-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCpuBattleFormat = btn.dataset.format;
      ui.updateCpuBattleFormatSelection(selectedCpuBattleFormat);
    });
  });

  document.getElementById('btn-cpu-ojama-toggle').addEventListener('click', () => {
    cpuOjamaEnabled = !cpuOjamaEnabled;
    ui.updateCpuBattleOjamaToggle(cpuOjamaEnabled);
  });

  document.getElementById('btn-cpu-start').addEventListener('click', () => {
    const level = storage.getSelectedCpuLevel();
    if (selectedCpuBattleFormat === 'mixed') {
      startMixedCpuBattleCountdown(level);
    } else {
      startBattleCountdown(level);
    }
  });

  document.getElementById('btn-cpu-select-back').addEventListener('click', () => {
    ui.showScreen('title');
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

  // --- ごちゃまぜバトルCPU戦 ---------------------------------------------------
  const mcbBoardEls = ui.getMixedCpuBattleBoardElements();
  const mixedCpuBattle = new MixedCpuBattleController(mcbBoardEls.player, mcbBoardEls.cpu);

  mixedCpuBattle.addEventListener('statechange', (e) => {
    if (e.detail.status === MCB_STATUS.PLAYING) ui.hideMixedCpuTimeUp();
  });
  mixedCpuBattle.addEventListener('boardinit', (e) => {
    ui.hideMixedCpuTimeUp();
    ui.updateMixedCpuTimer(CONFIG.gameDurationMs);
    ui.renderMixedCpuBattleBoards(e.detail.board);
    ui.updateMixedCpuCpuLevelLabel(e.detail.level);
  });
  mixedCpuBattle.addEventListener('countdown', (e) => ui.showMixedCpuCountdown(e.detail.label));
  mixedCpuBattle.addEventListener('feverstart', () => ui.setMixedCpuFeverActive(true));
  mixedCpuBattle.addEventListener('p1silverfeverstart', () => ui.setMixedCpuSilverFeverActive('p1', true));
  mixedCpuBattle.addEventListener('p1silverfeverend', () => ui.setMixedCpuSilverFeverActive('p1', false));
  mixedCpuBattle.addEventListener('p2silverfeverstart', () => ui.setMixedCpuSilverFeverActive('p2', true));
  mixedCpuBattle.addEventListener('p2silverfeverend', () => ui.setMixedCpuSilverFeverActive('p2', false));
  mixedCpuBattle.addEventListener('timeupdate', (e) => ui.updateMixedCpuTimer(e.detail.remainingMs));
  mixedCpuBattle.addEventListener('p1selectionupdate', (e) => ui.updateMixedCpuPlayerSelection(e.detail));
  mixedCpuBattle.addEventListener('p2selectionupdate', (e) => ui.updateMixedCpuCpuSelection(e.detail.indices));
  mixedCpuBattle.addEventListener('p1success', (e) => ui.playMixedCpuSuccessEffect('p1', e.detail));
  mixedCpuBattle.addEventListener('p2success', () => {});
  mixedCpuBattle.addEventListener('p1fail', (e) => ui.playMixedCpuFailEffect('p1', e.detail.indices));
  mixedCpuBattle.addEventListener('p2fail', (e) => ui.playMixedCpuFailEffect('p2', e.detail.indices));
  mixedCpuBattle.addEventListener('p1stolen', (e) => ui.playMixedCpuStolenEffect('p1', e.detail.indices));
  mixedCpuBattle.addEventListener('p2stolen', () => {});
  mixedCpuBattle.addEventListener('p1destroyblocked', (e) => ui.playMixedCpuBlockedEffect([e.detail.index]));
  mixedCpuBattle.addEventListener('p1swapblocked', (e) => ui.playMixedCpuBlockedEffect(e.detail.indices));
  mixedCpuBattle.addEventListener('sharedcellsclear', (e) => ui.clearMixedCpuCells(e.detail.indices));
  mixedCpuBattle.addEventListener('sharedcellsrefill', (e) => ui.refillMixedCpuCells(e.detail.cells));
  mixedCpuBattle.addEventListener('p1swapselectionupdate', (e) => ui.updateMixedCpuSwapSelection(e.detail.index));
  mixedCpuBattle.addEventListener('sharedswap', (e) => ui.applyMixedCpuSwap(e.detail.indices, e.detail.values));
  mixedCpuBattle.addEventListener('gaugeupdate', (e) => ui.updateMixedCpuGauge(e.detail));
  mixedCpuBattle.addEventListener('timeup', () => ui.showMixedCpuTimeUp());
  mixedCpuBattle.addEventListener('result', (e) => {
    const { outcome, level, playerScore, cpuScore, playerStats, cpuStats, ojamaTotalUses } = e.detail;
    storage.submitMixedCpuBattleResult({
      level,
      outcome,
      playerScore,
      cpuScore,
      ojamaUseCount: ojamaTotalUses
    });
    ui.renderMixedCpuBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats });
    ui.showScreen('mixed-cpu-battle-result');
  });

  mixedCpuBattle.ojama.addEventListener('effectstart', () => audio.playOjamaWarning());
  mixedCpuBattle.ojama.addEventListener('effectend', () => audio.playOjamaEnd());
  mixedCpuBattle.ojama.addEventListener('effectstart', (e) => ui.startOjamaEffect('mcb', e.detail.targetActor, e.detail.type));
  mixedCpuBattle.ojama.addEventListener('effectend', (e) => ui.clearOjamaEffect('mcb', e.detail.targetActor));

  function startMixedCpuBattleCountdown(level) {
    ui.showScreen('mixed-cpu-battle');
    mixedCpuBattle.start(level, cpuOjamaEnabled);
  }

  function backToTitleFromMixedCpuBattle() {
    mixedCpuBattle.backToTitle();
    ui.showScreen('title');
  }

  document.getElementById('btn-mcb-back').addEventListener('click', backToTitleFromMixedCpuBattle);

  document.getElementById('btn-mcb-retry').addEventListener('click', () => {
    startMixedCpuBattleCountdown(mixedCpuBattle.level);
  });

  document.getElementById('btn-mcb-rematch').addEventListener('click', () => {
    startMixedCpuBattleCountdown(mixedCpuBattle.level);
  });

  document.getElementById('btn-mcb-change-level').addEventListener('click', () => {
    mixedCpuBattle.backToTitle();
    showCpuSelectScreen();
  });

  document.getElementById('btn-mcb-result-title').addEventListener('click', () => {
    mixedCpuBattle.backToTitle();
    ui.showScreen('title');
  });

  // --- 2人バトル（Phase4実装指示書） ---------------------------------------
  const tpBoardEls = ui.getTwoPlayerBoardElements();
  const twoPlayer = new TwoPlayerController(tpBoardEls.p1, tpBoardEls.p2);

  twoPlayer.addEventListener('statechange', (e) => {
    if (e.detail.status === TP_STATUS.PLAYING) ui.hideTwoPlayerTimeUp();
  });
  twoPlayer.addEventListener('boardinit', (e) => {
    ui.hideTwoPlayerTimeUp();
    ui.updateTwoPlayerTimer(CONFIG.gameDurationMs);
    ui.renderTwoPlayerBoards(e.detail.p1Board, e.detail.p2Board);
  });
  twoPlayer.addEventListener('countdown', (e) => ui.showTwoPlayerCountdown(e.detail.label));
  twoPlayer.addEventListener('feverstart', () => ui.setTwoPlayerFeverActive(true));
  twoPlayer.addEventListener('p1silverfeverstart', () => ui.setTwoPlayerSilverFeverActive('p1', true));
  twoPlayer.addEventListener('p1silverfeverend', () => ui.setTwoPlayerSilverFeverActive('p1', false));
  twoPlayer.addEventListener('p2silverfeverstart', () => ui.setTwoPlayerSilverFeverActive('p2', true));
  twoPlayer.addEventListener('p2silverfeverend', () => ui.setTwoPlayerSilverFeverActive('p2', false));
  twoPlayer.addEventListener('timeupdate', (e) => ui.updateTwoPlayerTimer(e.detail.remainingMs));
  twoPlayer.addEventListener('p1selectionupdate', (e) => ui.updateTwoPlayerSelection('p1', e.detail));
  twoPlayer.addEventListener('p2selectionupdate', (e) => ui.updateTwoPlayerSelection('p2', e.detail));
  twoPlayer.addEventListener('p1success', (e) => ui.playTwoPlayerSuccessEffect('p1', e.detail));
  twoPlayer.addEventListener('p2success', (e) => ui.playTwoPlayerSuccessEffect('p2', e.detail));
  twoPlayer.addEventListener('p1fail', (e) => ui.playTwoPlayerFailEffect('p1', e.detail.indices));
  twoPlayer.addEventListener('p2fail', (e) => ui.playTwoPlayerFailEffect('p2', e.detail.indices));
  twoPlayer.addEventListener('p1cellsclear', (e) => ui.clearTwoPlayerCells('p1', e.detail.indices));
  twoPlayer.addEventListener('p2cellsclear', (e) => ui.clearTwoPlayerCells('p2', e.detail.indices));
  twoPlayer.addEventListener('p1cellsrefill', (e) => ui.refillTwoPlayerCells('p1', e.detail.cells));
  twoPlayer.addEventListener('p2cellsrefill', (e) => ui.refillTwoPlayerCells('p2', e.detail.cells));
  twoPlayer.addEventListener('p1swapselectionupdate', (e) => ui.updateTwoPlayerSwapSelection('p1', e.detail.index));
  twoPlayer.addEventListener('p2swapselectionupdate', (e) => ui.updateTwoPlayerSwapSelection('p2', e.detail.index));
  twoPlayer.addEventListener('p1swap', (e) => ui.applyTwoPlayerSwap('p1', e.detail.indices, e.detail.values));
  twoPlayer.addEventListener('p2swap', (e) => ui.applyTwoPlayerSwap('p2', e.detail.indices, e.detail.values));
  twoPlayer.addEventListener('gaugeupdate', (e) => ui.updateTwoPlayerGauge(e.detail));
  twoPlayer.addEventListener('timeup', () => ui.showTwoPlayerTimeUp());
  twoPlayer.addEventListener('result', (e) => {
    const { outcome, p1Score, p2Score, p1Stats, p2Stats } = e.detail;
    storage.submitTwoPlayerBattleResult({ outcome, p1Score, p2Score });
    ui.renderTwoPlayerResult({ outcome, p1Score, p2Score, p1Stats, p2Stats });
    ui.showScreen('two-player-result');
  });

  function startTwoPlayerCountdown() {
    ui.showScreen('two-player');
    twoPlayer.start(ojamaEnabled);
  }

  // 二重再生を避けるため、オジャマの警告音・解除音はeffectstart/effectendの
  // イベントを受けたmain.js側だけで鳴らす。
  twoPlayer.ojama.addEventListener('effectstart', (e) => audio.playOjamaWarning());
  twoPlayer.ojama.addEventListener('effectend', () => audio.playOjamaEnd());
  twoPlayer.ojama.addEventListener('effectstart', (e) => ui.startOjamaEffect('tp', e.detail.targetActor, e.detail.type));
  twoPlayer.ojama.addEventListener('effectend', (e) => ui.clearOjamaEffect('tp', e.detail.targetActor));

  document.getElementById('btn-two-player').addEventListener('click', () => {
    ui.updateFormatSelection(selectedBattleFormat);
    ui.updateOjamaToggle(ojamaEnabled);
    ui.showScreen('battle-format');
  });

  function backToTitleFromTwoPlayer() {
    ui.hideTwoPlayerPause();
    twoPlayer.backToTitle();
    ui.showScreen('title');
  }

  // 「もどる」→「ポーズ」化（Phase6）。押すと即座にタイトルへは戻らず、
  // 一時停止して確認ダイアログを表示する。
  function pauseTwoPlayer() {
    if (twoPlayer.pause()) ui.showTwoPlayerPause();
  }

  function resumeTwoPlayer() {
    twoPlayer.resume();
    ui.hideTwoPlayerPause();
  }

  document.getElementById('btn-tp-back-p1').addEventListener('click', pauseTwoPlayer);
  document.getElementById('btn-tp-back-p2').addEventListener('click', pauseTwoPlayer);
  document.getElementById('btn-tp-pause-yes-p1').addEventListener('click', backToTitleFromTwoPlayer);
  document.getElementById('btn-tp-pause-yes-p2').addEventListener('click', backToTitleFromTwoPlayer);
  document.getElementById('btn-tp-pause-no-p1').addEventListener('click', resumeTwoPlayer);
  document.getElementById('btn-tp-pause-no-p2').addEventListener('click', resumeTwoPlayer);

  document.getElementById('btn-tp-rematch').addEventListener('click', () => {
    startTwoPlayerCountdown();
  });

  document.getElementById('btn-tp-result-title').addEventListener('click', () => {
    twoPlayer.backToTitle();
    ui.showScreen('title');
  });

  // --- 対戦形式選択・オジャマ設定（Phase5実装指示書4章） -----------------------
  // 形式・オジャマ設定はページ内メモリだけで保持し、再読み込みでは引き継がない
  // （仕様書4.3章：ページ再読み込み時はONへ戻す。形式もデフォルトのスコアバトルに戻る）。
  let selectedBattleFormat = 'score';
  let ojamaEnabled = CONFIG.ojama.defaultEnabled;
  ui.setOjamaScaleRange({ smallScaleMin: CONFIG.ojama.smallScaleMin, smallScaleMax: CONFIG.ojama.smallScaleMax });

  document.querySelectorAll('.battle-format-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedBattleFormat = btn.dataset.format;
      ui.updateFormatSelection(selectedBattleFormat);
    });
  });

  document.getElementById('btn-ojama-toggle').addEventListener('click', () => {
    ojamaEnabled = !ojamaEnabled;
    ui.updateOjamaToggle(ojamaEnabled);
  });

  document.getElementById('btn-battle-format-back').addEventListener('click', () => {
    ui.showScreen('title');
  });

  document.getElementById('btn-battle-format-start').addEventListener('click', () => {
    if (selectedBattleFormat === 'mixed') {
      startMixedBattleCountdown();
    } else {
      startTwoPlayerCountdown();
    }
  });

  // --- ごちゃまぜバトル（Phase5実装指示書5〜14章） ------------------------------
  const mbBoardEls = ui.getMixedBattleBoardElements();
  const mixedBattle = new MixedBattleController(mbBoardEls.p1, mbBoardEls.p2);

  mixedBattle.addEventListener('statechange', (e) => {
    if (e.detail.status === MB_STATUS.PLAYING) ui.hideMixedTimeUp();
  });
  mixedBattle.addEventListener('boardinit', (e) => {
    ui.hideMixedTimeUp();
    ui.updateMixedTimer(CONFIG.gameDurationMs);
    ui.renderMixedBattleBoards(e.detail.board);
  });
  mixedBattle.addEventListener('countdown', (e) => ui.showMixedCountdown(e.detail.label));
  mixedBattle.addEventListener('feverstart', () => ui.setMixedFeverActive(true));
  mixedBattle.addEventListener('p1silverfeverstart', () => ui.setMixedSilverFeverActive('p1', true));
  mixedBattle.addEventListener('p1silverfeverend', () => ui.setMixedSilverFeverActive('p1', false));
  mixedBattle.addEventListener('p2silverfeverstart', () => ui.setMixedSilverFeverActive('p2', true));
  mixedBattle.addEventListener('p2silverfeverend', () => ui.setMixedSilverFeverActive('p2', false));
  mixedBattle.addEventListener('timeupdate', (e) => ui.updateMixedTimer(e.detail.remainingMs));
  mixedBattle.addEventListener('p1selectionupdate', (e) => ui.updateMixedSelection('p1', e.detail));
  mixedBattle.addEventListener('p2selectionupdate', (e) => ui.updateMixedSelection('p2', e.detail));
  mixedBattle.addEventListener('p1success', (e) => ui.playMixedSuccessEffect('p1', e.detail));
  mixedBattle.addEventListener('p2success', (e) => ui.playMixedSuccessEffect('p2', e.detail));
  mixedBattle.addEventListener('p1fail', (e) => ui.playMixedFailEffect('p1', e.detail.indices));
  mixedBattle.addEventListener('p2fail', (e) => ui.playMixedFailEffect('p2', e.detail.indices));
  mixedBattle.addEventListener('p1stolen', (e) => ui.playMixedStolenEffect('p1', e.detail.indices));
  mixedBattle.addEventListener('p2stolen', (e) => ui.playMixedStolenEffect('p2', e.detail.indices));
  mixedBattle.addEventListener('p1destroyblocked', (e) => ui.playMixedBlockedEffect('p1', [e.detail.index]));
  mixedBattle.addEventListener('p2destroyblocked', (e) => ui.playMixedBlockedEffect('p2', [e.detail.index]));
  mixedBattle.addEventListener('p1swapblocked', (e) => ui.playMixedBlockedEffect('p1', e.detail.indices));
  mixedBattle.addEventListener('p2swapblocked', (e) => ui.playMixedBlockedEffect('p2', e.detail.indices));
  mixedBattle.addEventListener('sharedcellsclear', (e) => ui.clearMixedCells(e.detail.indices));
  mixedBattle.addEventListener('sharedcellsrefill', (e) => ui.refillMixedCells(e.detail.cells));
  mixedBattle.addEventListener('p1swapselectionupdate', (e) => ui.updateMixedSwapSelection('p1', e.detail.index));
  mixedBattle.addEventListener('p2swapselectionupdate', (e) => ui.updateMixedSwapSelection('p2', e.detail.index));
  mixedBattle.addEventListener('sharedswap', (e) => ui.applyMixedSwap(e.detail.indices, e.detail.values));
  mixedBattle.addEventListener('gaugeupdate', (e) => ui.updateMixedGauge(e.detail));
  mixedBattle.addEventListener('timeup', () => ui.showMixedTimeUp());
  mixedBattle.addEventListener('result', (e) => {
    const { outcome, p1Score, p2Score, p1Stats, p2Stats, ojamaTotalUses } = e.detail;
    storage.submitMixedBattleResult({ outcome, p1Score, p2Score, ojamaUseCount: ojamaTotalUses });
    ui.renderMixedBattleResult({ outcome, p1Score, p2Score, p1Stats, p2Stats });
    ui.showScreen('mixed-battle-result');
  });

  mixedBattle.ojama.addEventListener('effectstart', () => audio.playOjamaWarning());
  mixedBattle.ojama.addEventListener('effectend', () => audio.playOjamaEnd());
  mixedBattle.ojama.addEventListener('effectstart', (e) => ui.startOjamaEffect('mb', e.detail.targetActor, e.detail.type));
  mixedBattle.ojama.addEventListener('effectend', (e) => ui.clearOjamaEffect('mb', e.detail.targetActor));

  function startMixedBattleCountdown() {
    ui.showScreen('mixed-battle');
    mixedBattle.start(ojamaEnabled);
  }

  function backToTitleFromMixedBattle() {
    ui.hideMixedPause();
    mixedBattle.backToTitle();
    ui.showScreen('title');
  }

  function pauseMixedBattle() {
    if (mixedBattle.pause()) ui.showMixedPause();
  }

  function resumeMixedBattle() {
    mixedBattle.resume();
    ui.hideMixedPause();
  }

  document.getElementById('btn-mb-back-p1').addEventListener('click', pauseMixedBattle);
  document.getElementById('btn-mb-back-p2').addEventListener('click', pauseMixedBattle);
  document.getElementById('btn-mb-pause-yes-p1').addEventListener('click', backToTitleFromMixedBattle);
  document.getElementById('btn-mb-pause-yes-p2').addEventListener('click', backToTitleFromMixedBattle);
  document.getElementById('btn-mb-pause-no-p1').addEventListener('click', resumeMixedBattle);
  document.getElementById('btn-mb-pause-no-p2').addEventListener('click', resumeMixedBattle);

  document.getElementById('btn-mb-rematch').addEventListener('click', () => {
    startMixedBattleCountdown();
  });

  document.getElementById('btn-mb-result-title').addEventListener('click', () => {
    mixedBattle.backToTitle();
    ui.showScreen('title');
  });

  ui.updateBestScoreDisplays();
  ui.showScreen('title');
}

document.addEventListener('DOMContentLoaded', main);
