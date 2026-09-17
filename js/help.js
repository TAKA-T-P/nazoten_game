// 「あそびかた」説明ページの表示・ページ送りを管理する（あそびかた説明画面
// 改善実装指示書 32章）。説明用ミニ盤面はゲーム本体のBoard/InputController等を
// 一切生成せず、静的なHTML文字列として描画するだけで、本番の得点・保存・
// タイマーには一切影響しない（33.1章）。
import { HELP_SECTIONS } from './help-content.js';
import * as ui from './ui.js';

const state = {
  sectionId: null,
  pageIndex: 0,
  menuFocusEl: null,
  onExit: null
};

let dom = null;

function cacheDom() {
  dom = {
    backBtn: document.getElementById('btn-help-menu'),
    sectionName: document.getElementById('help-section-name'),
    pageCount: document.getElementById('help-page-count'),
    dots: document.getElementById('help-page-dots'),
    prevBtn: document.getElementById('btn-help-prev'),
    nextBtn: document.getElementById('btn-help-next'),
    content: document.getElementById('help-page-content'),
    title: document.getElementById('help-page-title'),
    demo: document.getElementById('help-page-demo'),
    body: document.getElementById('help-page-body'),
    calc: document.getElementById('help-page-calc'),
    note: document.getElementById('help-page-note')
  };
}

function isHelpPageVisible() {
  const screen = document.getElementById('screen-help-page');
  return !!screen && !screen.hidden;
}

function onKeydown(e) {
  if (!isHelpPageVisible()) return;
  if (e.key === 'ArrowLeft') goPrev();
  else if (e.key === 'ArrowRight') goNextOrMenu();
}

export function init() {
  cacheDom();
  dom.prevBtn.addEventListener('click', goPrev);
  dom.nextBtn.addEventListener('click', goNextOrMenu);
  dom.backBtn.addEventListener('click', backToMenu);
  document.addEventListener('keydown', onKeydown);
}

// menuButtonEl: セクションを開いたボタン（メニューへ戻ったときにフォーカスを戻す）。
// onExit: 指定すると、メニューへ戻る代わりにこのコールバックを呼ぶ
// （じっくりモードの初回説明から、あそびかたメニューを経由せず直接
// ステージ選択へ進むために使う。省略時は従来どおりhowto-menuへ戻る）。
export function openSection(sectionId, menuButtonEl, onExit = null) {
  state.sectionId = sectionId;
  state.pageIndex = 0;
  state.menuFocusEl = menuButtonEl || null;
  state.onExit = onExit;
  ui.showScreen('help-page');
  render();
}

function backToMenu() {
  state.sectionId = null;
  if (state.onExit) {
    const onExit = state.onExit;
    state.onExit = null;
    onExit();
    return;
  }
  ui.showScreen('howto-menu');
  if (state.menuFocusEl) state.menuFocusEl.focus();
}

function goPrev() {
  if (state.pageIndex <= 0) return;
  state.pageIndex -= 1;
  render();
}

function goNextOrMenu() {
  const pages = HELP_SECTIONS[state.sectionId].pages;
  if (state.pageIndex >= pages.length - 1) {
    backToMenu();
    return;
  }
  state.pageIndex += 1;
  render();
}

function goToPage(index) {
  state.pageIndex = index;
  render();
}

function renderTextBlock(container, lines) {
  container.innerHTML = '';
  lines.forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    container.appendChild(p);
  });
}

function renderDots(count, activeIndex) {
  dom.dots.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'help-dot' + (i === activeIndex ? ' active' : '');
    dot.setAttribute('aria-label', `ページ${i + 1}`);
    dot.setAttribute('aria-current', i === activeIndex ? 'true' : 'false');
    dot.addEventListener('click', () => goToPage(i));
    dom.dots.appendChild(dot);
  }
}

