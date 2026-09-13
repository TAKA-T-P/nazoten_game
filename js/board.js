// 盤面生成・数字管理・消去・補充を担当する（仕様書 5章・10章）。
import { CONFIG } from './config.js';

export const CELL_STATE = {
  NORMAL: 'normal',
  LOCKED: 'locked' // 消去済みで補充待ち（空欄）
};

export class Board {
  /**
   * @param {() => number} rng
   * @param {number[] | null} initialValues 指定すると、この配列で盤面を初期化する
   *   （CPUバトルでプレイヤー盤面とCPU盤面を同じ初期配置にするために使う）。
   *   省略した場合は従来どおりrngで新規生成する。
   */
  constructor(rng = Math.random, initialValues = null) {
    this.rng = rng;
    this.rows = CONFIG.boardRows;
    this.cols = CONFIG.boardCols;
    this.size = this.rows * this.cols;
    this.states = new Array(this.size).fill(CELL_STATE.NORMAL);
    this.pendingValues = new Array(this.size).fill(0);
    this.counts = {};
    for (let n = CONFIG.numberMin; n <= CONFIG.numberMax; n++) this.counts[n] = 0;

    if (initialValues) {
      this.values = initialValues.slice();
      for (const value of this.values) this.counts[value] += 1;
    } else {
      this.values = Board.createInitialValues(rng);
      for (const value of this.values) this.counts[value] += 1;
    }
  }

  // 初期盤面の25個の数字を生成する（仕様書10.1章）。盤面インスタンスを作らずに
  // 値配列だけが欲しい場合（例：CPUバトルで両者の初期配置を揃えるとき）に使う。
  static createInitialValues(rng = Math.random) {
    const size = CONFIG.boardRows * CONFIG.boardCols;
    const counts = {};
    for (let n = CONFIG.numberMin; n <= CONFIG.numberMax; n++) counts[n] = 0;

    const values = [];
    for (let i = 0; i < size; i++) {
      const candidates = [];
      for (let n = CONFIG.numberMin; n <= CONFIG.numberMax; n++) {
        if (counts[n] < CONFIG.maxSameNumber) candidates.push(n);
      }
      const idx = Math.min(Math.floor(rng() * candidates.length), candidates.length - 1);
      const value = candidates[idx];
      values.push(value);
      counts[value] += 1;
    }
    return values;
  }

  // 出現数がmaxSameNumber未満の数字だけを候補にして均等な確率で1つ選ぶ。
  _pickValue() {
    const candidates = [];
    for (let n = CONFIG.numberMin; n <= CONFIG.numberMax; n++) {
      if (this.counts[n] < CONFIG.maxSameNumber) candidates.push(n);
    }
    const idx = Math.min(Math.floor(this.rng() * candidates.length), candidates.length - 1);
    return candidates[idx];
  }

  static indexToRowCol(index) {
    return { row: Math.floor(index / CONFIG.boardCols), col: index % CONFIG.boardCols };
  }

  static areAdjacent(a, b) {
    if (a === b) return false;
    const pa = Board.indexToRowCol(a);
    const pb = Board.indexToRowCol(b);
    return Math.abs(pa.row - pb.row) + Math.abs(pa.col - pb.col) === 1;
  }

  getValue(index) {
    return this.values[index];
  }

  getState(index) {
    return this.states[index];
  }

  isSelectable(index) {
    return this.states[index] === CELL_STATE.NORMAL && this.values[index] !== 0;
  }

  // 消去を確定し、その時点で補充数字を予約する（同一数字5個制限を守るため）。
  // 戻り値: [{ index, value }] 予約された補充内容。
  clear(indices) {
    const refills = [];
    for (const index of indices) {
      const value = this.values[index];
      this.counts[value] -= 1;
      this.values[index] = 0;
      this.states[index] = CELL_STATE.LOCKED;
      const newValue = this._pickValue();
      this.counts[newValue] += 1;
      this.pendingValues[index] = newValue;
      refills.push({ index, value: newValue });
    }
    return refills;
  }

  // 予約済みの補充数字を実際に反映する。
  refill(index) {
    const value = this.pendingValues[index];
    this.values[index] = value;
    this.states[index] = CELL_STATE.NORMAL;
    this.pendingValues[index] = 0;
    return value;
  }
}
