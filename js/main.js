// 初期化、各モジュールの接続（仕様書 15.1章）。
import { CONFIG, getCpuBattleState } from './config.js';
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import { NazotenGame, STATUS } from './game.js';
import { BattleController, STATUS as BATTLE_STATUS } from './battle.js';
import { MixedCpuBattleController, STATUS as MCB_STATUS } from './mixed-cpu-battle.js';
import { TwoPlayerController, STATUS as TP_STATUS } from './two-player.js';
import { MixedBattleController, STATUS as MB_STATUS } from './mixed-battle.js';
import * as help from './help.js';
import { PuzzleController } from './puzzle.js';
import { PUZZLE_AREAS, PUZZLE_STAGES } from './puzzle-stages.js';
import { EasyScoreAttackController } from './easy-score-attack.js';
import { RandomPuzzleController } from './random-puzzle.js';
import { formatProblemId } from './puzzle-generator.js';

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

// タイトル・メニュー系画面（実際のゲームプレイ中の操作は専用の効果音を
// 個別に鳴らしているため対象外）でボタンを押したときに、軽く短い
// クリック音を鳴らす。
const MENU_CLICK_SOUND_SCREENS = new Set([
  'title', 'howto-menu', 'help-page', 'score-attack-select', 'easy-result',
  'result', 'cpu-select', 'battle-result', 'mixed-cpu-battle-result',
  'battle-format', 'mixed-battle-result', 'two-player-result',
  'puzzle-select', 'puzzle-generating', 'puzzle-clear'
]);

function playMenuClickSound(e) {
  const btn = e.target.closest('button, a.btn');
  if (!btn) return;
  const screen = btn.closest('.screen');
  if (!screen || !MENU_CLICK_SOUND_SCREENS.has(screen.dataset.screen)) return;
  audio.playButtonClick();
}