function render() {
  const section = HELP_SECTIONS[state.sectionId];
  const pages = section.pages;
  const page = pages[state.pageIndex];

  dom.sectionName.textContent = section.menuTitle;
  dom.pageCount.textContent = `${state.pageIndex + 1} / ${pages.length}`;
  renderDots(pages.length, state.pageIndex);

  dom.prevBtn.disabled = state.pageIndex === 0;
  dom.nextBtn.textContent = state.pageIndex === pages.length - 1 ? 'メニューへ' : '次へ';

  dom.title.textContent = page.title;
  dom.demo.innerHTML = renderDemo(page.id);
  renderTextBlock(dom.body, page.body);

  if (page.calc) {
    dom.calc.hidden = false;
    renderTextBlock(dom.calc, page.calc);
  } else {
    dom.calc.hidden = true;
    dom.calc.innerHTML = '';
  }

  if (page.note) {
    dom.note.hidden = false;
    renderTextBlock(dom.note, [page.note]);
  } else {
    dom.note.hidden = true;
    dom.note.innerHTML = '';
  }

  dom.title.focus();

  // ページ切り替え演出（0.15〜0.25秒程度のフェード）。クラスを一度外して
  // 強制的にリフローさせることで、同じページ内での連打時にも毎回再生させる。
  dom.content.classList.remove('help-page-anim');
  void dom.content.offsetWidth;
  dom.content.classList.add('help-page-anim');
}

// --- 説明用ミニ盤面（HTML/CSSのみ。ゲーム本体のBoard/InputControllerは使わない） ---

function cell(value, { empty, blue, red, swap, order, orderColor, extraClass } = {}) {
  const cls = ['cell'];
  if (empty) cls.push('empty');
  if (blue) cls.push('selected', 'selected-valid');
  if (red) cls.push('help-cell-red');
  if (swap) cls.push('swap-selected');
  if (extraClass) cls.push(extraClass);
  const badgeCls = orderColor === 'red' ? 'order-badge help-badge-red' : 'order-badge';
  const badge = order ? `<span class="${badgeCls}">${order}</span>` : '';
  const valueHtml = empty ? '' : `<span class="cell-value">${value}</span>`;
  return `<div class="${cls.join(' ')}">${valueHtml}${badge}</div>`;
}

function board(values, cellOptsByIndex = {}, modifier = '') {
  const cellsHtml = values.map((v, i) => cell(v, cellOptsByIndex[i] || {})).join('');
  return `<div class="help-board-frame ${modifier}"><div class="board help-board">${cellsHtml}</div></div>`;
}

function demoBasicGoal() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  return `
    <div class="help-demo-timer">残り <strong>60</strong> 秒</div>
    ${board(values)}
  `;
}

function demoBasicPath() {
  const values = [2, 3, 6, 1, 4, 5, 9, 2, 7, 8, 3, 6, 1, 9, 4, 7];
  const opts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 },
    5: { blue: true, order: 3 }
  };
  return `
    ${board(values, opts)}
    <div class="help-demo-formula">2 ＋ 3 ＋ 5 ＝ <strong>10</strong></div>
  `;
}

function demoBasicSum() {
  const values = [3, 7, 4, 2, 6, 1, 8, 5, 9, 3, 2, 7, 4, 8, 1, 6];
  const opts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 }
  };
  return `
    <div class="help-demo-float">＋20</div>
    ${board(values, opts)}
  `;
}

function demoBasicForty() {
  const values = [9, 8, 7, 3, 2, 7, 9, 4, 1, 6, 3, 5, 8, 2, 4, 1];
  const opts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 },
    2: { blue: true, order: 3 },
    6: { blue: true, order: 4 },
    5: { blue: true, order: 5 }
  };
  return `
    ${board(values, opts)}
    <div class="help-demo-banner forty">FORTY BONUS!</div>
  `;
}

function demoBasicSilver() {
  const values = [1, 2, 1, 4, 5, 3, 3, 2, 6, 8, 2, 4, 7, 1, 5, 9];
  const opts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 },
    2: { blue: true, order: 3 },
    6: { blue: true, order: 4 },
    5: { blue: true, order: 5 }
  };
  return `
    ${board(values, opts, 'is-silver')}
    <div class="help-demo-banner silver">SILVER FEVER ×2</div>
    <div class="help-demo-timer">残り <strong>10</strong> 秒</div>
  `;
}

function demoBasicMillion() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  return `
    ${board(values, {}, 'is-gold')}
    <div class="help-demo-banner gold">MILLION FEVER ×3</div>
    <div class="help-demo-timer">残り <strong>10</strong> 秒</div>
  `;
}

