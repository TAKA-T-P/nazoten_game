// オジャマの自動発動・抽選・解除。盤面やスコアの実データには一切触れず、
// 「誰に・いつ・どの種類の視覚効果を見せるか」だけを管理する。実際の見た目の
// 切り替えはui.js側がイベントを受けて行う（盤面モデル・当たり判定・数字は
// 変更しない）。ボタン操作は無く、経過20秒・40秒（＝残り40秒・20秒）の
// タイミングでその時点の勝っている側を自動的に対象にする。
import { CONFIG } from './config.js';

const ACTORS = ['p1', 'p2'];

export class OjamaController extends EventTarget {
  constructor(rng = Math.random) {
    super();
    this.rng = rng;
    this.enabled = true;
    this.getScores = () => ({ p1: 0, p2: 0 });
    this.isMillionFeverActive = () => false;
    this.checkpoints = [];
    this.activeEffect = null;
    this.effectTimer = null;
    this.usedCount = { p1: 0, p2: 0 };
    this.receivedCount = { p1: 0, p2: 0 };
  }

  // 対戦開始のたびに呼ぶ。enabledがfalseなら判定・効果を一切発生させない。
  start({ enabled, getScores, isMillionFeverActive }) {
    this._clearTimers();
    this.enabled = Boolean(enabled);
    this.getScores = getScores;
    this.isMillionFeverActive = isMillionFeverActive || (() => false);
    this.checkpoints = CONFIG.ojama.checkpointsMs.map((ms) => ({ ms, evaluated: false }));
    this.activeEffect = null;
    this.usedCount = { p1: 0, p2: 0 };
    this.receivedCount = { p1: 0, p2: 0 };
  }

  // 共通の残り時間更新のたびに呼ぶ。checkpointsMs（40秒・20秒）を初めて
  // 下回った更新でだけ、その回の自動発動を1回実行する。
  evaluate(remainingMs) {
    if (!this.enabled) return;
    for (const cp of this.checkpoints) {
      if (!cp.evaluated && remainingMs <= cp.ms) {
        this._triggerCheckpoint(cp);
      }
    }
    // タブ復帰などでeffectTimerの発火が遅れても、期限超過を確実に検出する。
    if (this.activeEffect && performance.now() >= this.activeEffect.endsAt) {
      this._clearEffectNow();
    }
  }

  // その時点で勝っている側を自動的に対象にする。同点なら発動しない。
  // ミリオン・フィーバー中は発動しない（呼び出し側が既にforceStopForMillionで
  // 打ち切っているはずだが、念のためここでも確認する）。
  _triggerCheckpoint(cp) {
    cp.evaluated = true;
    if (this.isMillionFeverActive()) return;

    const scores = this.getScores();
    let winner = null;
    if (scores.p1 > scores.p2) winner = 'p1';
    else if (scores.p2 > scores.p1) winner = 'p2';
    if (!winner) return;
    const loser = winner === 'p1' ? 'p2' : 'p1';

    const types = CONFIG.ojama.types;
    const type = types[Math.floor(this.rng() * types.length)];
    this.usedCount[loser] += 1;
    this.receivedCount[winner] += 1;

    this._clearEffectNow();
    const now = performance.now();
    this.activeEffect = { type, targetActor: winner, endsAt: now + CONFIG.ojama.effectDurationMs };
    this.dispatchEvent(new CustomEvent('effectstart', { detail: { type, targetActor: winner, byActor: loser } }));

    this.effectTimer = setTimeout(() => {
      this.effectTimer = null;
      this._clearEffectNow();
    }, CONFIG.ojama.effectDurationMs);
  }

  _clearEffectNow() {
    if (!this.activeEffect) return;
    const targetActor = this.activeEffect.targetActor;
    this.activeEffect = null;
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
      this.effectTimer = null;
    }
    this.dispatchEvent(new CustomEvent('effectend', { detail: { targetActor } }));
  }

  // ミリオン・フィーバー開始時に必ず呼ぶ。実行中の効果を打ち切る。
  // 使用回数・被オジャマ回数は取り消さない。
  forceStopForMillion() {
    this._clearTimers();
    this._clearEffectNow();
  }

  _clearTimers() {
    if (this.effectTimer) {
      clearTimeout(this.effectTimer);
      this.effectTimer = null;
    }
  }

  getUsedCount(actorId) {
    return this.usedCount[actorId] || 0;
  }

  getReceivedCount(actorId) {
    return this.receivedCount[actorId] || 0;
  }

  getTotalUsedCount() {
    return ACTORS.reduce((sum, actor) => sum + (this.usedCount[actor] || 0), 0);
  }

  stop() {
    this._clearTimers();
    this.activeEffect = null;
  }

  dispose() {
    this.stop();
  }
}
