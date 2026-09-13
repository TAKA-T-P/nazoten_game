// 初期化、各モジュールの接続（仕様書 15.1章）。
import * as storage from './storage.js';
import * as audio from './audio.js';
import * as ui from './ui.js';
import { NazotenGame, STATUS } from './game.js';

function initAudioOnce() {
  audio.init();
  audio.resume();
  audio.setEnabled(storage.isSoundEnabled());
  window.removeEventListener('pointerdown', initAudioOnce);
  window.removeEventListener('keydown', initAudioOnce);
}

function main() {
  ui.init();
  audio.setEnabled(storage.isSoundEnabled());

  // 最初のユーザー操作でAudioContextを開始する（モバイルの自動再生制限対策）。
  window.addEventListener('pointerdown', initAudioOnce, { once: true });
  window.addEventListener('keydown', initAudioOnce, { once: true });

  const boardEl = ui.getBoardElement();
  const game = new NazotenGame(boardEl);

  game.addEventListener('statechange', (e) => {
    if (e.detail.status === STATUS.PLAYING) ui.hideTimeUp();
  });
  game.addEventListener('boardinit', (e) => ui.renderBoard(e.detail.board));
  game.addEventListener('countdown', (e) => ui.showCountdown(e.detail.label));
  game.addEventListener('timeupdate', (e) => ui.updateTimer(e.detail.remainingMs));
  game.addEventListener('scoreupdate', (e) => ui.updateScore(e.detail.score));
  game.addEventListener('selectionupdate', (e) => ui.updateSelection(e.detail));
  game.addEventListener('success', (e) => ui.playSuccessEffect(e.detail));
  game.addEventListener('fail', (e) => ui.playFailEffect(e.detail.indices));
  game.addEventListener('cellsclear', (e) => ui.clearCells(e.detail.indices));
  game.addEventListener('cellsrefill', (e) => ui.refillCells(e.detail.cells));
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
    if (storage.hasTutorialSeen()) {
      startCountdownAndPlay();
    } else {
      ui.showScreen('howto');
    }
  });

  document.getElementById('btn-howto').addEventListener('click', () => {
    ui.showScreen('howto');
  });

  document.getElementById('btn-howto-start').addEventListener('click', () => {
    storage.setTutorialSeen(true);
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

  function toggleSound() {
    const next = !storage.isSoundEnabled();
    storage.setSoundEnabled(next);
    audio.setEnabled(next);
    ui.refreshSoundButtons();
  }
  document.getElementById('btn-sound-title').addEventListener('click', toggleSound);
  document.getElementById('btn-sound-game').addEventListener('click', toggleSound);

  ui.updateBestScoreDisplays();
  ui.showScreen('title');
}

document.addEventListener('DOMContentLoaded', main);
