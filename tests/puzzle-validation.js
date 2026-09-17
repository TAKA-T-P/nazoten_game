// じっくりモードの開発用ステージ検証（Phase 6実装指示書 18.2〜18.3章）。
// DOM/ブラウザ専用APIには依存せず、Node・ブラウザのどちらからも呼び出せる
// 純粋関数として提供する。
import { PUZZLE_STAGES } from '../js/puzzle-stages.js';
import { validateStage, validateStageList } from '../js/puzzle-solver.js';

export function runAllValidations() {
  const start = Date.now();
  const stageResults = PUZZLE_STAGES.map((stage) => {
    const stageStart = Date.now();
    const { valid, errors } = validateStage(stage);
    return {
      id: stage.id,
      valid,
      errors,
      solutionMoves: stage.officialSolution.length,
      elapsedMs: Date.now() - stageStart
    };
  });

  const listResult = validateStageList(PUZZLE_STAGES);
  const passCount = stageResults.filter((r) => r.valid).length;
  const allPass = passCount === PUZZLE_STAGES.length && listResult.valid;

  return {
    stageResults,
    listErrors: listResult.errors,
    passCount,
    totalCount: PUZZLE_STAGES.length,
    allPass,
    elapsedMs: Date.now() - start
  };
}
