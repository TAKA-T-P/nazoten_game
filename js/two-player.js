// 1台2人バトルの進行管理（Phase4実装指示書）。P1・P2は完全に独立した状態
// （盤面・Pointer入力・得点・シルバー・フィーバー・入れかえ選択）を持つ。
// P2側の画面をCSSで180度回転させるだけで、盤面のセル順序やロジックは
// P1・P2で共通のまま扱う（仕様書7.2章）。
import { CONFIG, BGM_DELAY_TRIGGER_MS } from './config.js';
import { Board } from './board.js';
import { SelectionController } from './input.js';
import {
  calcSum,
  isValidSum,
  calculateScore,
  isSilverFeverTrigger,
  createStats,
  applySuccess,
  recordFailure,
  recordDestroy,
  recordSwap,
  recordSilverFeverTrigger
} from './scoring.js';
import * as audio from './audio.js';
import { OjamaController } from './ojama.js';

export const STATUS = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ENDING: 'ending',
  RESULT: 'result'
};

export const PHASE = {
  NORMAL: 'normal',
  FEVER: 'fever'
};

export const OUTCOME = {
  P1_WIN: 'p1win',
  P2_WIN: 'p2win',
  DRAW: 'draw'
};

const ACTORS = ['p1', 'p2'];

export class TwoPlayerController extends EventTarget {
  constructor(p1BoardEl, p2BoardEl, rng = Math.random) {
    super();
    this.boardEls = { p1: p1BoardEl, p2: p2BoardEl };
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.boards = { p1: null, p2: null };
    this.scores = { p1: 0, p2: 0 };
    this.stats = { p1: createStats(), p2: createStats() };
    this.remainingMs = CONFIG.gameDurationMs;
    this.endsAt = null;
    this.startedAt = null;
    this.rafId = null;
    this.refillTimers = new Set();
    this.countdownTimers = [];
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
    this.inputs = { p1: null, p2: null };
    // 数字入れかえで1つ目に選んだマス（プレイヤーごとに独立、未選択はnull）。
    this.swapSelections = { p1: null, p2: null };
    // シルバー・フィーバー（5マスで合計10）はP1・P2それぞれ独立に管理する。
    this.silverFever = {
      p1: { active: false, endsAt: null },
      p2: { active: false, endsAt: null }
    };
    // オジャマ（Phase5実装指示書15章）。main.jsはthis.ojamaへ直接イベント登録する。
    this.ojama = new OjamaController(rng);
    // ポーズ中は残り時間を止め、両者の入力を止める。再開時にendsAt・シルバー・
    // フィーバーの終了時刻をポーズしていた分だけ後ろへずらし、時間を消費しない。
    this.paused = false;
    this.pausedAt = null;

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  destroy() {
    this._clearAllTimers();
    this.ojama.dispose();
    ACTORS.forEach((actor) => {
      if (this.inputs[actor]) this.inputs[actor].destroy();
    });
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

  // 同じ初期配列から始まる、独立した2盤面を作る（仕様書8.1〜8.3章）。
  // ojamaEnabled: この対戦でオジャマを使うかどうか（対戦形式選択画面で設定）。
  start(ojamaEnabled = true) {
    this._clearAllTimers();
    ACTORS.forEach((actor) => {
      if (this.inputs[actor]) this.inputs[actor].destroy();
    });

    const sharedValues = Board.createInitialValues(this.rng);
    this.boards.p1 = new Board(this.rng, sharedValues);
    this.boards.p2 = new Board(this.rng, sharedValues);

    this.scores = { p1: 0, p2: 0 };
    this.stats = { p1: createStats(), p2: createStats() };
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.remainingMs = CONFIG.gameDurationMs;
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
    this.swapSelections = { p1: null, p2: null };
    this.silverFever = {
      p1: { active: false, endsAt: null },
      p2: { active: false, endsAt: null }
    };
    this.paused = false;
    this.pausedAt = null;
    audio.chooseRandomBgmTrack(this.rng);
    this.ojama.start({
      enabled: ojamaEnabled,
      getScores: () => ({ ...this.scores }),
      isMillionFeverActive: () => this.phase === PHASE.FEVER
    });

    ACTORS.forEach((actor) => {
      this.inputs[actor] = this._createInput(actor);
    });

    this._setStatus(STATUS.IDLE);
    this.dispatchEvent(new CustomEvent('boardinit', {
      detail: { p1Board: this.boards.p1, p2Board: this.boards.p2 }
    }));
    this._emitGaugeUpdate();
    this._runCountdown();
  }

  _createInput(actor) {
    const board = this.boards[actor];
    return new SelectionController(this.boardEls[actor], {
      isSelectable: (i) => this.status === STATUS.PLAYING && !this.paused && board.isSelectable(i),
      areAdjacent: (a, b) => Board.areAdjacent(a, b),
      maxLength: CONFIG.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
      longPressThresholdMs: CONFIG.longPressThresholdMs,
      onSelectionStart: (i, sel) => {
        audio.playTraceNote(0);
        this._emitSelection(actor, sel);
      },
      onCellAdded: (i, sel) => {
        this._clearSwapSelection(actor);
        audio.playTraceNote(sel.length - 1);
        this._emitSelection(actor, sel);
      },
      onCellRemoved: (sel) => this._emitSelection(actor, sel),
      onSelectionEnd: (sel) => this._finishSelection(actor, sel),
      onSelectionCancel: () => this._emitSelection(actor, []),
      onDoubleTap: (index) => this._destroyCell(actor, index),
      onTap: (index) => this._handleTap(actor, index),
      onLongPress: () => this._clearSwapSelection(actor)
    });
  }

  backToTitle() {
    this._clearAllTimers();
    this.ojama.stop();
    audio.stopBgm();
    ACTORS.forEach((actor) => {
      if (this.inputs[actor]) {
        this.inputs[actor].destroy();
        this.inputs[actor] = null;
      }
    });
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.swapSelections = { p1: null, p2: null };
    this.paused = false;
    this.pausedAt = null;
    ACTORS.forEach((actor) => this._clearSilverFever(actor));
    this._setStatus(STATUS.IDLE);
  }

  // ポーズ（Phase6：もどる→ポーズボタン化）。プレイ中だけ有効。RAFループを
  // 止めて残り時間の進行と入力を止め、進行中のなぞりは強制的に解除する。
  pause() {
    if (this.status !== STATUS.PLAYING || this.paused) return false;
    this.paused = true;
    this.pausedAt = performance.now();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    ACTORS.forEach((actor) => {
      if (this.inputs[actor]) this.inputs[actor].forceCancel();
    });
    // オジャマのボタン猶予・進行中の効果もここで打ち切る（再開後に無関係な
    // タイミングで消えるとかえって分かりにくいため）。ミリオン強制終了と
    // 同じ「未使用ボタン・進行中効果を消す」処理をそのまま再利用する。
    this.ojama.forceStopForMillion();
    return true;
  }

  resume() {
    if (!this.paused) return;
    const pausedDuration = performance.now() - this.pausedAt;
    this.endsAt += pausedDuration;
    ACTORS.forEach((actor) => {
      const side = this.silverFever[actor];
      if (side.active && side.endsAt !== null) side.endsAt += pausedDuration;
    });
    this.paused = false;
    this.pausedAt = null;
    this._loop();
  }

  _emitSelection(actor, selection) {
    const board = this.boards[actor];
    const sel = selection || [];
    const values = sel.map((i) => board.getValue(i));
    const sum = calcSum(values);
    this.dispatchEvent(new CustomEvent(`${actor}selectionupdate`, {
      detail: { indices: sel, values, sum, isValid: isValidSum(sum) }
    }));
  }

  // 3・2・1・BATTLE!を表示し、BATTLE!と同時に両者の入力を開始する（仕様書9.1章）。
  _runCountdown() {
    this._setStatus(STATUS.COUNTDOWN);
    const steps = [
      { label: '3', trigger: 'countdown3' },
      { label: '2', trigger: 'countdown2' },
      { label: '1', trigger: 'countdown1' },
      { label: 'BATTLE!', trigger: 'start' }
    ];
    steps.forEach(({ label, trigger }, i) => {
      const delay = i * CONFIG.countdownStepMs;
      const id = setTimeout(() => {
        if (label === 'BATTLE!') {
          audio.playCountdownStart();
        } else {
          audio.playCountdownTick();
        }
        audio.triggerBgmStart(trigger);
        this.dispatchEvent(new CustomEvent('countdown', { detail: { label } }));
        if (label === 'BATTLE!') this._beginPlaying();
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

  // 1つの共通時計（startedAt/endsAt）からP1・P2共通の残り時間を算出する（仕様書9.2章）。
  _evaluateTime() {
    if (this.status !== STATUS.PLAYING || this.paused) return;

    const now = performance.now();
    this.remainingMs = Math.max(0, this.endsAt - now);
    this.dispatchEvent(new CustomEvent('timeupdate', {
      detail: { remainingMs: this.remainingMs, phase: this.phase }
    }));

    if (this.remainingMs <= 0) {
      this._timeUp();
      return;
    }

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

    ACTORS.forEach((actor) => {
      const side = this.silverFever[actor];
      if (side.active && now >= side.endsAt) this._clearSilverFever(actor);
    });

    this.ojama.evaluate(this.remainingMs);
  }

  _loop() {
    this._evaluateTime();
    if (this.status === STATUS.PLAYING) {
      this.rafId = requestAnimationFrame(() => this._loop());
    }
  }

  // 残り10秒以下になった最初のフレームで両者同時に一度だけ発動する（仕様書15.1章）。
  // ミリオン開始時はP1・P2のシルバー・フィーバーを即時終了する（仕様書14.5章）。
  _startFever() {
    this.phase = PHASE.FEVER;
    this.feverStarted = true;
    ACTORS.forEach((actor) => this._clearSilverFever(actor));
    this.ojama.forceStopForMillion();
    this.dispatchEvent(new CustomEvent('feverstart', {}));
    audio.playFeverStart();
    this._emitGaugeUpdate();
  }

  // ミリオン・フィーバー中かどうかと、その側のシルバー・フィーバー状態から
  // 現在有効な得点倍率を決める。ミリオン・フィーバーが優先され、重複しない。
  _getScoringContext(actor) {
    const isFever = this.phase === PHASE.FEVER;
    const silverActive = !isFever && this.silverFever[actor].active;
    const multiplier = isFever ? CONFIG.feverMultiplier : (silverActive ? CONFIG.silverFeverMultiplier : 1);
    return { isFever, multiplier, silverActive };
  }

  // 発動中に再び条件を満たした場合は、倍率を重ねず残り時間だけ10秒へ更新する
  // （仕様書14.3章）。
  _startSilverFever(actor) {
    const side = this.silverFever[actor];
    side.active = true;
    side.endsAt = performance.now() + CONFIG.silverFeverDurationMs;
    recordSilverFeverTrigger(this.stats[actor]);
    this.dispatchEvent(new CustomEvent(`${actor}silverfeverstart`, {}));
    audio.playSilverFeverStart();
  }

  _clearSilverFever(actor) {
    const side = this.silverFever[actor];
    if (!side.active) return;
    side.active = false;
    side.endsAt = null;
    this.dispatchEvent(new CustomEvent(`${actor}silverfeverend`, {}));
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') this._evaluateTime();
  }

  _finishSelection(actor, indices) {
    if (this.status !== STATUS.PLAYING) return;

    if (indices.length < 2) {
      this._emitSelection(actor, []);
      return;
    }

    const board = this.boards[actor];
    const stats = this.stats[actor];
    const values = indices.map((i) => board.getValue(i));
    const sum = calcSum(values);

    if (isValidSum(sum)) {
      const { isFever, multiplier, silverActive } = this._getScoringContext(actor);
      const result = calculateScore({ sum, pathLength: indices.length, multiplier, isFever });
      this.scores[actor] += result.points;
      applySuccess(stats, result);

      this.dispatchEvent(new CustomEvent(`${actor}success`, { detail: { indices, ...result } }));

      if (isFever) {
        audio.playFeverSuccess(indices.length, result.isForty);
      } else if (silverActive) {
        audio.playSilverFeverSuccess(indices.length, result.isForty);
      } else if (result.isForty) {
        audio.playForty(indices.length);
      } else {
        audio.playSuccess(indices.length);
      }

      if (isSilverFeverTrigger(indices.length, sum, isFever)) {
        this._startSilverFever(actor);
      }

      const refills = board.clear(indices);
      this.dispatchEvent(new CustomEvent(`${actor}cellsclear`, { detail: { indices } }));
      this._scheduleRefill(actor, refills);
      this._emitGaugeUpdate();
    } else {
      recordFailure(stats);
      this.dispatchEvent(new CustomEvent(`${actor}fail`, { detail: { indices } }));
      audio.playFail();
    }

    this._emitSelection(actor, []);
  }

  _scheduleRefill(actor, refills) {
    const board = this.boards[actor];
    const timerId = setTimeout(() => {
      this.refillTimers.delete(timerId);
      const applied = refills.map(({ index }) => ({ index, value: board.refill(index) }));
      this.dispatchEvent(new CustomEvent(`${actor}cellsrefill`, { detail: { cells: applied } }));
    }, CONFIG.refillDelayMs);
    this.refillTimers.add(timerId);
  }

  _destroyCell(actor, index) {
    if (this.status !== STATUS.PLAYING) return;
    const board = this.boards[actor];
    if (!board.isSelectable(index)) return;

    this._emitSelection(actor, []);
    if (this.swapSelections[actor] === index) this._clearSwapSelection(actor);
    recordDestroy(this.stats[actor]);
    this.dispatchEvent(new CustomEvent(`${actor}destroy`, { detail: { index } }));
    audio.playDestroy();

    const refills = board.clear([index]);
    this.dispatchEvent(new CustomEvent(`${actor}cellsclear`, { detail: { indices: [index] } }));
    this._scheduleRefill(actor, refills);
  }

  // 数字入れかえ：1つ目のタップで選択、2つ目の異なるマスへのタップで入れ替える
  //（仕様書12章）。P1・P2の選択状態は完全に独立している。
  _handleTap(actor, index) {
    if (this.status !== STATUS.PLAYING) return;
    const board = this.boards[actor];
    if (!board.isSelectable(index)) return;

    this._emitSelection(actor, []);

    const current = this.swapSelections[actor];
    if (current === null) {
      this.swapSelections[actor] = index;
      this._emitSwapSelection(actor);
      audio.playSwapSelect();
      return;
    }

    if (current === index) {
      this._clearSwapSelection(actor);
      return;
    }

    this._performSwap(actor, current, index);
  }

  _performSwap(actor, indexA, indexB) {
    this._clearSwapSelection(actor);
    const board = this.boards[actor];
    if (!board.isSelectable(indexA) || !board.isSelectable(indexB)) return;

    board.swapValues(indexA, indexB);
    const values = [board.getValue(indexA), board.getValue(indexB)];
    recordSwap(this.stats[actor]);
    this.dispatchEvent(new CustomEvent(`${actor}swap`, { detail: { indices: [indexA, indexB], values } }));
    audio.playSwap();
  }

  _clearSwapSelection(actor) {
    if (this.swapSelections[actor] === null) return;
    this.swapSelections[actor] = null;
    this._emitSwapSelection(actor);
  }

  _emitSwapSelection(actor) {
    this.dispatchEvent(new CustomEvent(`${actor}swapselectionupdate`, { detail: { index: this.swapSelections[actor] } }));
  }

  // 点差ベースの正規化ゲージ（仕様書16章）。フィーバー中は非表示にする。
  _emitGaugeUpdate() {
    if (this.phase === PHASE.FEVER) {
      this.dispatchEvent(new CustomEvent('gaugeupdate', { detail: { visible: false, p1Percent: 50 } }));
      return;
    }
    const diff = this.scores.p1 - this.scores.p2;
    const normalized = Math.max(-1, Math.min(1, diff / CONFIG.gaugeFullLead));
    const p1Percent = 50 + normalized * 45;
    this.dispatchEvent(new CustomEvent('gaugeupdate', { detail: { visible: true, p1Percent } }));
  }

  _timeUp() {
    this._setStatus(STATUS.ENDING);
    this.ojama.stop();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    ACTORS.forEach((actor) => {
      if (this.inputs[actor]) this.inputs[actor].forceCancel();
      this._clearSwapSelection(actor);
      this._clearSilverFever(actor);
    });
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

    let outcome;
    if (this.scores.p1 > this.scores.p2) outcome = OUTCOME.P1_WIN;
    else if (this.scores.p1 < this.scores.p2) outcome = OUTCOME.P2_WIN;
    else outcome = OUTCOME.DRAW;

    this.dispatchEvent(new CustomEvent('result', {
      detail: {
        outcome,
        p1Score: this.scores.p1,
        p2Score: this.scores.p2,
        p1Stats: this.stats.p1,
        p2Stats: this.stats.p2
      }
    }));
  }
}
