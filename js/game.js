// ゲーム開始・終了、タイマー、状態遷移（仕様書 7章・14.1章・17章、Phase2実装指示書 3〜5章）。
// DOMは直接操作せず、CustomEventでUI層に通知する。
import { CONFIG, BGM_DELAY_TRIGGER_MS } from './config.js';
import { Board } from './board.js';
import { SelectionController } from './input.js';
import { calcSum, isValidSum, calculateScore, createStats, applySuccess, recordFailure } from './scoring.js';
import * as audio from './audio.js';

export const STATUS = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ENDING: 'ending',
  RESULT: 'result'
};

// 対戦モードへの流用を見据え、status: 'playing' はそのままに phase で
// 通常タイム／ミリオン・フィーバーを切り替える（Phase2実装指示書 3.3章）。
export const PHASE = {
  NORMAL: 'normal',
  FEVER: 'fever'
};

export class NazotenGame extends EventTarget {
  constructor(boardEl, rng = Math.random) {
    super();
    this.boardEl = boardEl;
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.board = null;
    this.score = 0;
    this.stats = createStats();
    this.remainingMs = CONFIG.gameDurationMs;
    this.endsAt = null;
    this.rafId = null;
    this.refillTimers = new Set();
    this.countdownTimers = [];
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
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
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.remainingMs = CONFIG.gameDurationMs;
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
    audio.chooseRandomBgmTrack(this.rng);

    this.selectionController = new SelectionController(this.boardEl, {
      isSelectable: (i) => this.status === STATUS.PLAYING && this.board.isSelectable(i),
      areAdjacent: (a, b) => Board.areAdjacent(a, b),
      maxLength: CONFIG.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
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
      onSelectionCancel: () => this._emitSelectionUpdate([]),
      onDoubleTap: (index) => this._destroyCell(index)
    });

    this._setStatus(STATUS.IDLE);
    this.dispatchEvent(new CustomEvent('boardinit', { detail: { board: this.board } }));
    this.dispatchEvent(new CustomEvent('scoreupdate', { detail: { score: this.score } }));
    this._runCountdown();
  }

