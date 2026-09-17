// ごちゃまぜバトルの進行管理（Phase5実装指示書5〜14章）。P1・P2はスコア・入力・
// シルバー・フィーバー・入れかえ選択は独立させるが、盤面データは1つだけを共有する。
// 「共有モデルを2ビューへ同期する」ための特別なモデルクラスは設けず、既存の
// board.js（Board）をそのまま単一インスタンスとして両コントローラーから参照させる
// ことで実現する（isSelectable/clear/refill/swapValuesは元々この用途に十分）。
// 競合の勝敗は「JSは単一スレッドである」性質を利用し、確定直前にBoard側の状態を
// 再検証するだけで解決する（cpu.jsの_resolveSelectionと同じ手法。revision番号は
// 使わず、状態ベースの再検証で必要十分な整合性を保証する）。
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
const opponentOf = (actor) => (actor === 'p1' ? 'p2' : 'p1');

export class MixedBattleController extends EventTarget {
  constructor(p1BoardEl, p2BoardEl, rng = Math.random) {
    super();
    this.boardEls = { p1: p1BoardEl, p2: p2BoardEl };
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    // 共有盤面は1インスタンスだけ持つ（P1・P2それぞれのBoardを複製しない）。
    this.board = null;
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
    // 各プレイヤーが現在なぞっている経路（相手ビューへ相手色で表示し、
    // 入れかえ・破壊の保護判定にも使う。仕様書7.1・9.1章）。
    this.activePaths = { p1: [], p2: [] };
    this.swapSelections = { p1: null, p2: null };
    this.silverFever = {
      p1: { active: false, endsAt: null },
      p2: { active: false, endsAt: null }
    };
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

  // ojamaEnabled: この対戦でオジャマを使うかどうか（対戦形式選択画面で設定）。
  start(ojamaEnabled = true) {
    this._clearAllTimers();
    ACTORS.forEach((actor) => {
      if (this.inputs[actor]) this.inputs[actor].destroy();
    });

    // P1・P2で複製せず、1つのBoardインスタンスを両者が参照する（仕様書6.1章）。
    this.board = new Board(this.rng, Board.createInitialValues(this.rng));

    this.scores = { p1: 0, p2: 0 };
    this.stats = { p1: this._createMixedStats(), p2: this._createMixedStats() };
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.remainingMs = CONFIG.gameDurationMs;
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
    this.activePaths = { p1: [], p2: [] };
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
    this.dispatchEvent(new CustomEvent('boardinit', { detail: { board: this.board } }));
    this._emitGaugeUpdate();
    this._runCountdown();
  }

  // stolenCancelCount（相手に先に取られて解除された回数）はごちゃまぜ専用の
  // 追加統計のため、共通のcreateStats()の戻り値へ後付けする（仕様書21章）。
  _createMixedStats() {
    const stats = createStats();
    stats.stolenCancelCount = 0;
    return stats;
  }

  _createInput(actor) {
    return new SelectionController(this.boardEls[actor], {
      // 両者とも同じ共有盤面(this.board)を参照する。相手が選択中というだけの
      // 理由でisSelectableをfalseにはしない（仕様書9.2章：同じマスを同時になぞれる）。
      isSelectable: (i) => this.status === STATUS.PLAYING && !this.paused && this.board.isSelectable(i),
      areAdjacent: (a, b) => Board.areAdjacent(a, b),
      maxLength: CONFIG.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
      longPressThresholdMs: CONFIG.longPressThresholdMs,
      onSelectionStart: (i, sel) => {
        audio.playTraceNote(0);
        this._setActivePath(actor, sel);
      },
      onCellAdded: (i, sel) => {
        this._clearSwapSelection(actor);
        audio.playTraceNote(sel.length - 1);
        this._setActivePath(actor, sel);
      },
      onCellRemoved: (sel) => this._setActivePath(actor, sel),
      onSelectionEnd: (sel) => this._finishSelection(actor, sel),
      onSelectionCancel: () => this._setActivePath(actor, []),
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
    this.activePaths = { p1: [], p2: [] };
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

  // 自分の現在経路を更新し、両ビューへ通知する。UI側は自分の盤面には自分色、
  // 相手の盤面には相手色として同じイベントを描き分ける（仕様書7.2章）。
  _setActivePath(actor, selection) {
    const sel = selection || [];
    this.activePaths[actor] = sel;
    const values = sel.map((i) => this.board.getValue(i));
    const sum = calcSum(values);
    this.dispatchEvent(new CustomEvent(`${actor}selectionupdate`, {
      detail: { indices: sel, values, sum, isValid: isValidSum(sum) }
    }));
  }

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

  _startFever() {
    this.phase = PHASE.FEVER;
    this.feverStarted = true;
    ACTORS.forEach((actor) => this._clearSilverFever(actor));
    this.ojama.forceStopForMillion();
    this.dispatchEvent(new CustomEvent('feverstart', {}));
    audio.playFeverStart();
    this._emitGaugeUpdate();
  }

  _getScoringContext(actor) {
    const isFever = this.phase === PHASE.FEVER;
    const silverActive = !isFever && this.silverFever[actor].active;
    const multiplier = isFever ? CONFIG.feverMultiplier : (silverActive ? CONFIG.silverFeverMultiplier : 1);
    return { isFever, multiplier, silverActive };
  }

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

  // 成功確定。共有盤面のため、確定直前に必ず現在の盤面状態と再検証する
  // （仕様書8.1章）。先に相手が同じセルを消していた場合は「横取りされた」
  // として、失敗回数へ含めず静かに解除する（仕様書8.3章）。
  _finishSelection(actor, indices) {
    if (this.status !== STATUS.PLAYING) return;

    if (indices.length < 2) {
      this._setActivePath(actor, []);
      return;
    }

    const stats = this.stats[actor];
    const stillAllSelectable = indices.every((i) => this.board.isSelectable(i));
    if (!stillAllSelectable) {
      stats.stolenCancelCount += 1;
      this.dispatchEvent(new CustomEvent(`${actor}stolen`, { detail: { indices } }));
      audio.playStolen();
      this._setActivePath(actor, []);
      return;
    }

    const values = indices.map((i) => this.board.getValue(i));
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

      const refills = this.board.clear(indices);
      // 共有盤面のため、消去は「どちら発」ではなく両ビュー共通の1イベントで通知する。
      this.dispatchEvent(new CustomEvent('sharedcellsclear', { detail: { indices } }));
      this._scheduleRefill(refills);
      this._emitGaugeUpdate();
    } else {
      recordFailure(stats);
      this.dispatchEvent(new CustomEvent(`${actor}fail`, { detail: { indices } }));
      audio.playFail();
    }

    this._setActivePath(actor, []);
  }

  _scheduleRefill(refills) {
    const timerId = setTimeout(() => {
      this.refillTimers.delete(timerId);
      const applied = refills.map(({ index }) => ({ index, value: this.board.refill(index) }));
      this.dispatchEvent(new CustomEvent('sharedcellsrefill', { detail: { cells: applied } }));
    }, CONFIG.refillDelayMs);
    this.refillTimers.add(timerId);
  }

  // セルが「相手選択中」か（相手の現在なぞり経路、または相手の入れかえ1個目選択）。
  // 仕様書9.1章。
  _isProtectedByOpponent(actor, cellIndices) {
    const opponent = opponentOf(actor);
    const opponentPath = this.activePaths[opponent];
    const opponentSwap = this.swapSelections[opponent];
    return cellIndices.some((i) => opponentPath.includes(i) || opponentSwap === i);
  }

  _destroyCell(actor, index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.board.isSelectable(index)) return;

    // 相手選択中のマスは破壊できない（仕様書9.4章）。確定直前（ダブルタップ確定時）
    // に再検証する。
    if (this._isProtectedByOpponent(actor, [index])) {
      if (this.swapSelections[actor] === index) this._clearSwapSelection(actor);
      this.dispatchEvent(new CustomEvent(`${actor}destroyblocked`, { detail: { index } }));
      audio.playBlocked();
      return;
    }

    this._setActivePath(actor, []);
    if (this.swapSelections[actor] === index) this._clearSwapSelection(actor);
    recordDestroy(this.stats[actor]);
    this.dispatchEvent(new CustomEvent(`${actor}destroy`, { detail: { index } }));
    audio.playDestroy();

    const refills = this.board.clear([index]);
    this.dispatchEvent(new CustomEvent('sharedcellsclear', { detail: { indices: [index] } }));
    this._scheduleRefill(refills);
  }

  // 数字入れかえ：1つ目のタップで選択、2つ目の異なるマスへのタップで入れ替える
  // （仕様書10章）。相手選択中のマスとの入れかえは、確定直前に不成立とする。
  _handleTap(actor, index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.board.isSelectable(index)) return;

    this._setActivePath(actor, []);

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
    if (!this.board.isSelectable(indexA) || !this.board.isSelectable(indexB)) return;

    // 確定直前の再検証（仕様書9.3・9.5章）：どちらか一方でも相手選択中なら不成立。
    if (this._isProtectedByOpponent(actor, [indexA, indexB])) {
      this.dispatchEvent(new CustomEvent(`${actor}swapblocked`, { detail: { indices: [indexA, indexB] } }));
      audio.playBlocked();
      return;
    }

    this.board.swapValues(indexA, indexB);
    const values = [this.board.getValue(indexA), this.board.getValue(indexB)];
    recordSwap(this.stats[actor]);
    this.dispatchEvent(new CustomEvent('sharedswap', { detail: { indices: [indexA, indexB], values } }));
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
      this.activePaths[actor] = [];
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
        p2Stats: this.stats.p2,
        ojamaUsed: { p1: this.ojama.getUsedCount('p1'), p2: this.ojama.getUsedCount('p2') },
        ojamaReceived: { p1: this.ojama.getReceivedCount('p1'), p2: this.ojama.getReceivedCount('p2') },
        ojamaTotalUses: this.ojama.getTotalUsedCount()
      }
    }));
  }
}