function demoBasicSwapDestroy() {
  return `
    <div class="help-demo-split">
      <div class="help-demo-panel">
        <p class="help-demo-panel-label">入れかえ</p>
        <div class="help-swap-demo">
          ${cell(4, { swap: true })}
          <span class="help-swap-arrow" aria-hidden="true">⇄</span>
          ${cell(8, {})}
        </div>
      </div>
      <div class="help-demo-panel">
        <p class="help-demo-panel-label">破壊</p>
        <div class="help-destroy-demo">
          ${cell(5, { extraClass: 'help-destroy-pulse' })}
          <p class="help-tap-label">タップ！タップ！</p>
        </div>
      </div>
    </div>
  `;
}

function demoScoreSplit() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  const afterOpts = { 4: { empty: true }, 5: { empty: true } };
  return `
    <div class="help-demo-split">
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-p1">P1</p>
        ${board(values, {}, 'help-board-sm')}
      </div>
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-cpu-label">CPU/P2</p>
        ${board(values, afterOpts, 'help-board-sm')}
      </div>
    </div>
  `;
}

function demoScoreCpu() {
  const playerValues = [4, 7, 2, 9, 5, 1, 8, 3, 6, 2, 9, 7, 1, 7, 4, 8];
  const playerOpts = { 0: { blue: true, order: 1 }, 1: { blue: true, order: 2 } };
  const cpuValues = [9, 8, 7, 3, 2, 7, 9, 4, 1, 6, 3, 5, 8, 2, 4, 1];
  const cpuOpts = {
    0: { red: true, order: 1, orderColor: 'red' },
    1: { red: true, order: 2, orderColor: 'red' },
    2: { red: true, order: 3, orderColor: 'red' },
    6: { red: true, order: 4, orderColor: 'red' },
    5: { red: true, order: 5, orderColor: 'red' }
  };
  return `
    <div class="help-cpu-slider">
      <span class="help-slider-end">1</span>
      <div class="help-slider-track"><div class="help-slider-thumb"></div></div>
      <span class="help-slider-end">MAX</span>
    </div>
    <div class="help-demo-split">
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-p1">プレイヤー</p>
        ${board(playerValues, playerOpts, 'help-board-sm')}
      </div>
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-cpu-label">CPU</p>
        ${board(cpuValues, cpuOpts, 'help-board-sm')}
      </div>
    </div>
  `;
}

function demoScoreTwoPlayer() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  const p1Opts = { 0: { blue: true, order: 1 }, 1: { blue: true, order: 2 } };
  return `
    <div class="help-phone-frame">
      <div class="help-phone-zone help-phone-p2">
        <p class="help-demo-panel-label help-p2">2P</p>
        ${board(values, {}, 'help-board-sm')}
      </div>
      <div class="help-phone-divider" aria-hidden="true"></div>
      <div class="help-phone-zone help-phone-p1">
        <p class="help-demo-panel-label help-p1">1P</p>
        ${board(values, p1Opts, 'help-board-sm')}
      </div>
    </div>
  `;
}

function demoScoreGauge() {
  return `
    <div class="help-gauge-demo">
      <span class="help-gauge-label-p1">1P</span>
      <div class="help-gauge-track">
        <div class="help-gauge-fill-p1" style="width:65%"></div>
        <div class="help-gauge-fill-p2" style="width:35%"></div>
      </div>
      <span class="help-gauge-label-p2">2P</span>
    </div>
    <p class="help-demo-hidden-score">得点：？？？</p>
  `;
}

function demoScoreFeverOjama() {
  const silverValues = [1, 2, 1, 4, 5, 3, 3, 2, 6, 8, 2, 4, 7, 1, 5, 9];
  const silverOpts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 },
    2: { blue: true, order: 3 },
    6: { blue: true, order: 4 },
    5: { blue: true, order: 5 }
  };
  const normalValues = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  return `
    <div class="help-demo-split">
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-p1">1P（シルバー中）</p>
        ${board(silverValues, silverOpts, 'help-board-sm is-silver')}
      </div>
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-p2">2P</p>
        ${board(normalValues, {}, 'help-board-sm')}
      </div>
    </div>
    <div class="help-ojama-banner">オジャマ！ 経過40秒・20秒で優勢側へ自動発動</div>
    <div class="help-ojama-types">
      <span class="help-ojama-chip">TURN</span>
      <span class="help-ojama-chip">SMALL</span>
      <span class="help-ojama-chip">SMILE</span>
      <span class="help-ojama-chip">METEOR</span>
      <span class="help-ojama-chip">HIDE</span>
    </div>
  `;
}