  backToTitle() {
    this._clearAllTimers();
    audio.stopBgm();
    if (this.selectionController) {
      this.selectionController.destroy();
      this.selectionController = null;
    }
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
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
  // 各ラベルのタイミングは、選ばれたBGMの再生開始トリガーにもなる。
  _runCountdown() {
    this._setStatus(STATUS.COUNTDOWN);
    const steps = [
      { label: '3', trigger: 'countdown3' },
      { label: '2', trigger: 'countdown2' },
      { label: '1', trigger: 'countdown1' },
      { label: 'START!', trigger: 'start' }
    ];
    steps.forEach(({ label, trigger }, i) => {
      const delay = i * CONFIG.countdownStepMs;
      const id = setTimeout(() => {
        if (label === 'START!') {
          audio.playCountdownStart();
        } else {
          audio.playCountdownTick();
        }
        audio.triggerBgmStart(trigger);
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

  // performance.now()基準の単調増加時刻で残り時間・フェーズを判定する。
  // requestAnimationFrameのループとタブ復帰時の即時チェックの両方から呼ばれる
  // 共通処理にすることで、フィーバー開始やタイムアップの多重発火を防ぐ。
  _evaluateTime() {
    if (this.status !== STATUS.PLAYING) return;

    const now = performance.now();
    this.remainingMs = Math.max(0, this.endsAt - now);
    this.dispatchEvent(new CustomEvent('timeupdate', {
      detail: { remainingMs: this.remainingMs, phase: this.phase }
    }));

    if (this.remainingMs <= 0) {
      this._timeUp();
      return;
    }

    // BGM05は「ゲーム開始（START!）から3秒後」に開始する（残り57秒のタイミング）。
    if (!this.bgmDelayTriggered && now - this.startedAt >= BGM_DELAY_TRIGGER_MS) {
      this.bgmDelayTriggered = true;
      audio.triggerBgmStart('delay3s');
    }

    if (this.phase === PHASE.NORMAL && !this.feverStarted && this.remainingMs <= CONFIG.feverDurationMs) {
      this._startFever();
    }

    if (this.phase === PHASE.FEVER) {
      const seconds = Math.ceil(this.remainingMs / 1000);
      if (seconds >= 1 && seconds <= 10 && seconds !== this.lastFeverTickSecond) {
        this.lastFeverTickSecond = seconds;
        audio.playFeverTick(seconds);
      }
    }
  }

  _loop() {
    this._evaluateTime();
    if (this.status === STATUS.PLAYING) {
      this.rafId = requestAnimationFrame(() => this._loop());
    }
  }

  // 残り10秒以下になった最初のフレームで一度だけ発動する（仕様書 4.3・5.1章）。
  _startFever() {
    this.phase = PHASE.FEVER;
    this.feverStarted = true;
    this.dispatchEvent(new CustomEvent('feverstart', {}));
    audio.playFeverStart();
  }

  // バックグラウンド復帰時に実時間を元に残り時間・フェーズを再計算する（仕様書 18章、Phase2 4.2章）。
  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      this._evaluateTime();
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
      // 倍率は、指を離して成功が確定した瞬間のフェーズで決める（仕様書 5.3章）。
      const isFever = this.phase === PHASE.FEVER;
      const result = calculateScore({ sum, pathLength: indices.length, isFever });
      this.score += result.points;
      applySuccess(this.stats, result);

      this.dispatchEvent(new CustomEvent('success', { detail: { indices, ...result } }));
      this.dispatchEvent(new CustomEvent('scoreupdate', { detail: { score: this.score } }));

      if (isFever) {
        audio.playFeverSuccess(indices.length, result.isForty);
      } else if (result.isForty) {
        audio.playForty(indices.length);
      } else {
        audio.playSuccess(indices.length);
      }

      const refills = this.board.clear(indices);
      this.dispatchEvent(new CustomEvent('cellsclear', { detail: { indices } }));
      this._scheduleRefill(refills);
    } else {
      recordFailure(this.stats);
      this.dispatchEvent(new CustomEvent('fail', { detail: { indices } }));
      audio.playFail();
    }

    this._emitSelectionUpdate([]);
  }

  // 消去確定後、1秒後に補充を反映する共通処理（成功時・破壊時の両方から使う）。
  _scheduleRefill(refills) {
    const timerId = setTimeout(() => {
      this.refillTimers.delete(timerId);
      const applied = refills.map(({ index }) => ({ index, value: this.board.refill(index) }));
      this.dispatchEvent(new CustomEvent('cellsrefill', { detail: { cells: applied, phase: this.phase } }));
    }, CONFIG.refillDelayMs);
    this.refillTimers.add(timerId);
  }

  // 1つの数字を連続でダブルタップすると、得点なしでその数字を破壊できる。
  // 消去・補充の仕組みは成功時と共通（同じ数字5個制限を守るboard.clear/refill）。
  _destroyCell(index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.board.isSelectable(index)) return;

    this._emitSelectionUpdate([]);
    this.dispatchEvent(new CustomEvent('destroy', { detail: { index } }));
    audio.playDestroy();

    const refills = this.board.clear([index]);
    this.dispatchEvent(new CustomEvent('cellsclear', { detail: { indices: [index] } }));
    this._scheduleRefill(refills);
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
    this.dispatchEvent(new CustomEvent('timeupdate', { detail: { remainingMs: 0, phase: this.phase } }));
    this.dispatchEvent(new CustomEvent('timeup', {}));
    audio.playTimeUp();

    const id = setTimeout(() => this._showResult(), CONFIG.resultTransitionDelayMs);
    this.countdownTimers.push(id);
  }

  _showResult() {
    this._setStatus(STATUS.RESULT);
    audio.stopBgm();
    audio.playResult();
    this.dispatchEvent(new CustomEvent('result', {
      detail: { score: this.score, stats: this.stats }
    }));
  }
}