function main() {
  // 起動のたびに必ず「効果音のみ」から始める（前回の選択は引き継がない）。
  storage.setSoundMode('bgmOff');
  ui.init();
  audio.setSoundMode(storage.getSoundMode());
  preventDoubleTapZoom();
  document.addEventListener('click', playMenuClickSound);

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
    ui.updateBestScoreDisplays();
    ui.showScreen('score-attack-select');
  });

  document.getElementById('btn-score-attack-select-title').addEventListener('click', () => {
    ui.showScreen('title');
  });

  document.getElementById('btn-score-attack-standard-start').addEventListener('click', () => {
    startCountdownAndPlay();
  });

  help.init();

  document.getElementById('btn-howto').addEventListener('click', () => {
    ui.showScreen('howto-menu');
  });

  document.getElementById('btn-howto-menu-basic').addEventListener('click', (e) => {
    help.openSection('basic', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-easy').addEventListener('click', (e) => {
    help.openSection('easyScoreAttack', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-score').addEventListener('click', (e) => {
    help.openSection('scoreBattle', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-mixed').addEventListener('click', (e) => {
    help.openSection('mixedBattle', e.currentTarget);
  });

  document.getElementById('btn-howto-menu-puzzle').addEventListener('click', (e) => {
    help.openSection('puzzle', e.currentTarget);
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
    ui.initCpuCharacterHud('battle', e.detail.level);
  });
  battle.addEventListener('countdown', (e) => ui.showBattleCountdown(e.detail.label));
  battle.addEventListener('feverstart', () => {
    ui.setBattleFeverActive(true);
    ui.updateCpuCharacterHudScale('battle', 'even');
  });
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
  battle.addEventListener('gaugeupdate', (e) => {
    ui.updateBattleGauge(e.detail);
    const cpuRatio = (100 - e.detail.playerPercent) / 100;
    ui.updateCpuCharacterHudScale('battle', getCpuBattleState(cpuRatio, !e.detail.visible));
  });
  battle.addEventListener('timeup', () => ui.showBattleTimeUp());
  battle.addEventListener('result', (e) => {
    const { outcome, level, playerScore, cpuScore, playerStats, cpuStats } = e.detail;
    const isNewBest = storage.submitCpuBattleResult({ level, outcome, playerScore, cpuScore });
    ui.renderBattleResult({ outcome, level, playerScore, cpuScore, playerStats, cpuStats, isNewBest });
    ui.renderCpuResultReaction('battle', { level, playerScore, cpuScore });
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

  // CPU戦のバトル形式（スコアバトル/ごちゃまぜバトル）・オジャマON/OFF。
  // 2人バトル側のselectedBattleFormat/ojamaEnabledとは独立した状態として持つ
  // （仕様：CPU戦にも同様の選択画面を用意するが、選択内容は別枠）。
  let selectedCpuBattleFormat = 'score';
  let cpuOjamaEnabled = CONFIG.ojama.defaultEnabled;

  // 敵キャラクターカードの通算成績は、選択中の対戦形式に対応する勝利数を
  // 表示する（CPU戦キャラクター演出実装指示書 5.1章）。
  function getCpuLevelWinsForSelectedFormat(level) {
    return selectedCpuBattleFormat === 'mixed'
      ? storage.getMixedCpuRecord(level).wins
      : storage.getCpuRecord(level).wins;
  }

  function refreshCpuLevelRecordDisplay() {
    const level = storage.getSelectedCpuLevel();
    ui.updateCpuLevelRecord({ wins: getCpuLevelWinsForSelectedFormat(level) });
  }

  function showCpuSelectScreen() {
    const level = storage.getSelectedCpuLevel();
    ui.updateCpuLevelSelection(level);
    refreshCpuLevelRecordDisplay();
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
    refreshCpuLevelRecordDisplay();
  });

  document.querySelectorAll('#screen-cpu-select .battle-format-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedCpuBattleFormat = btn.dataset.format;
      ui.updateCpuBattleFormatSelection(selectedCpuBattleFormat);
      refreshCpuLevelRecordDisplay();
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
    ui.initCpuCharacterHud('mcb', e.detail.level);
  });
  mixedCpuBattle.addEventListener('countdown', (e) => ui.showMixedCpuCountdown(e.detail.label));
  mixedCpuBattle.addEventListener('feverstart', () => {
    ui.setMixedCpuFeverActive(true);
    ui.updateCpuCharacterHudScale('mcb', 'even');
  });
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
  mixedCpuBattle.addEventListener('gaugeupdate', (e) => {
    ui.updateMixedCpuGauge(e.detail);
    const cpuRatio = (100 - e.detail.p1Percent) / 100;
    ui.updateCpuCharacterHudScale('mcb', getCpuBattleState(cpuRatio, !e.detail.visible));
  });
  mixedCpuBattle.addEventListener('timeup', () => ui.showMixedCpuTimeUp());
  mixedCpuBattle.addEventListener('result', (e) => {
    const { outcome, level, playerScore, cpuScore, playerStats, cpuStats, ojamaTotalUses } = e.detail;
    ui.renderCpuResultReaction('mcb', { level, playerScore, cpuScore });
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

  // --- じっくりモード（Phase 6実装指示書） -----------------------------------
  const puzzle = new PuzzleController(ui.getPuzzleBoardElement());
  const randomPuzzle = new RandomPuzzleController();
  let currentPuzzleAreaIndex = 0;

  function isPuzzleStageCleared(stageId) {
    return storage.getPuzzleStageRecord(stageId).cleared;
  }

  function isPuzzleStageUnlocked(stageId) {
    const idx = PUZZLE_STAGES.findIndex((s) => s.id === stageId);
    if (idx <= 0) return true;
    return isPuzzleStageCleared(PUZZLE_STAGES[idx - 1].id);
  }

  function areaIndexForStageId(stageId) {
    const stage = PUZZLE_STAGES.find((s) => s.id === stageId);
    const idx = stage ? PUZZLE_AREAS.findIndex((a) => a.id === stage.areaId) : 0;
    return idx < 0 ? 0 : idx;
  }

  function computePuzzleContinueStageId() {
    const lastId = storage.getPuzzleLastStageId();
    if (isPuzzleStageUnlocked(lastId)) return lastId;
    const firstUncleared = PUZZLE_STAGES.find((s) => !isPuzzleStageCleared(s.id) && isPuzzleStageUnlocked(s.id));
    if (firstUncleared) return firstUncleared.id;
    return PUZZLE_STAGES[PUZZLE_STAGES.length - 1].id;
  }

  function renderCurrentPuzzleArea() {
    const area = PUZZLE_AREAS[currentPuzzleAreaIndex];
    const lastStageId = storage.getPuzzleLastStageId();
    const stagesInArea = PUZZLE_STAGES.filter((s) => s.areaId === area.id);
    const stageViewModels = stagesInArea.map((stage) => {
      const record = storage.getPuzzleStageRecord(stage.id);
      return {
        id: stage.id,
        stageNumber: stage.stageNumber,
        rows: stage.rows,
        cols: stage.cols,
        locked: !isPuzzleStageUnlocked(stage.id),
        bestStars: record.bestStars,
        isCurrent: stage.id === lastStageId
      };
    });
    const areaStars = stagesInArea.reduce((sum, s) => sum + storage.getPuzzleStageRecord(s.id).bestStars, 0);
    const randomLocked = !storage.isRandomAreaUnlocked(area.id);
    ui.renderPuzzleStageSelect({
      area,
      stageViewModels,
      areaStars,
      areaStarsMax: stagesInArea.length * 3,
      randomViewModel: {
        areaId: area.id,
        locked: randomLocked,
        clearCount: storage.getRandomAreaRecord(area.id).clearCount
      }
    });
  }

  function startPuzzleStageFlow(stageId) {
    storage.setPuzzleLastStageId(stageId);
    puzzle.startStage(stageId);
    ui.showScreen('puzzle');
  }

  function requestStartPuzzleStage(stageId) {
    if (!storage.hasSeenPuzzleTutorial()) {
      help.openSection('puzzle', null, () => {
        storage.markPuzzleTutorialSeen();
        startPuzzleStageFlow(stageId);
      });
      return;
    }
    startPuzzleStageFlow(stageId);
  }

  // --- じっくり ランダム生成問題（Phase 6ランダム生成問題実装指示書） ---------
  function requestStartRandomPuzzle(areaId) {
    currentPuzzleAreaIndex = Math.max(0, PUZZLE_AREAS.findIndex((a) => a.id === areaId));
    ui.showPuzzleGeneratingLoading();
    ui.showScreen('puzzle-generating');
    randomPuzzle.requestGenerate(areaId);
  }

  randomPuzzle.addEventListener('generated', () => {
    randomPuzzle.startGeneratedPuzzle(puzzle);
    ui.showScreen('puzzle');
  });

  randomPuzzle.addEventListener('generatefailed', () => {
    ui.showPuzzleGeneratingError();
  });

  function leavePuzzleToSelect() {
    // ランダム問題のステージIDはPUZZLE_STAGESに含まれないため、areaIdは
    // puzzle.stage.areaId（固定・ランダムどちらも実在のエリアIDを持つ）から
    // 直接求める。クリアせず離れる場合は連勝を切る（23.3章）。
    if (puzzle.stage) {
      if (puzzle.stage.isRandom) randomPuzzle.abandonCurrentAttempt();
      currentPuzzleAreaIndex = Math.max(0, PUZZLE_AREAS.findIndex((a) => a.id === puzzle.stage.areaId));
    } else {
      currentPuzzleAreaIndex = areaIndexForStageId(storage.getPuzzleLastStageId());
    }
    puzzle.leaveStage();
    renderCurrentPuzzleArea();
    ui.showScreen('puzzle-select');
  }

  function syncPuzzleBoardUi() {
    ui.renderPuzzleBoard(puzzle.stage, puzzle.state.cells);
    ui.updatePuzzleMoves(puzzle.stage, {
      movesUsed: puzzle.state.movesUsed,
      swapsUsed: puzzle.state.swapsUsed,
      sequenceIndex: puzzle.state.sequenceIndex
    });
    ui.setPuzzleUndoEnabled(puzzle.history.length > 0);
    ui.setPuzzleHintEnabled(!puzzle.hintButtonUsed);
    ui.updatePuzzleFormula([], [], 0);
    ui.hidePuzzleBlocked();
    ui.hidePuzzleStuck();
    ui.clearPuzzleSwapSelect();
  }

  puzzle.addEventListener('boardinit', (e) => {
    const { stage, cells } = e.detail;
    const area = PUZZLE_AREAS.find((a) => a.id === stage.areaId);
    ui.renderPuzzleBoard(stage, cells);
    ui.renderPuzzleStageLabel(area, stage);
    ui.renderPuzzleMission(stage, 0);
    ui.updatePuzzleFormula([], [], 0);
    ui.setPuzzleUndoEnabled(false);
    ui.setPuzzleHintEnabled(true);
    ui.hideAllPuzzleOverlays();
    ui.updatePuzzleMoves(stage, { movesUsed: 0, swapsUsed: 0, sequenceIndex: 0 });
    if (stage.allowSwap && !storage.hasSeenPuzzleSwapTutorial()) {
      ui.showPuzzleSwapTutorial();
    }
    if (stage.isRandom) {
      ui.showPuzzleRandomInfo({ difficulty: stage.difficulty, problemId: formatProblemId(stage) });
    } else {
      ui.hidePuzzleRandomInfo();
    }
  });

  puzzle.addEventListener('selectionupdate', (e) => {
    const indices = e.detail.indices;
    const values = indices.map((i) => puzzle.state.cells[i]);
    const sum = values.reduce((a, b) => a + b, 0);
    ui.updatePuzzleSelection(indices);
    ui.updatePuzzleFormula(indices, values, sum);
  });

  puzzle.addEventListener('cellsclear', (e) => {
    ui.clearPuzzleCells(e.detail.indices);
    ui.updatePuzzleFormula([], [], 0);
    if (e.detail.sum === 40) audio.playForty(e.detail.indices.length);
    else audio.playSuccess(e.detail.indices.length);
  });

  puzzle.addEventListener('fail', (e) => {
    ui.flashPuzzleFail(e.detail.cells);
    audio.playFail();
  });

  puzzle.addEventListener('swapselect', (e) => {
    ui.updatePuzzleSwapSelect(e.detail.index);
    audio.playSwapSelect();
  });
  puzzle.addEventListener('swapcancel', () => ui.clearPuzzleSwapSelect());
  puzzle.addEventListener('swap', (e) => {
    ui.applyPuzzleSwapVisual(e.detail.a, e.detail.b, e.detail.values);
    audio.playSwap();
  });
  puzzle.addEventListener('swapblocked', () => audio.playBlocked());

  puzzle.addEventListener('movesupdate', () => {
    ui.updatePuzzleMoves(puzzle.stage, {
      movesUsed: puzzle.state.movesUsed,
      swapsUsed: puzzle.state.swapsUsed,
      sequenceIndex: puzzle.state.sequenceIndex
    });
    ui.setPuzzleUndoEnabled(puzzle.history.length > 0);
  });

  puzzle.addEventListener('blocked', () => ui.showPuzzleBlocked());
  puzzle.addEventListener('undo', syncPuzzleBoardUi);
  puzzle.addEventListener('restart', syncPuzzleBoardUi);

  puzzle.addEventListener('hintthinking', () => ui.setPuzzleHintMessage('ヒントを考え中…'));
  puzzle.addEventListener('hintfound', (e) => {
    ui.setPuzzleHintMessage('');
    ui.showPuzzleHintHighlight(e.detail.action);
    ui.setPuzzleHintEnabled(false);
    audio.playPuzzleHint();
  });
  puzzle.addEventListener('hintend', () => ui.clearPuzzleHintHighlight());
  puzzle.addEventListener('hintstuck', () => {
    ui.setPuzzleHintMessage('');
    ui.showPuzzleStuck();
  });

  puzzle.addEventListener('cleared', (e) => {
    const { stageId, stars, movesUsed, parMoves, hintUsed } = e.detail;

    if (puzzle.stage.isRandom) {
      const area = PUZZLE_AREAS.find((a) => a.id === puzzle.stage.areaId);
      const { isPerfect, currentClearStreak } = randomPuzzle.recordClear({ movesUsed, parMoves, hintUsed });
      audio.playPuzzleStageClear();
      ui.hidePuzzleRandomUnlockBanner();
      ui.renderPuzzleRandomClear({
        areaName: area.name,
        difficulty: puzzle.stage.difficulty,
        movesUsed,
        parMoves,
        hintUsed,
        isPerfect,
        currentClearStreak,
        problemId: formatProblemId(puzzle.stage)
      });
      ui.showScreen('puzzle-clear');
      return;
    }

    const { isNewBestStars, isNewBestMoves } = storage.submitPuzzleStageClear({ stageId, stars, movesUsed, hintUsed });
    const idx = PUZZLE_STAGES.findIndex((s) => s.id === stageId);
    const stage = PUZZLE_STAGES[idx];
    const isLastStage = idx === PUZZLE_STAGES.length - 1;
    const isLastOfArea = stage.stageNumber === CONFIG.puzzle.stagesPerArea;
    if (isLastStage) audio.playPuzzleAllClear();
    else if (isLastOfArea) audio.playPuzzleAreaClear();
    else audio.playPuzzleStageClear();
    ui.renderPuzzleClear({
      stars,
      movesUsed,
      parMoves,
      hintUsed,
      isLastStage,
      isNewBest: isNewBestStars || isNewBestMoves
    });
    // Stage 6クリアで、そのエリアのランダム問題が初めて解放された場合は、
    // 解放演出をクリア画面に重ねて1回だけ表示する（4.2章）。
    if (isLastOfArea && !storage.hasSeenRandomUnlock(stage.areaId)) {
      storage.markRandomUnlockSeen(stage.areaId);
      ui.showPuzzleRandomUnlockBanner();
    } else {
      ui.hidePuzzleRandomUnlockBanner();
    }
    ui.showScreen('puzzle-clear');
  });

  document.getElementById('btn-puzzle').addEventListener('click', () => {
    audio.startPuzzleBgm();
    currentPuzzleAreaIndex = areaIndexForStageId(storage.getPuzzleLastStageId());
    renderCurrentPuzzleArea();
    ui.showScreen('puzzle-select');
  });

  document.getElementById('btn-puzzle-select-title').addEventListener('click', () => {
    audio.stopPuzzleBgm();
    ui.showScreen('title');
  });

  document.getElementById('btn-puzzle-area-prev').addEventListener('click', () => {
    currentPuzzleAreaIndex = (currentPuzzleAreaIndex - 1 + PUZZLE_AREAS.length) % PUZZLE_AREAS.length;
    renderCurrentPuzzleArea();
  });
  document.getElementById('btn-puzzle-area-next').addEventListener('click', () => {
    currentPuzzleAreaIndex = (currentPuzzleAreaIndex + 1) % PUZZLE_AREAS.length;
    renderCurrentPuzzleArea();
  });

  ui.getPuzzleStageGridElement().addEventListener('click', (e) => {
    const card = e.target.closest('.puzzle-stage-card');
    if (!card || card.disabled) return;
    if (card.dataset.randomArea) {
      requestStartRandomPuzzle(card.dataset.randomArea);
      return;
    }
    requestStartPuzzleStage(card.dataset.stageId);
  });

  document.getElementById('btn-puzzle-generating-cancel').addEventListener('click', () => {
    randomPuzzle.cancelGeneration();
    renderCurrentPuzzleArea();
    ui.showScreen('puzzle-select');
  });
  document.getElementById('btn-puzzle-generating-select').addEventListener('click', () => {
    randomPuzzle.cancelGeneration();
    renderCurrentPuzzleArea();
    ui.showScreen('puzzle-select');
  });
  document.getElementById('btn-puzzle-generating-retry').addEventListener('click', () => {
    ui.showPuzzleGeneratingLoading();
    randomPuzzle.requestGenerate(randomPuzzle.currentAreaId);
  });

  document.getElementById('btn-puzzle-continue').addEventListener('click', () => {
    requestStartPuzzleStage(computePuzzleContinueStageId());
  });

  document.getElementById('btn-puzzle-back').addEventListener('click', () => {
    if (puzzle.state && puzzle.state.movesUsed > 0) {
      ui.showPuzzleLeaveConfirm();
      return;
    }
    leavePuzzleToSelect();
  });
  document.getElementById('btn-puzzle-leave-yes').addEventListener('click', () => {
    ui.hidePuzzleLeaveConfirm();
    leavePuzzleToSelect();
  });
  document.getElementById('btn-puzzle-leave-no').addEventListener('click', () => ui.hidePuzzleLeaveConfirm());

  document.getElementById('btn-puzzle-undo').addEventListener('click', () => {
    if (puzzle.undo()) audio.playPuzzleUndo();
  });
  document.getElementById('btn-puzzle-hint').addEventListener('click', () => puzzle.requestHint());
  document.getElementById('btn-puzzle-restart').addEventListener('click', () => puzzle.restart());

  document.getElementById('btn-puzzle-blocked-undo').addEventListener('click', () => {
    ui.hidePuzzleBlocked();
    puzzle.undo();
  });
  document.getElementById('btn-puzzle-blocked-restart').addEventListener('click', () => {
    ui.hidePuzzleBlocked();
    puzzle.restart();
  });
  document.getElementById('btn-puzzle-blocked-select').addEventListener('click', () => {
    ui.hidePuzzleBlocked();
    leavePuzzleToSelect();
  });

  document.getElementById('btn-puzzle-stuck-undo').addEventListener('click', () => {
    ui.hidePuzzleStuck();
    puzzle.undo();
  });
  document.getElementById('btn-puzzle-stuck-restart').addEventListener('click', () => {
    ui.hidePuzzleStuck();
    puzzle.restart();
  });
  document.getElementById('btn-puzzle-stuck-close').addEventListener('click', () => ui.hidePuzzleStuck());

  document.getElementById('btn-puzzle-swap-tutorial-ok').addEventListener('click', () => {
    storage.markPuzzleSwapTutorialSeen();
    ui.hidePuzzleSwapTutorial();
  });

  document.getElementById('btn-puzzle-clear-next').addEventListener('click', () => {
    const idx = PUZZLE_STAGES.findIndex((s) => s.id === puzzle.stage.id);
    const next = PUZZLE_STAGES[idx + 1];
    if (next) {
      requestStartPuzzleStage(next.id);
    } else {
      currentPuzzleAreaIndex = areaIndexForStageId(puzzle.stage.id);
      renderCurrentPuzzleArea();
      ui.showScreen('puzzle-select');
    }
  });
  document.getElementById('btn-puzzle-clear-retry').addEventListener('click', () => {
    requestStartPuzzleStage(puzzle.stage.id);
  });
  document.getElementById('btn-puzzle-clear-select').addEventListener('click', () => {
    currentPuzzleAreaIndex = areaIndexForStageId(puzzle.stage.id);
    renderCurrentPuzzleArea();
    ui.showScreen('puzzle-select');
  });
  document.getElementById('btn-puzzle-clear-title').addEventListener('click', () => {
    audio.stopPuzzleBgm();
    ui.showScreen('title');
  });

  document.getElementById('btn-puzzle-clear-random-next').addEventListener('click', () => {
    ui.showPuzzleGeneratingLoading();
    ui.showScreen('puzzle-generating');
    randomPuzzle.generateNextPuzzle();
  });
  document.getElementById('btn-puzzle-clear-random-retry').addEventListener('click', () => {
    randomPuzzle.retrySamePuzzle(puzzle);
    ui.showScreen('puzzle');
  });
  document.getElementById('btn-puzzle-clear-random-select').addEventListener('click', () => {
    currentPuzzleAreaIndex = Math.max(0, PUZZLE_AREAS.findIndex((a) => a.id === puzzle.stage.areaId));
    renderCurrentPuzzleArea();
    ui.showScreen('puzzle-select');
  });
  document.getElementById('btn-puzzle-clear-random-title').addEventListener('click', () => {
    audio.stopPuzzleBgm();
    ui.showScreen('title');
  });

  // --- おてがるスコアアタック（おてがるモード実装指示書） ---------------------
  const easy = new EasyScoreAttackController(ui.getEasyBoardElement());

  function startEasyGameFlow() {
    ui.showScreen('easy');
    easy.startNewGame();
  }

  function requestStartEasyGame() {
    if (!storage.hasSeenEasyScoreAttackTutorial()) {
      help.openSection('easyScoreAttack', null, () => {
        storage.markEasyScoreAttackTutorialSeen();
        startEasyGameFlow();
      });
      return;
    }
    startEasyGameFlow();
  }

  document.getElementById('btn-score-attack-easy-start').addEventListener('click', () => {
    requestStartEasyGame();
  });

  function renderEasyQuestionDisplay(detail) {
    ui.renderEasyBoard(detail.values);
    ui.renderEasyQuestion(detail.questionNumber, detail.pattern);
    ui.updateEasyFormula([], 0);
    ui.updateEasySwapSelection(null);
  }

  easy.addEventListener('boardinit', (e) => {
    ui.hideEasyTimeUp();
    ui.updateEasyTimer(CONFIG.easyScoreAttack.durationMs);
    ui.updateEasyScore(0);
    renderEasyQuestionDisplay(e.detail);
  });
  easy.addEventListener('questionchange', (e) => renderEasyQuestionDisplay(e.detail));
  easy.addEventListener('countdown', (e) => ui.showEasyCountdown(e.detail.label));
  easy.addEventListener('timeupdate', (e) => ui.updateEasyTimer(e.detail.remainingMs));
  easy.addEventListener('scoreupdate', (e) => ui.updateEasyScore(e.detail.score));
  easy.addEventListener('selectionupdate', (e) => {
    ui.updateEasySelection(e.detail.indices);
    ui.updateEasyFormula(e.detail.values, e.detail.sum);
  });
  easy.addEventListener('fail', (e) => {
    ui.flashEasyFail(e.detail.indices);
    audio.playFail();
  });
  easy.addEventListener('success', () => ui.shrinkEasyBoard());
  easy.addEventListener('pass', () => ui.shrinkEasyBoard());
  easy.addEventListener('swapselectionupdate', (e) => ui.updateEasySwapSelection(e.detail.index));
  easy.addEventListener('swap', (e) => ui.applyEasySwap(e.detail.indices, e.detail.values));
  easy.addEventListener('timeup', () => ui.showEasyTimeUp());
  easy.addEventListener('result', (e) => {
    const { score, stats } = e.detail;
    const isNewBest = storage.submitEasyScoreAttackResult({
      score,
      correctCount: stats.correctCount,
      passCount: stats.passCount,
      patternCorrectCounts: stats.patternCorrectCounts
    });
    ui.updateBestScoreDisplays();
    ui.renderEasyResult({ score, stats, isNewBest, bestScore: storage.getEasyScoreAttackRecord().bestScore });
    ui.showScreen('easy-result');
  });

  document.getElementById('btn-easy-back').addEventListener('click', () => {
    easy.leave();
    ui.updateBestScoreDisplays();
    ui.showScreen('score-attack-select');
  });

  document.getElementById('btn-easy-retry').addEventListener('click', () => {
    startEasyGameFlow();
  });

  document.getElementById('btn-easy-retry-result').addEventListener('click', () => {
    startEasyGameFlow();
  });

  document.getElementById('btn-easy-result-select').addEventListener('click', () => {
    ui.updateBestScoreDisplays();
    ui.showScreen('score-attack-select');
  });

  document.getElementById('btn-easy-result-title').addEventListener('click', () => {
    ui.updateBestScoreDisplays();
    ui.showScreen('title');
  });

  ui.updateBestScoreDisplays();
  ui.showScreen('title');
}

document.addEventListener('DOMContentLoaded', main);
