// CPUバトルの進行管理：共通タイマー、両者のスコア・盤面、フィーバー、ゲージ、勝敗
//（Phase3実装指示書 8〜16章）。既存の1人用NazotenGameとは責務を分離した独立クラスとする。
import { CONFIG, CPU_LEVELS, BGM_DELAY_TRIGGER_MS, BGM_EARLY_START_OFFSET_MS } from './config.js';
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
import { CpuController } from './cpu.js';
import { OjamaController } from './ojama.js';
import * as audio from './audio.js';

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
  WIN: 'win',
  LOSE: 'lose',
  DRAW: 'draw'
};

export class BattleController extends EventTarget {
  constructor(playerBoardEl, rng = Math.random) {
    super();
    this.playerBoardEl = playerBoardEl;
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.level = '1';
    this.playerBoard = null;
    this.cpuBoard = null;
    this.playerScore = 0;
    this.cpuScore = 0;
    this.playerStats = createStats();
    this.cpuStats = createStats();
    this.remainingMs = CONFIG.gameDurationMs;
    this.endsAt = null;
    this.startedAt = null;
    this.rafId = null;
    this.refillTimers = new Set();
    this.countdownTimers = [];
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
    this.selectionController = null;
    this.cpuController = null;
    // 数字入れかえで1つ目に選んだプレイヤー盤面のマス（未選択はnull）。
    this.swapSelection = null;
    // シルバー・フィーバー（5マスで合計10）はプレイヤー・CPUそれぞれ独立に管理する。
    this.playerSilverFever = { active: false, endsAt: null };
    this.cpuSilverFever = { active: false, endsAt: null };

    // オジャマ（CPU戦にも2P同様の自動発動・演出を接続する）。CPU側が対象になった
    // 場合は、見た目の種類にはよらずCPUの思考・なぞり操作時間を一定時間だけ
    // 遅くする。
    this.ojama = new OjamaController(rng);
    this.ojama.addEventListener('effectstart', (e) => this._applyOjamaSlowIfCpuTarget(e.detail.targetActor));

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  destroy() {
    this._clearAllTimers();
    if (this.selectionController) this.selectionController.destroy();
    if (this.cpuController) this.cpuController.stop();
    this.ojama.dispose();
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

  // CPU側が自動オジャマの対象になった場合、見た目の種類にかかわらず
  // CPUの思考時間・なぞり操作時間を一定時間だけ遅くする。
  _applyOjamaSlowIfCpuTarget(targetActor) {
    if (targetActor !== 'p2' || !this.cpuController) return;
    this.cpuController.setSpeedMultiplier(CONFIG.ojama.cpuSlowMultiplier, CONFIG.ojama.effectDurationMs);
  }

  // 両者が同じ初期配列から始まる独立した2盤面を作る（仕様書7.1〜7.3章）。
  startBattle(level, ojamaEnabled = true) {
    this._clearAllTimers();
    if (this.selectionController) this.selectionController.destroy();
    if (this.cpuController) this.cpuController.stop();

    this.level = level;
    const sharedValues = Board.createInitialValues(this.rng);
    this.playerBoard = new Board(this.rng, sharedValues);
    this.cpuBoard = new Board(this.rng, sharedValues);

    this.playerScore = 0;
    this.cpuScore = 0;
    this.playerStats = createStats();
    this.cpuStats = createStats();
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.remainingMs = CONFIG.gameDurationMs;
    this.lastFeverTickSecond = null;
    this.bgmDelayTriggered = false;
    this.swapSelection = null;
    this.playerSilverFever = { active: false, endsAt: null };
    this.cpuSilverFever = { active: false, endsAt: null };
    audio.chooseRandomBgmTrack(this.rng);
    this.ojama.start({
      enabled: ojamaEnabled,
      getScores: () => ({ p1: this.playerScore, p2: this.cpuScore }),
      isMillionFeverActive: () => this.phase === PHASE.FEVER
    });

    this.selectionController = new SelectionController(this.playerBoardEl, {
      isSelectable: (i) => this.status === STATUS.PLAYING && this.playerBoard.isSelectable(i),
      areAdjacent: (a, b) => Board.areAdjacent(a, b),
      maxLength: CONFIG.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
      longPressThresholdMs: CONFIG.longPressThresholdMs,
      onSelectionStart: (i, sel) => {
        audio.playTraceNote(0);
        this._emitPlayerSelection(sel);
      },
      onCellAdded: (i, sel) => {
        this._clearSwapSelection();
        audio.playTraceNote(sel.length - 1);
        this._emitPlayerSelection(sel);
      },
      onCellRemoved: (sel) => this._emitPlayerSelection(sel),
      onSelectionEnd: (sel) => this._finishPlayerSelection(sel),
      onSelectionCancel: () => this._emitPlayerSelection([]),
      onDoubleTap: (index) => this._destroyPlayerCell(index),
      onTap: (index) => this._handleTap(index),
      onLongPress: () => this._clearSwapSelection()
    });

    this.cpuController = new CpuController({
      board: this.cpuBoard,
      levelConfig: CPU_LEVELS[level],
      rng: this.rng,
      onSelectionChange: (sel) => this.dispatchEvent(new CustomEvent('cpuselectionupdate', { detail: { indices: sel } })),
      onSuccess: (result) => this._applyCpuSuccess(result),
      onFail: (indices) => this._applyCpuFail(indices),
      onDestroy: (index) => this._applyCpuDestroy(index),
      onCellsClear: (indices) => this.dispatchEvent(new CustomEvent('cpucellsclear', { detail: { indices } })),
      onCellsRefill: (cells) => this.dispatchEvent(new CustomEvent('cpucellsrefill', { detail: { cells } }))
    });

    this._setStatus(STATUS.IDLE);
    this.dispatchEvent(new CustomEvent('boardinit', {
      detail: { playerBoard: this.playerBoard, cpuBoard: this.cpuBoard, level }
    }));
    this._emitGaugeUpdate();
    this._runCountdown();
  }

  backToTitle() {
    this._clearAllTimers();
    audio.stopBgm();
    if (this.selectionController) {
      this.selectionController.destroy();
      this.selectionController = null;
    }
    if (this.cpuController) {
      this.cpuController.stop();
      this.cpuController = null;
    }
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.swapSelection = null;
    this._clearSilverFever(this.playerSilverFever, 'playersilverfeverend');
    this._clearSilverFever(this.cpuSilverFever, 'cpusilverfeverend');
    this.ojama.stop();
    this._setStatus(STATUS.IDLE);
  }

  _emitPlayerSelection(selection) {
    const sel = selection || [];
    const values = sel.map((i) => this.playerBoard.getValue(i));
    const sum = calcSum(values);
    this.dispatchEvent(new CustomEvent('playerselectionupdate', {
      detail: { indices: sel, values, sum, isValid: isValidSum(sum) }
    }));
  }

  // 3・2・1・BATTLE!を表示し、BATTLE!と同時にプレイヤー入力とCPU思考を開始する
  //（仕様書8.1章）。既存のBGMタイミング仕様は'start'トリガーを流用する。
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

    // BGM03・BGM04は、対応するカウントダウンの表示タイミングより1秒早く
    // 再生を開始する（曲の盛り上がりに合わせるための専用タイミング）。
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
    this.endsAt = this.startedAt + CONFIG.gameDurationMs;
    this._setStatus(STATUS.PLAYING);
    this.cpuController.start({ getScoringContext: () => this._getScoringContext(this.cpuSilverFever) });
    this._loop();
  }

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

    if (this.playerSilverFever.active && now >= this.playerSilverFever.endsAt) {
      this._clearSilverFever(this.playerSilverFever, 'playersilverfeverend');
    }
    if (this.cpuSilverFever.active && now >= this.cpuSilverFever.endsAt) {
      this._clearSilverFever(this.cpuSilverFever, 'cpusilverfeverend');
    }

    this.ojama.evaluate(this.remainingMs);
  }