function demoScoreResult() {
  return `
    <div class="help-demo-banner timeup">TIME UP!</div>
    <div class="help-demo-split help-result-cards">
      <div class="help-result-card help-win">
        <p class="help-result-card-label">YOU</p>
        <p class="help-result-card-score">1280</p>
        <p class="help-result-card-tag">WIN!</p>
      </div>
      <div class="help-result-card">
        <p class="help-result-card-label">CPU</p>
        <p class="help-result-card-score">960</p>
      </div>
    </div>
    <p class="help-demo-lv">LV.8 ひらめきエース</p>
  `;
}

function demoMixedShared() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  const opts = { 4: { empty: true } };
  return `
    <div class="help-demo-split">
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-p1">P1画面</p>
        ${board(values, opts, 'help-board-sm')}
      </div>
      <div class="help-demo-panel">
        <p class="help-demo-panel-label help-p2">P2画面</p>
        ${board(values, opts, 'help-board-sm')}
      </div>
    </div>
    <div class="help-sync-icon" aria-hidden="true">⇄ 共有 ⇄</div>
  `;
}

function demoMixedPeek() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  const opts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 },
    2: { red: true, order: 1, orderColor: 'red' },
    6: { red: true, order: 2, orderColor: 'red' }
  };
  return board(values, opts);
}

function demoMixedRace() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  const opts = {
    0: { blue: true, order: 1 },
    1: { extraClass: 'help-cell-dual', order: 2 },
    5: { red: true, order: 1, orderColor: 'red' }
  };
  return `
    <div class="help-demo-float">＋20</div>
    ${board(values, opts)}
    <p class="help-race-caption help-p2">先に取られた！</p>
  `;
}

function demoEasyIntro() {
  const values = [3, 7, 2, 9, 5, 1];
  return board(values, {}, 'help-board-easy');
}

function demoEasyMission() {
  const values = [4, 6, 8, 2, 3, 5];
  const opts = {
    3: { blue: true, order: 1 },
    4: { blue: true, order: 2 },
    5: { blue: true, order: 3 }
  };
  return `
    ${board(values, opts, 'help-board-easy')}
    <div class="help-demo-formula">2 ＋ 3 ＋ 5 ＝ <strong>10</strong></div>
  `;
}

function demoMixedSync() {
  return `
    <div class="help-sync-grid">
      <div class="help-sync-item">
        <p class="help-sync-item-label">消去</p>
        <div class="help-mini-row">${cell(0, { empty: true })}${cell(0, { empty: true })}</div>
      </div>
      <div class="help-sync-item">
        <p class="help-sync-item-label">補充</p>
        <div class="help-mini-row">${cell(6, {})}${cell(2, {})}</div>
      </div>
      <div class="help-sync-item">
        <p class="help-sync-item-label">入れかえ</p>
        <div class="help-mini-row">${cell(4, { swap: true })}<span class="help-swap-arrow" aria-hidden="true">⇄</span>${cell(9, {})}</div>
      </div>
    </div>
    <p class="help-sync-caption">両方の画面に同時に反映</p>
  `;
}

function demoMixedProtect() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  const opts = { 5: { red: true, extraClass: 'help-protect-cell' } };
  return `
    ${board(values, opts)}
    <p class="help-protect-caption">赤＝相手が選択中（×＝入れかえ・破壊不可）</p>
  `;
}

function demoMixedFeverOjama() {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6, 2, 9, 3, 1, 7, 4, 8];
  return `
    ${board(values, {}, 'is-gold')}
    <div class="help-demo-banner gold">MILLION FEVER ×3（共通）</div>
    <div class="help-ojama-banner">オジャマ！ 経過40秒・20秒で優勢側へ自動発動</div>
    <div class="help-ojama-types">
      <span class="help-ojama-chip">TURN</span>
      <span class="help-ojama-chip">SMALL</span>
      <span class="help-ojama-chip">SMILE</span>
      <span class="help-ojama-chip">METEOR</span>
      <span class="help-ojama-chip">HIDE</span>
    </div>
  `;
}

