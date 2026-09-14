// Pointer Eventsによる、なぞり判定（仕様書 5.2章・11章、入れかえ機能）。
// DOM操作は行わず、盤面要素からのイベントを解釈して選択状態の変化をコールバックで通知する。
export class SelectionController {
  /**
   * @param {HTMLElement} boardEl
   * @param {{
   *   isSelectable: (index:number) => boolean,
   *   areAdjacent: (a:number, b:number) => boolean,
   *   maxLength: number,
   *   doubleTapThresholdMs: number,
   *   longPressThresholdMs: number,
   *   onSelectionStart: (index:number, selection:number[]) => void,
   *   onCellAdded: (index:number, selection:number[]) => void,
   *   onCellRemoved: (selection:number[]) => void,
   *   onSelectionEnd: (selection:number[]) => void,
   *   onSelectionCancel: (selection:number[]) => void,
   *   onDoubleTap: (index:number) => void,
   *   onTap: (index:number) => void,
   *   onLongPress: (index:number) => void
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
    // 1マスに触れたまま動かさずにいる時間を計る長押し検出用タイマー。
    this.longPressTimer = null;
    this.longPressFired = false;

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
    this._clearLongPressTimer();
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

  _clearLongPressTimer() {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // 1マスに触れたまま動かさず一定時間経過したら長押しとみなす。
  // 長押しは入れかえ選択を解除するための操作であり、タップ／ダブルタップとは別扱いにする。
  _startLongPressTimer(index) {
    this._clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      if (this.pointerId === null) return;
      if (this.selection.length !== 1 || this.selection[0] !== index) return;
      this.longPressFired = true;
      this.lastTapIndex = null; // 長押しはダブルタップ連鎖を断ち切る
      this.handlers.onLongPress(index);
    }, this.handlers.longPressThresholdMs);
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
    this.longPressFired = false;
    this._startLongPressTimer(index);
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

    // 2マス目へ広がった時点でなぞり動作が確定するため、長押し判定は打ち切る。
    this._clearLongPressTimer();
    this.selection.push(index);
    this.handlers.onCellAdded(index, this.selection.slice());
  }

  _finish(cancelled) {
    if (this.pointerId === null) return;
    this._clearLongPressTimer();
    const indices = this.selection.slice();
    const wasLongPress = this.longPressFired;
    this.pointerId = null;
    this.selection = [];
    this.longPressFired = false;

    if (cancelled) {
      this.lastTapIndex = null;
      this.handlers.onSelectionCancel(indices);
      return;
    }

    if (wasLongPress) {
      // 長押しの効果はonLongPress側で既に処理済み。ここでは見た目のハイライトだけ解除する。
      this.handlers.onSelectionCancel(indices);
      return;
    }

    if (indices.length === 1) {
      const index = indices[0];
      const now = performance.now();
      // 同じマスへの連続タップ（破壊操作）の判定。
      const isDoubleTap = index === this.lastTapIndex
        && now - this.lastTapTime <= this.handlers.doubleTapThresholdMs;
      if (isDoubleTap) {
        this.lastTapIndex = null;
        this.handlers.onDoubleTap(index);
        return;
      }
      this.lastTapIndex = index;
      this.lastTapTime = now;
      // ダブルタップでない単発タップは、数字入れかえの選択／実行に使う。
      this.handlers.onTap(index);
      return;
    }

    this.lastTapIndex = null;
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
