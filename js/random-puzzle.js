// じっくり ランダム生成問題の解放・生成要求・記録（Phase 6ランダム生成問題
// 実装指示書 20・26章）。なぞり・手数・入れかえ・クリア判定は一切再実装せず、
// 実際のプレイは既存PuzzleControllerへ委譲する。生成自体は3×3/4×4盤面なら
// 数十ms程度で終わるため、専用Web Workerは使わず、生成中表示が確実に一度
// 描画されるよう1フレーム遅らせてから同期的に生成する（19.3章の代替方針）。
import { CONFIG } from './config.js';
import * as storage from './storage.js';
import { generateRandomPuzzle, formatProblemId } from './puzzle-generator.js';

export class RandomPuzzleController extends EventTarget {
  constructor() {
    super();
    this.requestId = 0;
    this.currentAreaId = null;
    this.currentPuzzle = null;
  }

  isUnlocked(areaId) {
    return storage.isRandomAreaUnlocked(areaId);
  }

  // 生成中画面を確実に描画してから、同じフレーム内で重い同期処理をしない
  // よう1フレーム遅らせて生成する。cancelGeneration()されたrequestIdの結果は
  // 画面へ反映しない（19.2章）。
  requestGenerate(areaId) {
    this.currentAreaId = areaId;
    const requestId = ++this.requestId;
    this.dispatchEvent(new CustomEvent('generatestart', { detail: { areaId } }));
    setTimeout(() => {
      if (requestId !== this.requestId) return;
      const { puzzle, usedFallback } = generateRandomPuzzle({
        areaId,
        generatorVersion: CONFIG.randomPuzzle.generatorVersion,
        config: CONFIG.randomPuzzle
      });
      if (requestId !== this.requestId) return;
      if (!puzzle) {
        this.dispatchEvent(new CustomEvent('generatefailed', { detail: { areaId } }));
        return;
      }
      this.currentPuzzle = puzzle;
      this.dispatchEvent(new CustomEvent('generated', {
        detail: { puzzle, usedFallback, problemId: formatProblemId(puzzle) }
      }));
    }, 30);
  }

  // 生成完了前に画面を離れた場合、以後その結果を無視する（19.2章）。
  cancelGeneration() {
    this.requestId++;
  }

  // 生成済みの問題でプレイを開始する。実際のなぞり進行はPuzzleController側。
  startGeneratedPuzzle(puzzleController) {
    if (!this.currentPuzzle) return false;
    storage.startRandomAttempt({
      areaId: this.currentPuzzle.areaId,
      problemId: formatProblemId(this.currentPuzzle),
      seed: this.currentPuzzle.seed
    });
    return puzzleController.startStage(this.currentPuzzle);
  }

  // クリア画面の「同じ問題」：同じseedを再利用する（6.1章）。再抽選しない。
  retrySamePuzzle(puzzleController) {
    return this.startGeneratedPuzzle(puzzleController);
  }

  // クリア画面・ステージ選択からの再入場「次のランダム」：新しいseedで別問題を作る。
  generateNextPuzzle() {
    this.requestGenerate(this.currentAreaId);
  }

  // クリア確定時に呼ぶ。固定ステージ用のスターは一切付与しない（22.2章）。
  recordClear({ movesUsed, parMoves, hintUsed }) {
    if (!this.currentPuzzle) return null;
    return storage.submitRandomClear({
      areaId: this.currentPuzzle.areaId,
      movesUsed,
      parMoves,
      hintUsed
    });
  }

  // クリアせずステージ選択・タイトルへ戻る場合に呼ぶ（23.3章）。
  abandonCurrentAttempt() {
    storage.abandonActiveRandomAttempt();
  }

  dispose() {
    this.cancelGeneration();
    this.currentPuzzle = null;
    this.currentAreaId = null;
  }
}