function demoMixedResult() {
  return `
    <div class="help-demo-banner timeup">TIME UP!</div>
    <div class="help-demo-split help-result-cards">
      <div class="help-result-card help-win">
        <p class="help-result-card-label help-p1">1P</p>
        <p class="help-result-card-score">1280</p>
        <p class="help-result-card-tag">WIN!</p>
      </div>
      <div class="help-result-card">
        <p class="help-result-card-label help-p2">2P</p>
        <p class="help-result-card-score">960</p>
      </div>
    </div>
  `;
}

function demoPuzzleIntro() {
  const values = [1, 2, 1, 9, 3, 3, 8, 6, 4];
  const opts = {
    0: { blue: true, order: 1 },
    1: { blue: true, order: 2 },
    2: { blue: true, order: 3 },
    5: { blue: true, order: 4 },
    4: { blue: true, order: 5 }
  };
  return `
    <div class="help-demo-timer">せいげん時間 <strong>なし</strong></div>
    ${board(values, opts, 'help-board-sm')}
    <div class="help-demo-formula">1 ＋ 2 ＋ 1 ＋ 3 ＋ 3 ＝ <strong>10</strong></div>
  `;
}

function demoPuzzleMissions() {
  return `
    <div class="help-ojama-types">
      <span class="help-ojama-chip">指定合計</span>
      <span class="help-ojama-chip">指定マス数</span>
      <span class="help-ojama-chip">順番</span>
      <span class="help-ojama-chip">全消去</span>
    </div>
    <div class="help-demo-formula">使用手数 <strong>1</strong> / 目標 <strong>1</strong></div>
  `;
}

function demoPuzzleNoRefill() {
  const values = [1, 2, 1, 9, 3, 3, 8, 6, 4];
  const opts = { 0: { empty: true }, 1: { empty: true } };
  return `
    ${board(values, opts, 'help-board-sm')}
    <div class="help-ojama-types">
      <span class="help-ojama-chip">1手戻す</span>
      <span class="help-ojama-chip">ヒント</span>
      <span class="help-ojama-chip">やり直す</span>
    </div>
  `;
}

function demoPuzzleSwap() {
  return `
    <div class="help-swap-demo">
      ${cell(4, { swap: true })}
      <span class="help-swap-arrow" aria-hidden="true">⇄</span>
      ${cell(8, {})}
    </div>
    <p class="help-demo-hidden-score">入れかえも1手として数えます</p>
  `;
}

const DEMOS = {
  'basic-goal': demoBasicGoal,
  'basic-path': demoBasicPath,
  'basic-sum': demoBasicSum,
  'basic-forty': demoBasicForty,
  'basic-silver': demoBasicSilver,
  'basic-million': demoBasicMillion,
  'basic-swap-destroy': demoBasicSwapDestroy,
  'easy-intro': demoEasyIntro,
  'easy-mission': demoEasyMission,
  'score-split-boards': demoScoreSplit,
  'score-cpu': demoScoreCpu,
  'score-two-player': demoScoreTwoPlayer,
  'score-gauge': demoScoreGauge,
  'score-fever-ojama': demoScoreFeverOjama,
  'score-result': demoScoreResult,
  'mixed-shared-board': demoMixedShared,
  'mixed-peek': demoMixedPeek,
  'mixed-race': demoMixedRace,
  'mixed-sync': demoMixedSync,
  'mixed-protect': demoMixedProtect,
  'mixed-fever-ojama': demoMixedFeverOjama,
  'mixed-result': demoMixedResult,
  'puzzle-intro': demoPuzzleIntro,
  'puzzle-missions': demoPuzzleMissions,
  'puzzle-no-refill': demoPuzzleNoRefill,
  'puzzle-swap': demoPuzzleSwap
};

function renderDemo(id) {
  const builder = DEMOS[id];
  return builder ? builder() : '';
}
