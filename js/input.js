// Pointer Eventsによる、なぞり判定（仕様書 5.2章・11章）。
// DOM操作は行わず、盤面要素からのイベントを解釈して選択状態の変化をコールバックで通知する。
export class SelectionController {
  /**
   * @param {HTMLElement} boardEl
   * @param {{
   *   isSelectable: (index:number) => boolean,
   *   areAdjacent: (a:number, b:number) => boolean,
   *   maxLength: number,
   *   doubleTapThresholdMs: number,
   *   onSelectionStart: (index:number, selection:number[]) => void,
   *   onCellAdded: (index:number, selection:number[]) => void,
   *   onCellRemoved: (selection:number[]) => void,
   *   onSelectionEnd: (selection:number[]) => void,
   *   onSelectionCancel: (selection:number[]) => void,
   *   onDoubleTap: (index:number) => void
   * }} handlers
   */
  constructor(boardEl, handlers) {
    this.boardEl = boardEl;
    this.handlers = handlers;
    this.pointerId = null;
    this.selection = [];
    // 同じマスへの連続タップ（破壊操作）を検出するための直近タップ記録。
    this.lastTapIndex = null;
    this.lastTapTime = 0;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);

    this.boardEl.addEventListener('pointerdown', this._onPointerDown);
    this.boardEl.addEventListener('pointermove', this._onPointerMove);
    this.boardEl.addEventListener('pointerup', this._onPointerUp);
    this.boardEl.addEventListener('pointercancel', this._onPointerCancel);
  }

  destroy() {
    this.boardEl.removeEventListener('pointerdown', this._onPointerDown);
    this.boardEl.removeEventListener('pointermove', this._onPointerMove);
    this.boardEl.removeEventListener('pointerup', this._onPointerUp);
    this.boardEl.removeEventListener('pointercancel', this._onPointerCancel);
  }

  _cellIndexFromEvent(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return null;
    const cellEl = el.closest('[data-cell-index]');
    if (!cellEl || !this.boardEl.contains(cellEl)) return null;
    return Number(cellEl.dataset.cellIndex);
  }

  _onPointerDown(e) {
    if (this.pointerId !== null) return;
    const index = this._cellIndexFromEvent(e);
    if (index === null || !this.handlers.isSelectable(index)) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.boardEl.setPointerCapture(e.pointerId);
    } catch (err) {
      // キャプチャ非対応環境でも継続可能
    }
    this.selection = [index];
    this.handlers.onSelectionStart(index, this.selection.slice());
  }

  _onPointerMove(e) {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    const index = this._cellIndexFromEvent(e);
    if (index === null) return;

    const last = this.selection[this.selection.length - 1];
    if (index === last) return;

    // 直前のマスへ戻った場合のみ、最後の1マスを取り消す。
    if (this.selection.length >= 2 && index === this.selection[this.selection.length - 2]) {
      this.selection.pop();
      this.handlers.onCellRemoved(this.selection.slice());
      return;
    }

    if (this.selection.includes(index)) return;
    if (this.selection.length >= this.handlers.maxLength) return;
    if (!this.handlers.isSelectable(index)) return;
    if (!this.handlers.areAdjacent(last, index)) return;

    this.selection.push(index);
    this.handlers.onCellAdded(index, this.selection.slice());
  }

  _finish(cancelled) {
    if (this.pointerId === null) return;
    const indices = this.selection.slice();
    this.pointerId = null;
    this.selection = [];

    if (cancelled) {
      this.lastTapIndex = null;
      this.handlers.onSelectionCancel(indices);
      return;
    }

    // 1マスだけのタップが、直前のタップと同じマスへ閾値時間内に行われたら
    // 「破壊」操作として扱う（仕様: 1つの数字を連続でダブルタップすると消去できる）。
    if (indices.length === 1) {
      const index = indices[0];
      const now = performance.now();
      const isDoubleTap = index === this.lastTapIndex
        && now - this.lastTapTime <= this.handlers.doubleTapThresholdMs;
      if (isDoubleTap) {
        this.lastTapIndex = null;
        this.handlers.onDoubleTap(index);
        return;
      }
      this.lastTapIndex = index;
      this.lastTapTime = now;
    } else {
      this.lastTapIndex = null;
    }

    this.handlers.onSelectionEnd(indices);
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this._finish(false);
  }

  _onPointerCancel(e) {
    if (e.pointerId !== this.pointerId) return;
    this._finish(true);
  }

  // タイムアップなど、外部要因で選択を強制解除する（成功判定は行わない）。
  forceCancel() {
    if (this.pointerId === null) return;
    try {
      this.boardEl.releasePointerCapture(this.pointerId);
    } catch (err) {
      // 既に解放済みでも無視
    }
    this._finish(true);
  }
}
