// おてがるスコアアタックの進行・タイマー・結果（おてがるモード実装指示書）。
// DOMは直接操作せず、CustomEventでUI層に通知する（既存game.js/puzzle.jsと同じ方針）。
import { CONFIG, BGM_EARLY_START_OFFSET_MS } from './config.js';
import { SelectionController } from './input.js';
import { calculateScore } from './scoring.js';
import { areAdjacent } from './puzzle-solver.js';
import { createEasyPatternBlock, generateEasyQuestion, getEasyPatternById, isEasyAnswerCorrect } from './easy-questions.js';
import * as audio from './audio.js';

export const STATUS = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  FINISHED: 'finished',
  DISPOSED: 'disposed'
};

export const QUESTION_STATUS = {
  PREPARING: 'preparing',
  ACTIVE: 'active',
  RESOLVING: 'resolving'
};

const EASY_COLS = CONFIG.easyScoreAttack.cols;

function createInitialStats() {
  return {
    presentedCount: 0,
    correctCount: 0,
    passCount: 0,
    failedTraceCount: 0,
    swapCount: 0,
    patternCorrectCounts: {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
      6: 0, 7: 0, 8: 0, 9: 0, 10: 0
    }
  };
}

export class EasyScoreAttackController extends EventTarget {
  constructor(boardEl, rng = Math.random) {
    super();
    this.boardEl = boardEl;
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.questionStatus = QUESTION_STATUS.PREPARING;
    this.score = 0;
    this.stats = createInitialStats();
    this.remainingMs = CONFIG.easyScoreAttack.durationMs;
    this.questionNumber = 1;
    this.questionRevision = 0;
    this.blocksByBlockNumber = new Map();
    this.currentPattern = null;
    this.currentQuestion = null;
    this.swapSelection = null;
    this.rafId = null;
    this.countdownTimers = [];
    this.nextQuestionTimer = null;
    this.selectionController = null;
    this.startedAt = null;
    this.endsAt = null;

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
    if (this.nextQuestionTimer !== null) {
      clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
  }

  // 問題番号からパターンIDを求める。10問ごとのブロックは、初めて必要になった
  // 時点で1回だけ生成しキャッシュする（10.3章：Q11・Q21…の開始前に新しい
  // ブロックを生成する、という要件を生成順序に依存せず満たすため）。
  _getPatternForQuestionNumber(questionNumber) {
    const blockNumber = Math.floor((questionNumber - 1) / 10);
    if (!this.blocksByBlockNumber.has(blockNumber)) {
      this.blocksByBlockNumber.set(blockNumber, createEasyPatternBlock(this.rng));
    }
    const block = this.blocksByBlockNumber.get(blockNumber);
    const positionInBlock = (questionNumber - 1) % 10;
    return getEasyPatternById(block[positionInBlock]);
  }

  startNewGame() {
    this._clearAllTimers();
    if (this.selectionController) this.selectionController.destroy();

    this.score = 0;
    this.stats = createInitialStats();
    this.remainingMs = CONFIG.easyScoreAttack.durationMs;
    this.questionNumber = 1;
    this.questionRevision = 0;
    this.blocksByBlockNumber = new Map();
    this.swapSelection = null;
    audio.chooseRandomBgmTrack(this.rng);

    this.currentPattern = this._getPatternForQuestionNumber(1);
    this.currentQuestion = generateEasyQuestion(this.currentPattern, null, this.rng);
    this.questionStatus = QUESTION_STATUS.PREPARING;

    this.selectionController = new SelectionController(this.boardEl, {
      isSelectable: (i) => this.status === STATUS.PLAYING && this.questionStatus === QUESTION_STATUS.ACTIVE,
      areAdjacent: (a, b) => areAdjacent(a, b, EASY_COLS),
      maxLength: CONFIG.easyScoreAttack.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
      longPressThresholdMs: CONFIG.longPressThresholdMs,
      onSelectionStart: (i, sel) => {
        audio.playTraceNote(0);
        this._emitSelectionUpdate(sel);
      },
      onCellAdded: (i, sel) => {
        this._clearSwapSelection();
        audio.playTraceNote(sel.length - 1);
        this._emitSelectionUpdate(sel);
      },
      onCellRemoved: (sel) => this._emitSelectionUpdate(sel),
      onSelectionEnd: (sel) => this.resolvePath(sel),
      onSelectionCancel: () => this._emitSelectionUpdate([]),
      onDoubleTap: (index) => this.resolvePass(index),
      onTap: (index) => this._handleTap(index),
      onLongPress: () => this._clearSwapSelection()
    });

    this._setStatus(STATUS.IDLE);
    this.dispatchEvent(new CustomEvent('boardinit', {
      detail: { questionNumber: 1, pattern: this.currentPattern, values: this.currentQuestion.values.slice() }
    }));
    this.dispatchEvent(new CustomEvent('scoreupdate', { detail: { score: this.score } }));
    this._runCountdown();
  }

  leave() {
    this._clearAllTimers();
    audio.stopBgm();
    if (this.selectionController) {
      this.selectionController.destroy();
      this.selectionController = null;
    }
    this.swapSelection = null;
    this._setStatus(STATUS.IDLE);
  }

  dispose() {
    this._clearAllTimers();
    if (this.selectionController) {
      this.selectionController.destroy();
      this.selectionController = null;
    }
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._setStatus(STATUS.DISPOSED);
  }

  _emitSelectionUpdate(selection) {
    const sel = selection || [];
    const values = sel.map((i) => this.currentQuestion.values[i]);
    const sum = values.reduce((a, b) => a + b, 0);
    this.dispatchEvent(new CustomEvent('selectionupdate', { detail: { indices: sel, values, sum } }));
  }

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
        if (label === 'START!') audio.playCountdownStart();
        else audio.playCountdownTick();
        audio.triggerBgmStart(trigger);
        this.dispatchEvent(new CustomEvent('countdown', { detail: { label } }));
        if (label === 'START!') this._beginPlaying();
      }, delay);
      this.countdownTimers.push(id);
    });

    [
      { trigger: 'bgm03Start', stepIndex: 2 },
      { trigger: 'bgm04Start', stepIndex: 3 }
    ].forEach(({ trigger, stepIndex }) => {
      const delay = Math.max(0, stepIndex * CONFIG.countdownStepMs - BGM_EARLY_START_OFFSET_MS);
      const id = setTimeout(() => audio.triggerBgmStart(trigger), delay);
      this.countdownTimers.push(id);
    });
  }

  _beginPlaying() {
    this.countdownTimers = [];
    this.startedAt = performance.now();
    this.endsAt = this.startedAt + CONFIG.easyScoreAttack.durationMs;
    this._setStatus(STATUS.PLAYING);
    this.questionStatus = QUESTION_STATUS.ACTIVE;
    this.stats.presentedCount += 1;
    this._loop();
  }

  _evaluateTime() {
    if (this.status !== STATUS.PLAYING) return;
    const now = performance.now();
    this.remainingMs = Math.max(0, this.endsAt - now);
    this.dispatchEvent(new CustomEvent('timeupdate', { detail: { remainingMs: this.remainingMs } }));
    if (this.remainingMs <= 0) this._timeUp();
  }

  _loop() {
    this._evaluateTime();
    if (this.status === STATUS.PLAYING) {
      this.rafId = requestAnimationFrame(() => this._loop());
    }
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') this._evaluateTime();
  }

  // なぞり終了時の正解判定（16章）。指を離した時点の現在の盤面値から再計算する。
  resolvePath(path) {
    if (this.status !== STATUS.PLAYING) return;
    if (this.questionStatus !== QUESTION_STATUS.ACTIVE) return;
    if (this.remainingMs <= 0) return;

    if (path.length < 2) {
      this._emitSelectionUpdate([]);
      return;
    }

    const correct = isEasyAnswerCorrect({ path, boardValues: this.currentQuestion.values, pattern: this.currentPattern });
    this._emitSelectionUpdate([]);

    if (correct) {
      this._resolveCorrectAnswer(path);
    } else {
      this.stats.failedTraceCount += 1;
      this.dispatchEvent(new CustomEvent('fail', { detail: { indices: path } }));
      audio.playFail();
    }
  }

  _resolveCorrectAnswer(path) {
    this.questionStatus = QUESTION_STATUS.RESOLVING;
    const result = calculateScore({ sum: this.currentPattern.targetSum, pathLength: this.currentPattern.cellCount, multiplier: 1, isFever: false });
    this.score += result.points;
    this.stats.correctCount += 1;
    this.stats.patternCorrectCounts[this.currentPattern.id] += 1;

    this.dispatchEvent(new CustomEvent('success', { detail: { indices: path, points: result.points, isForty: result.isForty } }));
    this.dispatchEvent(new CustomEvent('scoreupdate', { detail: { score: this.score } }));
    if (result.isForty) audio.playForty(path.length);
    else audio.playSuccess(path.length);

    this._scheduleNextQuestion();
  }

  // ダブルタップ＝パス（0点）。じっくりモードと異なり、おてがるでは
  // ダブルタップ破壊の代わりにこの問題を0点であきらめる操作になる（19章）。
  resolvePass(cellId) {
    if (this.status !== STATUS.PLAYING) return;
    if (this.questionStatus !== QUESTION_STATUS.ACTIVE) return;
    if (this.remainingMs <= 0) return;

    this.questionStatus = QUESTION_STATUS.RESOLVING;
    this._emitSelectionUpdate([]);
    this._clearSwapSelection();

    this.stats.passCount += 1;
    this.dispatchEvent(new CustomEvent('pass', { detail: { index: cellId } }));
    audio.playDestroy();

    this._scheduleNextQuestion();
  }

  // 正解・パスの300ms後に次の問題を有効化する（21章）。revisionで、古い
  // タイマーが多重発火して問題番号を2以上進めてしまわないようにする。
  _scheduleNextQuestion() {
    const revision = ++this.questionRevision;
    this.nextQuestionTimer = setTimeout(() => {
      this.nextQuestionTimer = null;
      if (revision !== this.questionRevision) return;
      if (this.status !== STATUS.PLAYING || this.remainingMs <= 0) return;
      this._advanceToNextQuestion();
    }, CONFIG.easyScoreAttack.transitionMs);
  }

  _advanceToNextQuestion() {
    this.questionNumber += 1;
    const pattern = this._getPatternForQuestionNumber(this.questionNumber);
    const question = generateEasyQuestion(pattern, this.currentQuestion.values, this.rng);
    this.currentPattern = pattern;
    this.currentQuestion = question;
    this.questionStatus = QUESTION_STATUS.ACTIVE;
    this.stats.presentedCount += 1;
    this.swapSelection = null;
    this.dispatchEvent(new CustomEvent('questionchange', {
      detail: { questionNumber: this.questionNumber, pattern, values: question.values.slice() }
    }));
  }

  // 数字入れかえ：任意の2マスを短くタップして交換する（20章）。得点・
  // 問題番号は変わらず、時間だけが進む。
  _handleTap(index) {
    if (this.status !== STATUS.PLAYING || this.questionStatus !== QUESTION_STATUS.ACTIVE) return;
    this._emitSelectionUpdate([]);

    if (this.swapSelection === null) {
      this.swapSelection = index;
      this.dispatchEvent(new CustomEvent('swapselectionupdate', { detail: { index } }));
      audio.playSwapSelect();
      return;
    }
    if (this.swapSelection === index) {
      this._clearSwapSelection();
      return;
    }
    this._performSwap(this.swapSelection, index);
  }

  _performSwap(a, b) {
    this._clearSwapSelection();
    const values = this.currentQuestion.values;
    const tmp = values[a];
    values[a] = values[b];
    values[b] = tmp;
    this.stats.swapCount += 1;
    this.dispatchEvent(new CustomEvent('swap', { detail: { indices: [a, b], values: [values[a], values[b]] } }));
    audio.playSwap();
  }

  _clearSwapSelection() {
    if (this.swapSelection === null) return;
    this.swapSelection = null;
    this.dispatchEvent(new CustomEvent('swapselectionupdate', { detail: { index: null } }));
  }

  _timeUp() {
    this._setStatus(STATUS.FINISHED);
    this._clearAllTimers();
    if (this.selectionController) this.selectionController.forceCancel();
    this._clearSwapSelection();
    this.questionStatus = QUESTION_STATUS.RESOLVING;

    this.remainingMs = 0;
    this.dispatchEvent(new CustomEvent('timeupdate', { detail: { remainingMs: 0 } }));
    this.dispatchEvent(new CustomEvent('timeup', {}));
    audio.stopBgm();
    audio.playTimeUp();

    const id = setTimeout(() => this._showResult(), CONFIG.resultTransitionDelayMs);
    this.countdownTimers.push(id);
  }

  _showResult() {
    audio.playResult();
    this.dispatchEvent(new CustomEvent('result', { detail: { score: this.score, stats: this.stats } }));
  }
}
