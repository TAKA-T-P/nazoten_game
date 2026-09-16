// オジャマの判定・ボタン・抽選・解除（Phase5実装指示書16〜20章）。
// 盤面やスコアの実データには一切触れず、「誰に・いつ・どの種類の視覚効果を
// 見せるか」だけを管理する。実際の見た目の切り替えはui.js側がイベントを
// 受けて行う（盤面モデル・当たり判定・数字は変更しない）。
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
    this.buttonTimers = new Set();
    this.effectTimer = null;
    this.usedCount = { p1: 0, p2: 0 };
    this.receivedCount = { p1: 0, p2: 0 };
  }

  // 対戦開始のたびに呼ぶ。enabledがfalseなら判定・ボタン・効果を一切発生させない。
  start({ enabled, getScores, isMillionFeverActive }) {
    this._clearTimers();
    this.enabled = Boolean(enabled);
    this.getScores = getScores;
    this.isMillionFeverActive = isMillionFeverActive || (() => false);
    this.checkpoints = CONFIG.ojama.checkpointsMs.map((ms) => ({
      ms,
      evaluated: false,
      eligibleActor: null,
      buttonExpiresAt: null,
      used: false
    }));
    this.activeEffect = null;
    this.usedCount = { p1: 0, p2: 0 };
    this.receivedCount = { p1: 0, p2: 0 };
  }

  // 共通の残り時間更新のたびに呼ぶ。checkpointsMs（40秒・20秒）を初めて
  // 下回った更新でだけ、その回の判定を1回実行する（仕様書16.1章）。
  evaluate(remainingMs) {
    if (!this.enabled) return;
    for (const cp of this.checkpoints) {
      if (!cp.evaluated && remainingMs <= cp.ms) {
        this._evaluateCheckpoint(cp);
      }
    }
    // タブ復帰などでeffectTimerの発火が遅れても、期限超過を確実に検出する。
    if (this.activeEffect && performance.now() >= this.activeEffect.endsAt) {
      this._clearEffectNow();
    }
  }

  _evaluateCheckpoint(cp) {
    cp.evaluated = true;
    const scores = this.getScores();
    let eligible = null;
    if (scores.p1 < scores.p2) eligible = 'p1';
    else if (scores.p2 < scores.p1) eligible = 'p2';
    if (!eligible) return; // 同点なら対象なし（仕様書16.2章）。以後この回は判定しない。

    cp.eligibleActor = eligible;
    cp.buttonExpiresAt = performance.now() + CONFIG.ojama.buttonDurationMs;
    this.dispatchEvent(new CustomEvent('buttonshow', { detail: { actor: eligible } }));

    const timerId = setTimeout(() => {
      this.buttonTimers.delete(timerId);
      if (!cp.used) {
        this.dispatchEvent(new CustomEvent('buttonhide', { detail: { actor: eligible } }));
      }
    }, CONFIG.ojama.buttonDurationMs);
    this.buttonTimers.add(timerId);
  }

  // ボタン押下。条件を満たさない押下は無視する（仕様書17.3章）。
  use(actorId) {
    if (!this.enabled) return false;
    if (this.isMillionFeverActive()) return false;
    const now = performance.now();
    const cp = this.checkpoints.find((c) =>
      c.evaluated && !c.used && c.eligibleActor === actorId && now <= c.buttonExpiresAt
    );
    if (!cp) return false;

    cp.used = true;
    this.dispatchEvent(new CustomEvent('buttonhide', { detail: { actor: actorId } }));

    const targetActor = actorId === 'p1' ? 'p2' : 'p1';
    const types = CONFIG.ojama.types;
    const type = types[Math.floor(this.rng() * types.length)];
    this.usedCount[actorId] += 1;
    this.receivedCount[targetActor] += 1;

    this._clearEffectNow();
    this.activeEffect = { type, targetActor, endsAt: now + CONFIG.ojama.effectDurationMs };
    this.dispatchEvent(new CustomEvent('effectstart', { detail: { type, targetActor, byActor: actorId } }));

    this.effectTimer = setTimeout(() => {
      this.effectTimer = null;
      this._clearEffectNow();
    }, CONFIG.ojama.effectDurationMs);

    return true;
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

  // ミリオン・フィーバー開始時に必ず呼ぶ（仕様書19.2章）。未使用ボタン・実行中効果を
  // すべて解除する。使用回数・被オジャマ回数は取り消さない。
  forceStopForMillion() {
    for (const cp of this.checkpoints) {
      if (cp.evaluated && !cp.used) {
        this.dispatchEvent(new CustomEvent('buttonhide', { detail: { actor: cp.eligibleActor } }));
      }
    }
    this._clearTimers();
    this._clearEffectNow();
  }

  _clearTimers() {
    for (const id of this.buttonTimers) clearTimeout(id);
    this.buttonTimers.clear();
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