  _loop() {
    this._evaluateTime();
    if (this.status === STATUS.PLAYING) {
      this.rafId = requestAnimationFrame(() => this._loop());
    }
  }

  // 残り10秒以下になった最初のフレームで両者同時に一度だけ発動する（仕様書8.3章）。
  _startFever() {
    this.phase = PHASE.FEVER;
    this.feverStarted = true;
    this.dispatchEvent(new CustomEvent('feverstart', {}));
    audio.playFeverStart();
    this._emitGaugeUpdate();
    this.ojama.forceStopForMillion();
  }

  // ミリオン・フィーバー中かどうかと、その側のシルバー・フィーバー状態から
  // 現在有効な得点倍率を決める。ミリオン・フィーバーが優先され、重複しない。
  _getScoringContext(sideState) {
    const isFever = this.phase === PHASE.FEVER;
    const silverActive = !isFever && sideState.active;
    const multiplier = isFever ? CONFIG.feverMultiplier : (silverActive ? CONFIG.silverFeverMultiplier : 1);
    return { isFever, multiplier, silverActive };
  }

  _startSilverFever(stats, sideState, eventName) {
    sideState.active = true;
    sideState.endsAt = performance.now() + CONFIG.silverFeverDurationMs;
    recordSilverFeverTrigger(stats);
    this.dispatchEvent(new CustomEvent(eventName, {}));
    audio.playSilverFeverStart();
  }

