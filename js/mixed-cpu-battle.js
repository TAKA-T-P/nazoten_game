// ごちゃまぜバトルCPU戦の進行管理。mixed-battle.js（共有盤面・先着判定・相手選択
// 保護）とbattle.js/cpu.js（CPUの経路探索・なぞり演出・オジャマ連携）を組み合わせる。
// 盤面はmixed-battle.js同様、1つのBoardインスタンスをプレイヤー入力・CPU
// コントローラーの両方が参照し、「先に確定した側が勝つ」という性質はcpu.jsの
// _resolveSelection・プレイヤー側のisSelectable再検証の両方に共通する仕組み
// （状態ベースの再検証）だけで実現する。新しい競合解決の仕組みは作らない。
import { CONFIG, CPU_LEVELS, BGM_DELAY_TRIGGER_MS, BGM_EARLY_START_OFFSET_MS } from './config.js';
import { Board } from './board.js';
import { SelectionController } from './input.js';
import { CpuController } from './cpu.js';
import { OjamaController } from './ojama.js';
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

// OjamaController・イベント名はp1（プレイヤー）・p2（CPU）で統一し、2人バトル系の
// 命名パターン（mixed-battle.js）をそのまま踏襲する。
export class MixedCpuBattleController extends EventTarget {
  constructor(playerBoardEl, cpuBoardEl, rng = Math.random) {
    super();
    this.playerBoardEl = playerBoardEl;
    this.cpuBoardEl = cpuBoardEl;
    this.rng = rng;
    this.status = STATUS.IDLE;
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.level = '1';
    // 共有盤面は1インスタンスだけ持つ（プレイヤー用・CPU用に複製しない）。
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
    this.playerInput = null;
    this.cpuController = null;
    // p1（プレイヤー）が現在なぞっている経路・p2（CPU）がなぞり演出中の経路。
    // 相手ビューへの重ね表示、入れかえ・破壊の保護判定に使う。
    this.activePaths = { p1: [], p2: [] };
    // CPUは入れかえを行わないため、swapSelections.p2は常にnullのまま。
    this.swapSelections = { p1: null, p2: null };
    this.silverFever = {
      p1: { active: false, endsAt: null },
      p2: { active: false, endsAt: null }
    };
    this.ojama = new OjamaController(rng);
    this.ojama.addEventListener('effectstart', (e) => this._applyOjamaSlowIfCpuTarget(e.detail.targetActor));

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  destroy() {
    this._clearAllTimers();
    this.ojama.dispose();
    if (this.playerInput) this.playerInput.destroy();
    if (this.cpuController) this.cpuController.stop();
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

  start(level, ojamaEnabled = true) {
    this._clearAllTimers();
    if (this.playerInput) this.playerInput.destroy();
    if (this.cpuController) this.cpuController.stop();

    this.level = level;
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
    audio.chooseRandomBgmTrack(this.rng);
    this.ojama.start({
      enabled: ojamaEnabled,
      getScores: () => ({ ...this.scores }),
      isMillionFeverActive: () => this.phase === PHASE.FEVER
    });

    this.playerInput = new SelectionController(this.playerBoardEl, {
      isSelectable: (i) => this.status === STATUS.PLAYING && this.board.isSelectable(i),
      areAdjacent: (a, b) => Board.areAdjacent(a, b),
      maxLength: CONFIG.maxPathLength,
      doubleTapThresholdMs: CONFIG.doubleTapThresholdMs,
      longPressThresholdMs: CONFIG.longPressThresholdMs,
      onSelectionStart: (i, sel) => {
        audio.playTraceNote(0);
        this._setActivePath('p1', sel);
      },
      onCellAdded: (i, sel) => {
        this._clearSwapSelection('p1');
        audio.playTraceNote(sel.length - 1);
        this._setActivePath('p1', sel);
      },
      onCellRemoved: (sel) => this._setActivePath('p1', sel),
      onSelectionEnd: (sel) => this._finishPlayerSelection(sel),
      onSelectionCancel: () => this._setActivePath('p1', []),
      onDoubleTap: (index) => this._destroyPlayerCell(index),
      onTap: (index) => this._handlePlayerTap(index),
      onLongPress: () => this._clearSwapSelection('p1')
    });

    this.cpuController = new CpuController({
      board: this.board,
      levelConfig: CPU_LEVELS[level],
      rng: this.rng,
      onSelectionChange: (sel) => this._setActivePath('p2', sel),
      onSuccess: (result) => this._applyCpuSuccess(result),
      onFail: (indices) => this._applyCpuFail(indices),
      onDestroy: (index) => this._applyCpuDestroy(index),
      onCellsClear: (indices) => this.dispatchEvent(new CustomEvent('sharedcellsclear', { detail: { indices } })),
      onCellsRefill: (cells) => this.dispatchEvent(new CustomEvent('sharedcellsrefill', { detail: { cells } })),
      onStolen: (indices) => this._applyCpuStolen(indices)
    });

    this._setStatus(STATUS.IDLE);
    this.dispatchEvent(new CustomEvent('boardinit', { detail: { board: this.board, level } }));
    this._emitGaugeUpdate();
    this._runCountdown();
  }

  // stolenCancelCount（相手に先に取られて解除された回数）はごちゃまぜ専用の
  // 追加統計のため、共通のcreateStats()の戻り値へ後付けする。
  _createMixedStats() {
    const stats = createStats();
    stats.stolenCancelCount = 0;
    return stats;
  }

  backToTitle() {
    this._clearAllTimers();
    this.ojama.stop();
    audio.stopBgm();
    if (this.playerInput) {
      this.playerInput.destroy();
      this.playerInput = null;
    }
    if (this.cpuController) {
      this.cpuController.stop();
      this.cpuController = null;
    }
    this.phase = PHASE.NORMAL;
    this.feverStarted = false;
    this.swapSelections = { p1: null, p2: null };
    this.activePaths = { p1: [], p2: [] };
    this._clearSilverFever('p1');
    this._clearSilverFever('p2');
    this._setStatus(STATUS.IDLE);
  }

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
    this.cpuController.start({ getScoringContext: () => this._getScoringContext('p2') });
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

    ['p1', 'p2'].forEach((actor) => {
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
    this._clearSilverFever('p1');
    this._clearSilverFever('p2');
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

  // プレイヤーの成功確定。共有盤面のため、確定直前に必ず現在の盤面状態を
  // 再検証する。先にCPUが同じセルを消していた場合は「横取りされた」として、
  // 失敗回数へ含めず静かに解除する（mixed-battle.jsと同じ手法）。
  _finishPlayerSelection(indices) {
    if (this.status !== STATUS.PLAYING) return;

    if (indices.length < 2) {
      this._setActivePath('p1', []);
      return;
    }

    const stats = this.stats.p1;
    const stillAllSelectable = indices.every((i) => this.board.isSelectable(i));
    if (!stillAllSelectable) {
      stats.stolenCancelCount += 1;
      this.dispatchEvent(new CustomEvent('p1stolen', { detail: { indices } }));
      audio.playStolen();
      this._setActivePath('p1', []);
      return;
    }

    const values = indices.map((i) => this.board.getValue(i));
    const sum = calcSum(values);

    if (isValidSum(sum)) {
      const { isFever, multiplier, silverActive } = this._getScoringContext('p1');
      const result = calculateScore({ sum, pathLength: indices.length, multiplier, isFever });
      this.scores.p1 += result.points;
      applySuccess(stats, result);

      this.dispatchEvent(new CustomEvent('p1success', { detail: { indices, ...result } }));

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
        this._startSilverFever('p1');
      }

      const refills = this.board.clear(indices);
      this.dispatchEvent(new CustomEvent('sharedcellsclear', { detail: { indices } }));
      this._scheduleRefill(refills);
      this._emitGaugeUpdate();
    } else {
      recordFailure(stats);
      this.dispatchEvent(new CustomEvent('p1fail', { detail: { indices } }));
      audio.playFail();
    }

    this._setActivePath('p1', []);
  }

  _scheduleRefill(refills) {
    const timerId = setTimeout(() => {
      this.refillTimers.delete(timerId);
      const applied = refills.map(({ index }) => ({ index, value: this.board.refill(index) }));
      this.dispatchEvent(new CustomEvent('sharedcellsrefill', { detail: { cells: applied } }));
    }, CONFIG.refillDelayMs);
    this.refillTimers.add(timerId);
  }

  // CPUが現在なぞっている最中のマスは、プレイヤーが入れかえ・破壊できない
  // （mixed-battle.jsの相手選択保護と同じ考え方）。CPUは入れかえを行わないため
  // 逆方向のチェックは不要。
  _isProtectedByCpu(cellIndices) {
    return cellIndices.some((i) => this.activePaths.p2.includes(i));
  }

  _destroyPlayerCell(index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.board.isSelectable(index)) return;

    if (this._isProtectedByCpu([index])) {
      if (this.swapSelections.p1 === index) this._clearSwapSelection('p1');
      this.dispatchEvent(new CustomEvent('p1destroyblocked', { detail: { index } }));
      audio.playBlocked();
      return;
    }

    this._setActivePath('p1', []);
    if (this.swapSelections.p1 === index) this._clearSwapSelection('p1');
    recordDestroy(this.stats.p1);
    this.dispatchEvent(new CustomEvent('p1destroy', { detail: { index } }));
    audio.playDestroy();

    const refills = this.board.clear([index]);
    this.dispatchEvent(new CustomEvent('sharedcellsclear', { detail: { indices: [index] } }));
    this._scheduleRefill(refills);
  }

  _handlePlayerTap(index) {
    if (this.status !== STATUS.PLAYING) return;
    if (!this.board.isSelectable(index)) return;

    this._setActivePath('p1', []);

    const current = this.swapSelections.p1;
    if (current === null) {
      this.swapSelections.p1 = index;
      this._emitSwapSelection('p1');
      audio.playSwapSelect();
      return;
    }

    if (current === index) {
      this._clearSwapSelection('p1');
      return;
    }

    this._performSwap(current, index);
  }

  _performSwap(indexA, indexB) {
    this._clearSwapSelection('p1');
    if (!this.board.isSelectable(indexA) || !this.board.isSelectable(indexB)) return;

    if (this._isProtectedByCpu([indexA, indexB])) {
      this.dispatchEvent(new CustomEvent('p1swapblocked', { detail: { indices: [indexA, indexB] } }));
      audio.playBlocked();
      return;
    }

    this.board.swapValues(indexA, indexB);
    const values = [this.board.getValue(indexA), this.board.getValue(indexB)];
    recordSwap(this.stats.p1);
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

  _applyCpuSuccess(result) {
    if (this.status !== STATUS.PLAYING) return;
    this.scores.p2 += result.points;
    applySuccess(this.stats.p2, result);
    this.dispatchEvent(new CustomEvent('p2success', { detail: result }));
    audio.playCpuSuccess(result.pathLength, result.isForty);
    if (isSilverFeverTrigger(result.pathLength, result.sum, result.isFever)) {
      this._startSilverFever('p2');
    }
    this._emitGaugeUpdate();
  }

  _applyCpuFail(indices) {
    if (this.status !== STATUS.PLAYING) return;
    recordFailure(this.stats.p2);
    this.dispatchEvent(new CustomEvent('p2fail', { detail: { indices } }));
    audio.playCpuFail();
  }

  _applyCpuDestroy(index) {
    if (this.status !== STATUS.PLAYING) return;
    recordDestroy(this.stats.p2);
    this.dispatchEvent(new CustomEvent('p2destroy', { detail: { index } }));
    audio.playCpuDestroy();
  }

  // CPUがなぞり終えた時点で、プレイヤーに先にそのマスを消されていた場合。
  // 得点なし・失敗扱いにもしない（プレイヤー側の横取り処理と対称）。
  _applyCpuStolen(indices) {
    if (this.status !== STATUS.PLAYING) return;
    this.stats.p2.stolenCancelCount += 1;
    this.dispatchEvent(new CustomEvent('p2stolen', { detail: { indices } }));
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

  // CPU側が自動オジャマの対象になった場合、見た目の種類にかかわらず
  // CPUの思考時間・なぞり操作時間を一定時間だけ遅くする。
  _applyOjamaSlowIfCpuTarget(targetActor) {
    if (targetActor !== 'p2' || !this.cpuController) return;
    this.cpuController.setSpeedMultiplier(CONFIG.ojama.cpuSlowMultiplier, CONFIG.ojama.effectDurationMs);
  }

  _timeUp() {
    this._setStatus(STATUS.ENDING);
    this.ojama.stop();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.playerInput) this.playerInput.forceCancel();
    if (this.cpuController) this.cpuController.stop();
    this._clearSwapSelection('p1');
    this._clearSilverFever('p1');
    this._clearSilverFever('p2');
    this.activePaths = { p1: [], p2: [] };
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
    if (this.scores.p1 > this.scores.p2) outcome = OUTCOME.WIN;
    else if (this.scores.p1 < this.scores.p2) outcome = OUTCOME.LOSE;
    else outcome = OUTCOME.DRAW;
    audio.playBattleResultSound(outcome === OUTCOME.WIN);

    this.dispatchEvent(new CustomEvent('result', {
      detail: {
        outcome,
        level: this.level,
        playerScore: this.scores.p1,
        cpuScore: this.scores.p2,
        playerStats: this.stats.p1,
        cpuStats: this.stats.p2,
        ojamaUsed: { p1: this.ojama.getUsedCount('p1'), p2: this.ojama.getUsedCount('p2') },
        ojamaReceived: { p1: this.ojama.getReceivedCount('p1'), p2: this.ojama.getReceivedCount('p2') },
        ojamaTotalUses: this.ojama.getTotalUsedCount()
      }
    }));
  }
}
