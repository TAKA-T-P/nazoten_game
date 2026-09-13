// ゲーム開始・終了、タイマー、状態遷移（仕様書 7章・14.1章・17章）。
// DOMは直接操作せず、CustomEventでUI層に通知する。
import { CONFIG } from './config.js';
import { Board } from './board.js';
import { SelectionController } from './input.js';
import { calcSum, isValidSum, calcPoints, createStats, applySuccess } from './scoring.js';
import * as audio from './audio.js';

export const STATUS = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ENDING: 'ending',
  RESULT: 'result'
};

export class NazotenGame extends EventTarget {
  constructor(boardEl, rng = Math.random) {
    super();
    this.boardEl = boardEl;
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.board = null;
    this.score = 0;
    this.stats = createStats();
    this.remainingMs = CONFIG.gameDurationMs;
    this.endsAt = null;
    this.rafId = null;
    this.refillTimers = new Set();
    this.countdownTimers = [];
    this.lastLowSecond = null;
    this.selectionController = null;

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  destroy() {
    this._clearAllTimers();
    if (this.selectionController) this.selectionController.destroy();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  _setStatus(status) {
    this.status = status;
    this.dispatchEvent(new CustomEvent('statechange', { detail: { status } }));
  }

  _clearAllTimers() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    for (const id of this.countdownTimers) clearTimeout(id);
    this.countdownTimers = [];
    for (const id of this.refillTimers) clearTimeout(id);
    this.refillTimers.clear();
  }

  startNewGame() {
    this._clearAllTimers();
    if (this.selectionController) this.selectionController.destroy();

    this.board = new Board(this.rng);
    this.score = 0;
    this.stats = createStats();
    this.remainingMs = CONFIG.gameDurationMs;
    this.lastLowSecond = null;

    this.selectionController = new SelectionController(this.boardEl, {
      isSelectable: (i) => this.status === STATUS.PLAYING && this.board.isSelectable(i),
      areAdjacent: (a, b) => Board.areAdjacent(a, b),
      maxLength: CONFIG.maxPathLength,
      onSelectionStart: (i, sel) => {
        audio.playTraceNote(0);
        this._emitSelectionUpdate(sel);
      },
      onCellAdded: (i, sel) => {
        audio.playTraceNote(sel.length - 1);
        this._emitSelectionUpdate(sel);
      },
      onCellRemoved: (sel) => this._emitSelectionUpdate(sel),
      onSelectionEnd: (sel) => this._finishSelection(sel),
      onSelectionCancel: () => this._emitSelectionUpdate([])
    });

    this._setStatus(STATUS.IDLE);
    this.dispatchEvent(new CustomEvent('boardinit', { detail: { board: this.board } }));
    this.dispatchEvent(new CustomEvent('scoreupdate', { detail: { score: this.score } }));
    this._runCountdown();
  }

  backToTitle() {
    this._clearAllTimers();
    if (this.selectionController) {
      this.selectionController.destroy();
      this.selectionController = null;
    }
    this._setStatus(STATUS.IDLE);
  }

  _emitSelectionUpdate(selection) {
    const sel = selection || [];
    const values = sel.map((i) => this.board.getValue(i));
    const sum = calcSum(values);
    this.dispatchEvent(new CustomEvent('selectionupdate', {
      detail: { indices: sel, values, sum, isValid: isValidSum(sum) }
    }));
  }

  // 3・2・1・START!を表示し、START!と同時にプレイを開始する（仕様書 7.1章）。
  _runCountdown() {
    this._setStatus(STATUS.COUNTDOWN);
    const labels = ['3', '2', '1', 'START!'];
    labels.forEach((label, i) => {
      const delay = i * CONFIG.countdownStepMs;
      const id = setTimeout(() => {
        if (label === 'START!') {
          audio.playCountdownStart();
        } else {
          audio.playCountdownTick();
        }
        this.dispatchEvent(new CustomEvent('countdown', { detail: { label } }));
        if (label === 'START!') this._beginPlaying();
      }, delay);
      this.countdownTimers.push(id);
    });
  }

  _beginPlaying() {
    this.countdownTimers = [];
    this.startedAt = performance.now();
    this.endsAt = this.startedAt + CONFIG.gameDurationMs;
    this._setStatus(STATUS.PLAYING);
    this._loop();
  }

  // performance.now()基準の単調増加時刻で残り時間を管理する（仕様書 7.2章）。
  _loop() {
    const now = performance.now();
    this.remainingMs = Math.max(0, this.endsAt - now);
    this.dispatchEvent(new CustomEvent('timeupdate', { detail: { remainingMs: this.remainingMs } }));

    const remainingSeconds = Math.ceil(this.remainingMs / 1000);
    if (this.remainingMs > 0 && remainingSeconds <= CONFIG.lowTimeThresholdSec && remainingSeconds !== this.lastLowSecond) {
      this.lastLowSecond = remainingSeconds;
      audio.playLowTimeTick();
    }

    if (this.remainingMs <= 0) {
      this._timeUp();
      return;
    }
    this.rafId = requestAnimationFrame(() => this._loop());
  }

  // バックグラウンド復帰時に実時間を元に残り時間を再計算する（仕様書 18章）。
  _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this.status === STATUS.PLAYING) {
      const now = performance.now();
      this.remainingMs = Math.max(0, this.endsAt - now);
      if (this.remainingMs <= 0) this._timeUp();
    }
  }

  _finishSelection(indices) {
    if (this.status !== STATUS.PLAYING) return;

    if (indices.length < 2) {
      this._emitSelectionUpdate([]);
      return;
    }

    const values = indices.map((i) => this.board.getValue(i));
    const sum = calcSum(values);

    if (isValidSum(sum)) {
      const points = calcPoints(sum, indices.length);
      const isForty = sum === 40;
      this.score += points;
      applySuccess(this.stats, sum, indices.length, points);

      this.dispatchEvent(new CustomEvent('success', { detail: { indices, sum, points, isForty } }));
      this.dispatchEvent(new CustomEvent('scoreupdate', { detail: { score: this.score } }));
      if (isForty) {
        audio.playForty(indices.length);
      } else {
        audio.playSuccess(indices.length);
      }

      const refills = this.board.clear(indices);
      this.dispatchEvent(new CustomEvent('cellsclear', { detail: { indices } }));

      const timerId = setTimeout(() => {
        this.refillTimers.delete(timerId);
        const applied = refills.map(({ index }) => ({ index, value: this.board.refill(index) }));
        this.dispatchEvent(new CustomEvent('cellsrefill', { detail: { cells: applied } }));
      }, CONFIG.refillDelayMs);
      this.refillTimers.add(timerId);
    } else {
      this.dispatchEvent(new CustomEvent('fail', { detail: { indices } }));
      audio.playFail();
    }

    this._emitSelectionUpdate([]);
  }

  _timeUp() {
    this._setStatus(STATUS.ENDING);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.selectionController) this.selectionController.forceCancel();
    for (const id of this.refillTimers) clearTimeout(id);
    this.refillTimers.clear();

    this.remainingMs = 0;
    this.dispatchEvent(new CustomEvent('timeupdate', { detail: { remainingMs: 0 } }));
    this.dispatchEvent(new CustomEvent('timeup', {}));
    audio.playTimeUp();

    const id = setTimeout(() => this._showResult(), 900);
    this.countdownTimers.push(id);
  }

  _showResult() {
    this._setStatus(STATUS.RESULT);
    audio.playResult();
    this.dispatchEvent(new CustomEvent('result', {
      detail: { score: this.score, stats: this.stats }
    }));
  }
}