  _clearSilverFever(sideState, eventName) {
    if (!sideState.active) return;
    sideState.active = false;
    sideState.endsAt = null;
    this.dispatchEvent(new CustomEvent(eventName, {}));
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      this._evaluateTime();
    }
  }

  _finishPlayerSelection(indices) {
    if (this.status !== STATUS.PLAYING) return;

    if (indices.length < 2) {
      this._emitPlayerSelection([]);
      return;
    }

    const values = indices.map((i) => this.playerBoard.getValue(i));
    const sum = calcSum(values);

    if (isValidSum(sum)) {
      const { isFever, multiplier, silverActive } = this._getScoringContext(this.playerSilverFever);
      const result = calculateScore({ sum, pathLength: indices.length, multiplier, isFever });
      this.playerScore += result.points;
      applySuccess(this.playerStats, result);

      this.dispatchEvent(new CustomEvent('playersuccess', { detail: { indices, ...result } }));

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
        this._startSilverFever(this.playerStats, this.playerSilverFever, 'playersilverfeverstart');
      }

      const refills = this.playerBoard.clear(indices);
      this.dispatchEvent(new CustomEvent('playercellsclear', { detail: { indices } }));
      this._scheduleRefill(this.playerBoard, refills, 'playercellsrefill');
      this._emitGaugeUpdate();
    } else {
      recordFailure(this.playerStats);
      this.dispatchEvent(new CustomEvent('playerfail', { detail: { indices } }));
      audio.playFail();
    }

    this._emitPlayerSelection([]);
  }

  _destroyPlayerCell(index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.playerBoard.isSelectable(index)) return;

    this._emitPlayerSelection([]);
    if (this.swapSelection === index) this._clearSwapSelection();
    recordDestroy(this.playerStats);
    this.dispatchEvent(new CustomEvent('playerdestroy', { detail: { index } }));
    audio.playDestroy();

    const refills = this.playerBoard.clear([index]);
    this.dispatchEvent(new CustomEvent('playercellsclear', { detail: { indices: [index] } }));
    this._scheduleRefill(this.playerBoard, refills, 'playercellsrefill');
  }

  // 数字入れかえ（プレイヤー盤面のみ）：1つ目のタップで選択、2つ目の異なるマスへの
  // タップで入れ替える。同じマスの再タップ・なぞり動作の開始・長押しで選択解除。
  _handleTap(index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.playerBoard.isSelectable(index)) return;

    // タップ確定時は、なぞり選択の見た目（枠・拡大・順番バッジ・合計表示）を消す。
    this._emitPlayerSelection([]);

    if (this.swapSelection === null) {
      this.swapSelection = index;
      this._emitSwapSelection();
      audio.playSwapSelect();
      return;
    }

    if (this.swapSelection === index) {
      this._clearSwapSelection();
      return;
    }

    this._performSwap(this.swapSelection, index);
  }

  _performSwap(indexA, indexB) {
    this._clearSwapSelection();
    if (!this.playerBoard.isSelectable(indexA) || !this.playerBoard.isSelectable(indexB)) return;

    this.playerBoard.swapValues(indexA, indexB);
    const values = [this.playerBoard.getValue(indexA), this.playerBoard.getValue(indexB)];
    recordSwap(this.playerStats);
    this.dispatchEvent(new CustomEvent('playerswap', { detail: { indices: [indexA, indexB], values } }));
    audio.playSwap();
  }

  _clearSwapSelection() {
    if (this.swapSelection === null) return;
    this.swapSelection = null;
    this._emitSwapSelection();
  }

  _emitSwapSelection() {
    this.dispatchEvent(new CustomEvent('playerswapselectionupdate', { detail: { index: this.swapSelection } }));
  }

  _scheduleRefill(board, refills, eventName) {
    const timerId = setTimeout(() => {
      this.refillTimers.delete(timerId);
      const applied = refills.map(({ index }) => ({ index, value: board.refill(index) }));
      this.dispatchEvent(new CustomEvent(eventName, { detail: { cells: applied } }));
    }, CONFIG.refillDelayMs);
    this.refillTimers.add(timerId);
  }

  _applyCpuSuccess(result) {
    if (this.status !== STATUS.PLAYING) return;
    this.cpuScore += result.points;
    applySuccess(this.cpuStats, result);
    this.dispatchEvent(new CustomEvent('cpusuccess', { detail: result }));
    audio.playCpuSuccess(result.pathLength, result.isForty);
    if (isSilverFeverTrigger(result.pathLength, result.sum, result.isFever)) {
      this._startSilverFever(this.cpuStats, this.cpuSilverFever, 'cpusilverfeverstart');
    }
    this._emitGaugeUpdate();
  }

  _applyCpuFail(indices) {
    if (this.status !== STATUS.PLAYING) return;
    recordFailure(this.cpuStats);
    this.dispatchEvent(new CustomEvent('cpufail', { detail: { indices } }));
    audio.playCpuFail();
  }

  _applyCpuDestroy(index) {
    if (this.status !== STATUS.PLAYING) return;
    recordDestroy(this.cpuStats);
    this.dispatchEvent(new CustomEvent('cpudestroy', { detail: { index } }));
    audio.playCpuDestroy();
  }

  // 点差を基準にした正規化ゲージ（仕様書9.3・9.4章）。フィーバー中は非表示にする。
  _emitGaugeUpdate() {
    if (this.phase === PHASE.FEVER) {
      this.dispatchEvent(new CustomEvent('gaugeupdate', { detail: { visible: false, playerPercent: 50 } }));
      return;
    }
    const diff = this.playerScore - this.cpuScore;
    const normalized = Math.max(-1, Math.min(1, diff / CONFIG.gaugeFullLead));
    const playerPercent = 50 + normalized * 45;
    this.dispatchEvent(new CustomEvent('gaugeupdate', { detail: { visible: true, playerPercent } }));
  }

  _timeUp() {
    this._setStatus(STATUS.ENDING);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.selectionController) this.selectionController.forceCancel();
    if (this.cpuController) this.cpuController.stop();
    this._clearSwapSelection();
    this._clearSilverFever(this.playerSilverFever, 'playersilverfeverend');
    this._clearSilverFever(this.cpuSilverFever, 'cpusilverfeverend');
    this.ojama.stop();
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

    let outcome;
    if (this.playerScore > this.cpuScore) outcome = OUTCOME.WIN;
    else if (this.playerScore < this.cpuScore) outcome = OUTCOME.LOSE;
    else outcome = OUTCOME.DRAW;
    audio.playBattleResultSound(outcome === OUTCOME.WIN);

    this.dispatchEvent(new CustomEvent('result', {
      detail: {
        outcome,
        level: this.level,
        playerScore: this.playerScore,
        cpuScore: this.cpuScore,
        playerStats: this.playerStats,
        cpuStats: this.cpuStats
      }
    }));
  }
}
