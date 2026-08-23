/* =========================================================
 *  縦書きテキストエディタ
 *  Microsoft Word のような縦書き文書作成を目的とした
 *  依存ライブラリなしのシングルページアプリケーション。
 * ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
   *  小さなユーティリティ
   * --------------------------------------------------------- */
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var MM_PER_PT = 25.4 / 72;

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------------------------------------------------
   *  DOM 参照
   * --------------------------------------------------------- */
  var app       = $('.app');
  var editor    = $('#editor');
  var sheet     = $('#sheet');
  var scroller  = $('#scroller');
  var pageStyle = $('#pageStyle');
  var fileInput = $('#fileInput');
  var docTitle  = $('#docTitle');

  /* ---------------------------------------------------------
   *  用紙サイズ定義（mm）
   * --------------------------------------------------------- */
  var PAPERS = {
    a4:     { w: 210,   h: 297,   label: 'A4' },
    b5:     { w: 182,   h: 257,   label: 'B5' },
    a5:     { w: 148,   h: 210,   label: 'A5' },
    b4:     { w: 257,   h: 364,   label: 'B4' },
    letter: { w: 215.9, h: 279.4, label: 'レター' },
    hagaki: { w: 100,   h: 148,   label: 'はがき' }
  };

  var MARGIN_PRESETS = {
    normal: { top: 20, bottom: 20, right: 20, left: 20 },
    narrow: { top: 12, bottom: 12, right: 12, left: 12 },
    wide:   { top: 30, bottom: 30, right: 30, left: 30 },
    word:   { top: 35, bottom: 30, right: 30, left: 30 }
  };

  var DEFAULT_FONT =
    "'Noto Serif JP','Yu Mincho','YuMincho','Hiragino Mincho ProN','MS PMincho'," +
    "'Noto Serif CJK JP','Source Han Serif JP','IPAexMincho','IPAPMincho',serif";

  /* ---------------------------------------------------------
   *  状態
   * --------------------------------------------------------- */
  var state = {
    title: '無題の文書',
    vertical: true,
    paper: 'a4',
    orientation: 'portrait',
    marginPreset: 'normal',
    margins: { top: 20, bottom: 20, right: 20, left: 20 },
    fontFamily: DEFAULT_FONT,
    fontSize: 10.5,      /* pt */
    lineHeight: 1.9,
    letterSpacing: 0,    /* em */
    genko: false,
    guides: true,
    marks: false,
    zoom: 100
  };

  /* 原稿用紙モードに入る前の組み設定を退避しておく */
  var genkoBackup = null;

  var STORAGE_KEY = 'vertical-writing-editor/document';
  var dirty = false;

  /* =========================================================
   *  レイアウト適用
   * ========================================================= */

  /** 現在の設定から用紙の幅・高さ（mm）を求める */
  function paperSize() {
    var p = PAPERS[state.paper] || PAPERS.a4;
    return state.orientation === 'landscape'
      ? { w: p.h, h: p.w }
      : { w: p.w, h: p.h };
  }

  /** 本文領域の大きさ（mm） */
  function contentSize() {
    var p = paperSize();
    var m = state.margins;
    return {
      w: Math.max(10, p.w - m.left - m.right),
      h: Math.max(10, p.h - m.top - m.bottom)
    };
  }

  /** 1mm が何 CSS ピクセルかを実測する */
  var _mmProbe = null;
  function mmToPx(mm) {
    if (!_mmProbe) {
      _mmProbe = document.createElement('div');
      _mmProbe.style.cssText =
        'position:absolute;visibility:hidden;width:100mm;height:0;pointer-events:none;';
      document.body.appendChild(_mmProbe);
    }
    return (_mmProbe.offsetWidth / 100) * mm;
  }

  /** CSS 変数・クラス・@page を現在の状態に同期する */
  function applyLayout() {
    var p = paperSize();
    var m = state.margins;
    var root = document.documentElement.style;

    root.setProperty('--paper-w', p.w + 'mm');
    root.setProperty('--paper-h', p.h + 'mm');
    root.setProperty('--m-top', m.top + 'mm');
    root.setProperty('--m-right', m.right + 'mm');
    root.setProperty('--m-bottom', m.bottom + 'mm');
    root.setProperty('--m-left', m.left + 'mm');
    root.setProperty('--font-family', state.fontFamily);
    root.setProperty('--font-size', state.fontSize + 'pt');
    root.setProperty('--line-height', String(state.lineHeight));
    root.setProperty('--letter-spacing', state.letterSpacing ? state.letterSpacing + 'em' : '0');
    root.setProperty('--zoom', String(state.zoom / 100));

    app.classList.toggle('is-horizontal', !state.vertical);
    app.classList.toggle('is-genko', state.genko);
    app.classList.toggle('is-guides', state.guides);
    app.classList.toggle('is-marks', state.marks);

    /* 原稿用紙モードでは 1 行を 20 マスちょうどに切る */
    if (state.genko) {
      root.setProperty('--text-h', (state.fontSize * MM_PER_PT * 20) + 'mm');
    } else {
      root.removeProperty('--text-h');
    }

    /* 印刷用のページ設定。余白は用紙 (.sheet) の padding が担うので 0 にする */
    pageStyle.textContent =
      '@page{ size: ' + p.w + 'mm ' + p.h + 'mm; margin: 0; }';

    updateGridInfo();
    scheduleReflow();
  }

  /** 「◯字×◯行」表示を更新する */
  function updateGridInfo() {
    var c = contentSize();
    var cellMm = state.fontSize * MM_PER_PT;
    var pitchMm = cellMm * state.lineHeight;

    /* 行の長さ（インライン方向）と、行が並ぶ方向（ブロック方向）の寸法 */
    var inlineMm = state.genko ? cellMm * 20 : (state.vertical ? c.h : c.w);
    var blockMm = state.vertical ? c.w : c.h;

    var chars = Math.max(1, Math.floor(inlineMm / cellMm + 0.001));
    var lines = Math.max(1, Math.floor(blockMm / pitchMm + 0.001));
    var info = $('#gridInfo');
    if (info) {
      info.textContent = chars + '字 × ' + lines + '行 ＝ ' +
        (chars * lines) + '字 ／ ページ';
    }
  }

  /* =========================================================
   *  改ページと文字数の再計算
   * ========================================================= */

  /*
   * 画面に表示されているあいだに測った寸法。
   * 印刷時は本文を隠してしまい測り直せないため、この値を使う。
   */
  var metrics = { pages: 1, editorW: 0, editorH: 0 };

  var reflowTimer = null;
  function scheduleReflow() {
    if (reflowTimer) cancelAnimationFrame(reflowTimer);
    reflowTimer = requestAnimationFrame(function () {
      reflowTimer = null;
      layoutPageBreaks();
      fitSheet();
      updateMetrics();
      updateStatus();
    });
  }

  /**
   * 用紙の大きさを本文に合わせる。
   *
   * 縦書きの本文は親要素と書字方向が違う（直交フロー）ため、
   * 本文の幅（＝行が並ぶ方向の長さ）は親の幅の計算に反映されない。
   * そのままだと文章が増えるほど本文が用紙の外へはみ出してしまうので、
   * 組み直しのたびに用紙の幅を本文＋余白に合わせ直す。
   */
  function fitSheet() {
    if (!state.vertical) {
      sheet.style.width = '';
      return;
    }
    var m = state.margins;
    sheet.style.width = Math.ceil(editor.offsetWidth + mmToPx(m.left + m.right)) + 'px';
  }

  /**
   * 手動の改ページを実際に効かせる。
   * 改ページ要素の「行送り方向の幅」を、次のページ境界までの残りに広げることで
   * 後続の本文を次ページの先頭から始めさせる。
   */
  function layoutPageBreaks() {
    var breaks = $$('.page-break', editor);
    if (!breaks.length) return;

    var c = contentSize();

    if (state.vertical) {
      var pageW = mmToPx(c.w);
      breaks.forEach(function (el) {
        el.style.height = '';
        var right = el.offsetLeft + el.offsetWidth;
        var from = editor.offsetWidth - right;         /* 本文起点（右端）からの距離 */
        var rest = pageW - (from % pageW);
        if (rest >= pageW - 0.5) rest = 0;
        el.style.width = Math.max(0, rest) + 'px';
      });
    } else {
      var pageH = mmToPx(c.h);
      breaks.forEach(function (el) {
        el.style.width = '';
        var from = el.offsetTop;
        var rest = pageH - (from % pageH);
        if (rest >= pageH - 0.5) rest = 0;
        el.style.height = Math.max(0, rest) + 'px';
      });
    }
  }

  /** 画面に見えているうちに本文の大きさとページ数を測り直す */
  function updateMetrics() {
    if (!editor.offsetWidth && !editor.offsetHeight) return;   /* 非表示のときは触らない */
    var c = contentSize();
    metrics.editorW = editor.offsetWidth;
    metrics.editorH = editor.offsetHeight;
    metrics.pages = state.vertical
      ? Math.max(1, Math.ceil((metrics.editorW - 1) / mmToPx(c.w)))
      : Math.max(1, Math.ceil((metrics.editorH - 1) / mmToPx(c.h)));
  }

  /** 総ページ数 */
  function pageCount() {
    updateMetrics();
    return metrics.pages;
  }

  /** キャレットのあるページ番号 */
  function currentPage() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return 1;

    var r = sel.getRangeAt(0).cloneRange();
    var rect = r.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height && !rect.top)) return 1;

    var er = editor.getBoundingClientRect();
    var scale = state.zoom / 100;
    var c = contentSize();

    if (state.vertical) {
      var from = (er.right - rect.right) / scale;
      return clamp(Math.floor(from / mmToPx(c.w)) + 1, 1, pageCount());
    }
    var fromTop = (rect.top - er.top) / scale;
    return clamp(Math.floor(fromTop / mmToPx(c.h)) + 1, 1, pageCount());
  }

  function updateStatus() {
    var text = editor.innerText || '';
    var chars = text.replace(/\s/g, '').length;
    var paras = editor.children.length || (text.trim() ? 1 : 0);

    $('#stChars').textContent = chars.toLocaleString('ja-JP') + ' 文字';
    $('#stLines').textContent = paras + ' 段落';
    $('#stPage').textContent = currentPage() + ' / ' + pageCount() + ' ページ';

    var p = PAPERS[state.paper] || PAPERS.a4;
    $('#stMode').textContent =
      (state.vertical ? '縦書き' : '横書き') + '・' + p.label +
      ' ' + (state.orientation === 'portrait' ? '縦' : '横') +
      (state.genko ? '・原稿用紙' : '');
  }

  /* =========================================================
   *  元に戻す／やり直し
   *
   *  ルビのように execCommand では挿入できない要素があり、
   *  ブラウザ標準の履歴だけでは操作が取りこぼされてしまう。
   *  そのため本文の状態を自前で記録して履歴を一本化する。
   * ========================================================= */
  var undoStack = [];
  var redoStack = [];
  var current = null;        /* 直近まで確定している状態 */
  var burstTimer = null;     /* 連続入力を 1 操作にまとめるためのタイマー */
  var bursting = false;
  var composing = false;     /* 日本語入力の変換中は記録しない */
  var HISTORY_LIMIT = 100;

  /** 本文の先頭から数えたキャレット位置（文字数） */
  function caretOffset() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
    var range = sel.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return 0;
    var probe = document.createRange();
    probe.selectNodeContents(editor);
    probe.setEnd(range.endContainer, range.endOffset);
    return probe.toString().length;
  }

  /** 文字数で指定した位置にキャレットを戻す */
  function setCaretOffset(offset) {
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var seen = 0, node;
    while ((node = walker.nextNode())) {
      var len = node.nodeValue.length;
      if (seen + len >= offset) {
        var range = document.createRange();
        range.setStart(node, Math.max(0, offset - seen));
        range.collapse(true);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      seen += len;
    }
    editor.focus();
  }

  function snapshot() {
    return { html: editor.innerHTML, caret: caretOffset() };
  }

  function restoreSnapshot(snap) {
    editor.innerHTML = snap.html;
    find.hits = [];
    find.index = -1;
    editor.focus();
    setCaretOffset(snap.caret);
    markDirty();
    syncControls();
    scheduleReflow();
  }

  function pushHistory(snap) {
    undoStack.push(snap);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
  }

  /** 入力イベントによる変更（連続入力はひとまとめにする） */
  function noteInput() {
    if (composing) return;
    if (!bursting) {
      pushHistory(current || snapshot());
      bursting = true;
    }
    if (burstTimer) clearTimeout(burstTimer);
    burstTimer = setTimeout(function () {
      current = snapshot();
      bursting = false;
    }, 450);
  }

  /** DOM を直接書き換える操作の前後で呼ぶ */
  function beginEdit() {
    if (burstTimer) { clearTimeout(burstTimer); burstTimer = null; }
    if (bursting) { current = snapshot(); bursting = false; }
    pushHistory(current || snapshot());
  }

  function commitEdit() {
    current = snapshot();
    bursting = false;
    markDirty();
    scheduleReflow();
  }

  function undo() {
    if (burstTimer) { clearTimeout(burstTimer); burstTimer = null; }
    bursting = false;
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    var prev = undoStack.pop();
    current = prev;
    restoreSnapshot(prev);
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    var next = redoStack.pop();
    current = next;
    restoreSnapshot(next);
  }

  function resetHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    bursting = false;
    if (burstTimer) { clearTimeout(burstTimer); burstTimer = null; }
    current = snapshot();
  }

  /* =========================================================
   *  書式コマンド
   * ========================================================= */

  function focusEditor() {
    if (!editor.contains(document.activeElement) && document.activeElement !== editor) {
      editor.focus();
    }
  }

  function exec(cmd, value) {
    focusEditor();
    try {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(cmd, false, value === undefined ? null : value);
    } catch (e) { /* 一部ブラウザで未対応のコマンドは無視 */ }
    markDirty();
    refreshButtonStates();
    scheduleReflow();
  }

  function selectionText() {
    var sel = window.getSelection();
    return sel && sel.rangeCount ? sel.toString() : '';
  }

  /** 選択範囲が指定セレクタで既に包まれているか */
  function selectionWrappedBy(selector) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (!node || !node.closest || !editor.contains(node)) return null;
    return node.closest(selector);
  }

  /*
   * 縦書き専用の書式。
   *
   * Chrome の execCommand('insertHTML') は、編集用として扱わない span を
   * 「冗長な要素」とみなして取り除いてしまう（ruby 要素も同様に落とされる）。
   * そのためこれらの書式は DOM を直接組み替えて適用し、
   * 取り消しは自前の履歴（beginEdit / commitEdit）で担保する。
   *
   * class と同じ内容を style 属性にも書いておくと、
   * 書き出した HTML や Word 文書、他アプリへの貼り付けでも見た目が保たれる。
   */
  var WRAP_STYLES = {
    'tcy': 'text-combine-upright:all;-webkit-text-combine:horizontal;',
    'upright': 'text-orientation:upright;',
    'em-dot': 'text-emphasis:filled sesame;-webkit-text-emphasis:filled sesame;' +
              'text-emphasis-position:over right;-webkit-text-emphasis-position:over right;',
    'warichu': 'font-size:.5em;line-height:1.05;display:inline-block;vertical-align:middle;'
  };

  /** 要素の中身を選択状態にする */
  function selectContents(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** 選択範囲を span で包む */
  function wrapSelection(className) {
    focusEditor();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
      toast('文字を選択してから実行してください');
      return;
    }
    beginEdit();

    var range = sel.getRangeAt(0);
    var span = document.createElement('span');
    span.className = className;
    span.style.cssText = WRAP_STYLES[className] || '';

    try {
      range.surroundContents(span);
    } catch (e) {
      /* 範囲が要素の境界をまたぐ場合は取り出してから包み直す */
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }

    selectContents(span);
    commitEdit();
  }

  /** すでに包まれていれば外し、なければ包む */
  function toggleWrap(selector, className) {
    var hit = selectionWrappedBy(selector);
    if (!hit) { wrapSelection(className); return; }

    focusEditor();
    beginEdit();

    var parent = hit.parentNode;
    var first = hit.firstChild;
    var last = hit.lastChild;
    while (hit.firstChild) parent.insertBefore(hit.firstChild, hit);
    parent.removeChild(hit);

    if (first && last) {
      var range = document.createRange();
      range.setStartBefore(first);
      range.setEndAfter(last);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    commitEdit();
  }

  /** フォントサイズの適用（選択範囲があれば選択範囲、なければ本文既定） */
  function applyFontSize(pt) {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
      focusEditor();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontSize', false, '7');   /* いったん最大値を割り当てる */
      /* execCommand が付けた印を実際の pt 値に置き換える */
      $$('span', editor).forEach(function (s) {
        if (s.style.fontSize === 'xxx-large' || s.style.fontSize === '-webkit-xxx-large') {
          s.style.fontSize = pt + 'pt';
        }
      });
      $$('font[size="7"]', editor).forEach(function (f) {
        var span = document.createElement('span');
        span.style.fontSize = pt + 'pt';
        while (f.firstChild) span.appendChild(f.firstChild);
        f.parentNode.replaceChild(span, f);
      });
      markDirty();
    } else {
      state.fontSize = pt;
      applyLayout();
      markDirty();
    }
    scheduleReflow();
  }

  function applyFontFamily(family) {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
      exec('fontName', family);
    } else {
      state.fontFamily = family;
      applyLayout();
      markDirty();
    }
  }

  var SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
  function stepFontSize(dir) {
    var cur = parseFloat($('#fontSize').value) || state.fontSize;
    var i = SIZES.indexOf(cur);
    if (i < 0) {
      i = 0;
      while (i < SIZES.length - 1 && SIZES[i] < cur) i++;
    }
    var next = SIZES[clamp(i + dir, 0, SIZES.length - 1)];
    $('#fontSize').value = String(next);
    applyFontSize(next);
  }

  /** ツールバーの ON/OFF 表示を選択位置に合わせる */
  function refreshButtonStates() {
    $$('.btn--state').forEach(function (b) {
      var cmd = b.getAttribute('data-exec');
      var on = false;
      try { on = document.queryCommandState(cmd); } catch (e) { on = false; }
      b.classList.toggle('is-on', !!on);
    });
  }

  /* =========================================================
   *  縦書き特有の書式
   * ========================================================= */

  function insertRuby() {
    var base = selectionText();
    if (!base) { toast('ルビを振る文字を選択してください'); return; }
    var saved = saveSelection();
    openModal('ルビ（ふりがな）', [
      { key: 'rt', label: '「' + base + '」の読み', value: '' }
    ], function (vals) {
      var reading = (vals.rt || '').trim();
      if (!reading) return;
      restoreSelection(saved);

      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      beginEdit();

      var range = sel.getRangeAt(0);
      range.deleteContents();

      var ruby = document.createElement('ruby');
      ruby.appendChild(document.createTextNode(base));
      var rt = document.createElement('rt');
      rt.textContent = reading;
      ruby.appendChild(rt);
      range.insertNode(ruby);

      /* ルビの直後にキャレットを置く */
      range.setStartAfter(ruby);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);

      commitEdit();
    });
  }

  function insertWarichu() {
    if (!selectionText()) { toast('割注にする文字を選択してください'); return; }
    wrapSelection('warichu');
  }

  /* =========================================================
   *  挿入
   * ========================================================= */

  function insertHtmlAtCaret(html) {
    focusEditor();
    document.execCommand('insertHTML', false, html);
    markDirty();
    scheduleReflow();
  }

  function insertPageBreak() {
    insertHtmlAtCaret('<div class="page-break"><br></div><p><br></p>');
  }

  var ERA_START = new Date(2019, 4, 1); /* 令和元年 5月1日 */
  function japaneseDate(d) {
    if (d >= ERA_START) {
      var y = d.getFullYear() - 2018;
      return '令和' + (y === 1 ? '元' : toKanjiNumber(y)) + '年' +
        toKanjiNumber(d.getMonth() + 1) + '月' + toKanjiNumber(d.getDate()) + '日';
    }
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /** 1〜99 程度を漢数字に（日付用） */
  function toKanjiNumber(n) {
    var d = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n < 10) return d[n];
    if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
    var t = Math.floor(n / 10);
    return d[t] + '十' + (n % 10 ? d[n % 10] : '');
  }

  function insertDate() {
    var now = new Date();
    var formats = {
      era:   japaneseDate(now),
      ad:    now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日',
      slash: now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate()
    };
    var saved = saveSelection();

    openModal('日付の挿入', [
      {
        key: 'fmt', label: '書式', type: 'select', options: [
          { value: 'era',   label: formats.era },
          { value: 'ad',    label: formats.ad },
          { value: 'slash', label: formats.slash }
        ]
      }
    ], function (vals) {
      restoreSelection(saved);
      insertHtmlAtCaret(escapeHtml(formats[vals.fmt] || formats.era));
    });
  }

  function insertTime() {
    var now = new Date();
    var hh = now.getHours(), mm = now.getMinutes();
    insertHtmlAtCaret(
      escapeHtml(toKanjiNumber(hh) + '時' + (mm ? toKanjiNumber(mm) + '分' : ''))
    );
  }

  /* =========================================================
   *  検索と置換
   * ========================================================= */
  var find = { term: '', hits: [], index: -1 };

  function clearHighlights() {
    var spans = $$('.find-hit', editor);
    if (!spans.length) return;
    spans.forEach(function (s) {
      var parent = s.parentNode;
      if (!parent) return;
      while (s.firstChild) parent.insertBefore(s.firstChild, s);
      parent.removeChild(s);
      parent.normalize();
    });
    find.hits = [];
    find.index = -1;
  }

  function runFind(term) {
    clearHighlights();
    find.term = term;
    if (!term) { $('#findCount').textContent = ''; return; }

    /* 先にテキストノードを集めてから加工する（走査中の変更を避ける） */
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var at = text.indexOf(term);
      if (at < 0) return;
      var target = node;
      while (at >= 0) {
        var range = document.createRange();
        range.setStart(target, at);
        range.setEnd(target, at + term.length);
        var span = document.createElement('span');
        span.className = 'find-hit';
        try { range.surroundContents(span); } catch (e) { break; }
        find.hits.push(span);
        target = span.nextSibling;
        if (!target || target.nodeType !== 3) break;
        at = target.nodeValue.indexOf(term);
      }
    });

    find.index = find.hits.length ? 0 : -1;
    highlightCurrent();
  }

  function highlightCurrent() {
    $$('.find-hit', editor).forEach(function (s) { s.classList.remove('is-current'); });
    var count = $('#findCount');
    if (find.index < 0 || !find.hits.length) {
      count.textContent = find.term ? '見つかりません' : '';
      return;
    }
    var cur = find.hits[find.index];
    cur.classList.add('is-current');
    cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    count.textContent = (find.index + 1) + ' / ' + find.hits.length + ' 件';
  }

  function moveFind(dir) {
    if (!find.hits.length) { runFind($('#findInput').value); return; }
    find.index = (find.index + dir + find.hits.length) % find.hits.length;
    highlightCurrent();
  }

  function replaceCurrent() {
    if (find.index < 0 || !find.hits.length) return;
    var span = find.hits[find.index];
    var replacement = $('#replaceInput').value;
    var range = document.createRange();
    range.selectNode(span);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    focusEditor();
    document.execCommand('insertText', false, replacement);
    markDirty();
    var keep = find.index;
    runFind(find.term);
    if (find.hits.length) {
      find.index = Math.min(keep, find.hits.length - 1);
      highlightCurrent();
    }
    scheduleReflow();
  }

  function replaceAll() {
    var term = $('#findInput').value;
    if (!term) return;
    var replacement = $('#replaceInput').value;
    clearHighlights();
    beginEdit();
    var count = 0;
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (node.nodeValue.indexOf(term) < 0) return;
      var parts = node.nodeValue.split(term);
      count += parts.length - 1;
      node.nodeValue = parts.join(replacement);
    });
    $('#findCount').textContent = count + ' 件を置換しました';
    commitEdit();
  }

  function openFindBar() {
    $('#findBar').hidden = false;
    $('#findInput').focus();
    $('#findInput').select();
  }

  function closeFindBar() {
    clearHighlights();
    $('#findBar').hidden = true;
    $('#findCount').textContent = '';
    focusEditor();
  }

  /* =========================================================
   *  選択範囲の保存と復元（モーダル表示のため）
   * ========================================================= */
  function saveSelection() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0);
    return editor.contains(r.commonAncestorContainer) ? r.cloneRange() : null;
  }

  function restoreSelection(range) {
    if (!range) { focusEditor(); return; }
    editor.focus();
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* =========================================================
   *  モーダルとトースト
   * ========================================================= */
  var modalCallback = null;

  function openModal(title, fields, onOk) {
    var body = $('#modalBody');
    $('#modalTitle').textContent = title;
    body.innerHTML = '';

    fields.forEach(function (f) {
      var label = document.createElement('label');
      label.textContent = f.label;
      var input;
      if (f.type === 'select') {
        input = document.createElement('select');
        f.options.forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = f.value || '';
      }
      input.className = 'ctl';
      input.setAttribute('data-key', f.key);
      label.appendChild(input);
      body.appendChild(label);
    });

    modalCallback = onOk;
    $('#modal').hidden = false;
    var first = body.querySelector('.ctl');
    if (first) first.focus();
  }

  function closeModal() {
    $('#modal').hidden = true;
    modalCallback = null;
  }

  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* =========================================================
   *  ファイル操作
   * ========================================================= */

  function documentHtml() {
    clearHighlights();
    return editor.innerHTML;
  }

  function serialize() {
    return JSON.stringify({
      format: 'vertical-writing-editor',
      version: 1,
      title: state.title,
      settings: {
        vertical: state.vertical,
        paper: state.paper,
        orientation: state.orientation,
        marginPreset: state.marginPreset,
        margins: state.margins,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        letterSpacing: state.letterSpacing,
        genko: state.genko
      },
      html: documentHtml()
    }, null, 2);
  }

  function deserialize(json) {
    var data = JSON.parse(json);
    if (data.settings) {
      Object.keys(data.settings).forEach(function (k) {
        if (k in state) state[k] = data.settings[k];
      });
    }
    if (data.title) state.title = data.title;
    editor.innerHTML = data.html || '<p><br></p>';
    syncControls();
    applyLayout();
    resetHistory();
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function safeName() {
    return (state.title || '無題の文書').replace(/[\\/:*?"<>|]/g, '_');
  }

  function saveJson() {
    download(safeName() + '.json', serialize(), 'application/json');
    setSaved();
  }

  /**
   * 本文をプレーンテキストにする。
   * ルビは innerText だと本文に混ざってしまうため「漢字（かんじ）」の形に直す。
   */
  function plainText() {
    var clone = editor.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('ruby'), function (ruby) {
      var rt = ruby.querySelector('rt');
      var reading = rt ? rt.textContent : '';
      if (rt) rt.parentNode.removeChild(rt);
      Array.prototype.forEach.call(ruby.querySelectorAll('rp'), function (rp) {
        rp.parentNode.removeChild(rp);
      });
      var text = ruby.textContent + (reading ? '（' + reading + '）' : '');
      ruby.parentNode.replaceChild(document.createTextNode(text), ruby);
    });

    /* innerText は画面に出ている要素にしか使えないので、一時的に本文の隣に置く */
    clone.style.cssText = 'position:absolute;left:-9999px;top:0;width:auto;height:auto;';
    clone.removeAttribute('contenteditable');
    document.body.appendChild(clone);
    var text = clone.innerText;
    document.body.removeChild(clone);
    return text.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function exportTxt() {
    clearHighlights();
    download(safeName() + '.txt', plainText(), 'text/plain');
  }

  /** 本文をそのまま開ける単体 HTML を書き出す */
  function exportHtml() {
    var p = paperSize();
    var m = state.margins;
    var c = contentSize();
    var wm = state.vertical ? 'vertical-rl' : 'horizontal-tb';

    var css = [
      '@page{size:' + p.w + 'mm ' + p.h + 'mm;margin:0;}',
      'body{margin:0;background:#7c7c7c;font-family:' + state.fontFamily + ';}',
      '.sheet{background:#fff;margin:24px auto;box-shadow:0 2px 10px rgba(0,0,0,.4);',
      'padding:' + m.top + 'mm ' + m.right + 'mm ' + m.bottom + 'mm ' + m.left + 'mm;',
      'width:max-content;}',
      '.doc{writing-mode:' + wm + ';text-orientation:mixed;',
      state.vertical ? 'height:' + c.h + 'mm;min-width:' + c.w + 'mm;'
                     : 'width:' + c.w + 'mm;min-height:' + c.h + 'mm;',
      'font-size:' + state.fontSize + 'pt;line-height:' + state.lineHeight + ';',
      'letter-spacing:' + (state.letterSpacing || 0) + 'em;}',
      '.doc p{margin:0;text-indent:1em;}',
      '.doc .tcy{text-combine-upright:all;-webkit-text-combine:horizontal;}',
      '.doc .upright{text-orientation:upright;}',
      '.doc .em-dot{text-emphasis:filled sesame;text-emphasis-position:over right;}',
      '.doc rt{font-size:.5em;}',
      '.doc .warichu{font-size:.5em;line-height:1.05;display:inline-block;vertical-align:middle;}',
      '.doc .page-break{break-after:page;}',
      '@media print{body{background:#fff;}.sheet{margin:0;box-shadow:none;}}'
    ].join('');

    var html = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n' +
      '<title>' + escapeHtml(state.title) + '</title>\n<style>' + css + '</style>\n</head>\n' +
      '<body>\n<div class="sheet"><div class="doc" data-vwe-content="1">\n' +
      documentHtml() + '\n</div></div>\n</body>\n</html>\n';

    download(safeName() + '.html', html, 'text/html');
  }

  /**
   * Word で開ける HTML（.doc）を書き出す。
   * Word 独自の mso-layout-flow-alt を使って縦書きの本文として読み込ませる。
   * 罫線やルビなど一部の表現は Word 側の対応範囲に依存する。
   */
  function exportDoc() {
    var p = paperSize();
    var m = state.margins;
    var flow = state.vertical
      ? 'layout-flow:vertical-ideographic;mso-layout-flow-alt:vertical-ideographic;'
      : '';

    var head =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<title>' + escapeHtml(state.title) + '</title>\n' +
      '<!--[if gte mso 9]><xml><w:WordDocument>' +
      '<w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->\n' +
      '<style>\n' +
      '@page Section1{size:' + p.w + 'mm ' + p.h + 'mm;' +
      'margin:' + m.top + 'mm ' + m.right + 'mm ' + m.bottom + 'mm ' + m.left + 'mm;' +
      'mso-page-orientation:' + state.orientation + ';}\n' +
      'div.Section1{page:Section1;' + flow + '}\n' +
      'body{font-family:' + state.fontFamily + ';font-size:' + state.fontSize + 'pt;' +
      'line-height:' + state.lineHeight + ';}\n' +
      'p{margin:0;text-indent:1em;}\n' +
      '.tcy{mso-text-combine:all;text-combine-upright:all;}\n' +
      '.em-dot{text-emphasis:filled sesame;}\n' +
      '.page-break{page-break-after:always;mso-special-character:line-break;}\n' +
      '</style>\n</head>\n';

    var body = '<body>\n<div class="Section1" style="' + flow + '">\n' +
      documentHtml() + '\n</div>\n</body>\n</html>\n';

    download(safeName() + '.doc', head + body, 'application/msword');
    toast('Word 形式で書き出しました（縦書き設定は Word 側の対応に依存します）');
  }

  function newDocument() {
    if (dirty && !window.confirm('保存していない変更があります。新規作成しますか？')) return;
    editor.innerHTML = '<p><br></p>';
    state.title = '無題の文書';
    docTitle.value = state.title;
    setSaved();
    applyLayout();
    resetHistory();
    focusEditor();
  }

  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result);
      var name = file.name.replace(/\.[^.]+$/, '');
      try {
        if (/\.json$/i.test(file.name)) {
          deserialize(text);
        } else if (/\.(html?|doc)$/i.test(file.name)) {
          var doc = new DOMParser().parseFromString(text, 'text/html');
          var content = doc.querySelector('[data-vwe-content]') ||
                        doc.querySelector('.Section1') || doc.body;
          editor.innerHTML = content ? content.innerHTML : '';
          state.title = name;
        } else {
          editor.innerHTML = text.split(/\r?\n/).map(function (line) {
            return '<p>' + (escapeHtml(line) || '<br>') + '</p>';
          }).join('');
          state.title = name;
        }
        docTitle.value = state.title;
        setSaved();
        applyLayout();
        resetHistory();
        toast('「' + file.name + '」を読み込みました');
      } catch (e) {
        toast('読み込みに失敗しました: ' + e.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  /**
   * 印刷用のページを組み立てる。
   *
   * 本文は 1 本の長い流れとして持っているので、ページごとに
   * 「1 ページ分の窓」を作り、その中で本文を 1 ページずつずらして置く。
   * こうすると画面のページ区切りと印刷結果が必ず一致する。
   */
  function buildPrintPages() {
    var host = $('#printArea');
    host.innerHTML = '';

    var c = contentSize();
    var stepPx = state.vertical ? mmToPx(c.w) : mmToPx(c.h);
    var total = metrics.pages;

    for (var i = 0; i < total; i++) {
      var page = document.createElement('div');
      page.className = 'print-page';

      var clip = document.createElement('div');
      clip.className = 'print-clip';

      var clone = editor.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('contenteditable');
      clone.removeAttribute('spellcheck');

      if (state.vertical) {
        /* 行は右から左へ進むので、ページごとに右へずらして窓の位置を送る */
        clone.style.width = metrics.editorW + 'px';
        clone.style.top = '0';
        clone.style.right = (-i * stepPx) + 'px';
      } else {
        clone.style.height = metrics.editorH + 'px';
        clone.style.left = '0';
        clone.style.top = (-i * stepPx) + 'px';
      }

      clip.appendChild(clone);
      page.appendChild(clip);
      host.appendChild(page);
    }
  }

  function clearPrintPages() {
    $('#printArea').innerHTML = '';
  }

  function printDocument() {
    clearHighlights();
    layoutPageBreaks();
    fitSheet();
    updateMetrics();
    buildPrintPages();
    window.print();
  }

  /* =========================================================
   *  自動保存
   * ========================================================= */
  var autosaveTimer = null;

  function markDirty() {
    dirty = true;
    $('#saveState').textContent = '編集中…';
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosave, 1200);
  }

  function setSaved() {
    dirty = false;
    $('#saveState').textContent = '保存済み';
  }

  function autosave() {
    try {
      localStorage.setItem(STORAGE_KEY, serialize());
      $('#saveState').textContent = '自動保存しました ' +
        new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      dirty = false;
    } catch (e) {
      $('#saveState').textContent = '自動保存できません';
    }
  }

  function restoreAutosave() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { saved = null; }
    if (!saved) return false;
    try {
      deserialize(saved);
      docTitle.value = state.title;
      setSaved();
      return true;
    } catch (e) {
      return false;
    }
  }

  /* =========================================================
   *  コントロールと状態の同期
   * ========================================================= */
  function syncControls() {
    $('#writingMode').value = state.vertical ? 'vertical' : 'horizontal';
    $('#paperSize').value = state.paper;
    $('#orientation').value = state.orientation;
    $('#marginPreset').value = state.marginPreset;
    $('#mTop').value = state.margins.top;
    $('#mBottom').value = state.margins.bottom;
    $('#mRight').value = state.margins.right;
    $('#mLeft').value = state.margins.left;
    ensureSizeOption(state.fontSize);
    $('#fontSize').value = String(state.fontSize);
    $('#lineHeight').value = String(state.lineHeight);
    $('#letterSpacing').value = String(state.letterSpacing);
    $('#genkoMode').checked = state.genko;
    $('#showGuides').checked = state.guides;
    $('#showMarks').checked = state.marks;
    $('#zoomRange').value = String(state.zoom);
    $('#zoomVal').textContent = state.zoom + '%';
    $('#stZoom').textContent = state.zoom + '%';

    var ff = $('#fontFamily');
    var matched = false;
    $$('option', ff).forEach(function (o) {
      if (o.value === state.fontFamily) { ff.value = o.value; matched = true; }
    });
    if (!matched) ff.selectedIndex = 0;
  }

  /** 一覧にないサイズ（原稿用紙モードなど）を選択欄に追加する */
  function ensureSizeOption(pt) {
    var sel = $('#fontSize');
    var value = String(pt);
    var exists = $$('option', sel).some(function (o) { return o.value === value; });
    if (exists) return;
    var opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    sel.appendChild(opt);
  }

  function setZoom(z) {
    state.zoom = clamp(Math.round(z), 50, 200);
    $('#zoomRange').value = String(state.zoom);
    $('#zoomVal').textContent = state.zoom + '%';
    $('#stZoom').textContent = state.zoom + '%';
    document.documentElement.style.setProperty('--zoom', String(state.zoom / 100));
  }

  /**
   * 原稿用紙モード。
   * 20 字 × 20 行が本文領域に収まる正方形のマスを求め、
   * 字送りと行送りを同じ大きさに揃えてマス目と本文を一致させる。
   */
  function setGenko(on) {
    if (on) {
      /* すでに原稿用紙モードのまま用紙を変えたときに元の値を失わないようにする */
      if (!genkoBackup) {
        genkoBackup = { fontSize: state.fontSize, lineHeight: state.lineHeight,
                        letterSpacing: state.letterSpacing };
      }
      var c = contentSize();
      var cellMm = Math.min(c.h, c.w) / 20;
      state.fontSize = Math.round((cellMm / MM_PER_PT) * 100) / 100;
      state.lineHeight = 1;
      state.letterSpacing = 0;
    } else if (genkoBackup) {
      state.fontSize = genkoBackup.fontSize;
      state.lineHeight = genkoBackup.lineHeight;
      state.letterSpacing = genkoBackup.letterSpacing;
      genkoBackup = null;
    }
    state.genko = on;
    syncControls();
    applyLayout();
    markDirty();
  }

  /* =========================================================
   *  コマンド割り当て
   * ========================================================= */
  var COMMANDS = {
    'undo': undo,
    'redo': redo,
    'size-up': function () { stepFontSize(1); },
    'size-down': function () { stepFontSize(-1); },
    'clear-format': function () {
      exec('removeFormat');
      /* 入れ子になっている縦書き書式を外側から順に外す（念のため回数を制限する） */
      for (var i = 0; i < 8; i++) {
        if (!selectionWrappedBy('.tcy,.em-dot,.warichu,.upright')) break;
        toggleWrap('.tcy,.em-dot,.warichu,.upright', '');
      }
    },
    'ruby': insertRuby,
    'tcy': function () { toggleWrap('.tcy', 'tcy'); },
    'upright': function () { toggleWrap('.upright', 'upright'); },
    'emphasis': function () { toggleWrap('.em-dot', 'em-dot'); },
    'warichu': insertWarichu,
    'page-break': insertPageBreak,
    'line-break': function () { insertHtmlAtCaret('<br>'); },
    'hr': function () { insertHtmlAtCaret('<hr>'); },
    'ins-date': insertDate,
    'ins-time': insertTime,
    'find': openFindBar,
    'find-close': closeFindBar,
    'find-next': function () { moveFind(1); },
    'find-prev': function () { moveFind(-1); },
    'replace-one': replaceCurrent,
    'replace-all': replaceAll,
    'file-new': newDocument,
    'file-open': function () { fileInput.click(); },
    'file-save': saveJson,
    'export-txt': exportTxt,
    'export-html': exportHtml,
    'export-doc': exportDoc,
    'print': printDocument,
    'zoom-in': function () { setZoom(state.zoom + 10); },
    'zoom-out': function () { setZoom(state.zoom - 10); },
    'zoom-reset': function () { setZoom(100); }
  };

  /* =========================================================
   *  イベント登録
   * ========================================================= */
  function bindEvents() {

    /* リボンのタブ切り替え */
    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.tab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        $$('.ribbon__panel').forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-panel') === tab.getAttribute('data-tab'));
        });
      });
    });

    /* data-exec / data-cmd ボタン */
    document.addEventListener('mousedown', function (e) {
      var btn = e.target.closest('[data-exec],[data-cmd],[data-char]');
      /* 押した瞬間に本文の選択が消えないようフォーカス移動を止める */
      if (btn && !btn.closest('.findbar') && !btn.closest('.modal')) e.preventDefault();
    });

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-exec]');
      if (el) { exec(el.getAttribute('data-exec')); return; }

      var cmdEl = e.target.closest('[data-cmd]');
      if (cmdEl) {
        var fn = COMMANDS[cmdEl.getAttribute('data-cmd')];
        if (fn) fn();
        return;
      }

      var ch = e.target.closest('[data-char]');
      if (ch) insertHtmlAtCaret(escapeHtml(ch.getAttribute('data-char')));
    });

    /* フォント関連 */
    $('#fontFamily').addEventListener('change', function () { applyFontFamily(this.value); });
    $('#fontSize').addEventListener('change', function () {
      applyFontSize(parseFloat(this.value) || 10.5);
    });
    $('#foreColor').addEventListener('input', function () { exec('foreColor', this.value); });
    $('#hiliteColor').addEventListener('input', function () {
      focusEditor();
      document.execCommand('styleWithCSS', false, true);
      if (!document.execCommand('hiliteColor', false, this.value)) {
        document.execCommand('backColor', false, this.value);
      }
      markDirty();
    });

    /* 文字組み */
    $('#lineHeight').addEventListener('change', function () {
      state.lineHeight = parseFloat(this.value); applyLayout(); markDirty();
    });
    $('#letterSpacing').addEventListener('change', function () {
      state.letterSpacing = parseFloat(this.value); applyLayout(); markDirty();
    });

    /* ページ設定 */
    $('#writingMode').addEventListener('change', function () {
      state.vertical = this.value === 'vertical';
      applyLayout(); markDirty();
    });
    $('#paperSize').addEventListener('change', function () {
      state.paper = this.value;
      if (state.genko) setGenko(true); else { applyLayout(); markDirty(); }
    });
    $('#orientation').addEventListener('change', function () {
      state.orientation = this.value;
      if (state.genko) setGenko(true); else { applyLayout(); markDirty(); }
    });
    $('#marginPreset').addEventListener('change', function () {
      state.marginPreset = this.value;
      var preset = MARGIN_PRESETS[this.value];
      if (preset) state.margins = { top: preset.top, bottom: preset.bottom,
                                    right: preset.right, left: preset.left };
      syncControls();
      if (state.genko) setGenko(true); else { applyLayout(); markDirty(); }
    });
    ['mTop', 'mBottom', 'mRight', 'mLeft'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () {
        var key = id.slice(1).toLowerCase();
        state.margins[key] = clamp(parseFloat(this.value) || 0, 0, 80);
        state.marginPreset = 'custom';
        $('#marginPreset').value = 'custom';
        if (state.genko) setGenko(true); else { applyLayout(); markDirty(); }
      });
    });

    /* 表示 */
    $('#genkoMode').addEventListener('change', function () { setGenko(this.checked); });
    $('#showGuides').addEventListener('change', function () {
      state.guides = this.checked; applyLayout();
    });
    $('#showMarks').addEventListener('change', function () {
      state.marks = this.checked; applyLayout();
    });
    $('#focusMode').addEventListener('change', function () {
      app.classList.toggle('is-focus', this.checked);
      scheduleReflow();
    });
    $('#zoomRange').addEventListener('input', function () { setZoom(parseInt(this.value, 10)); });

    /* 文書名 */
    docTitle.addEventListener('input', function () { state.title = this.value; markDirty(); });

    /* 本文 */
    editor.addEventListener('input', function () {
      if (find.hits.length) clearHighlights();
      noteInput();
      markDirty();
      scheduleReflow();
    });
    editor.addEventListener('compositionstart', function () { composing = true; });
    editor.addEventListener('compositionend', function () {
      composing = false;
      noteInput();
    });
    editor.addEventListener('keyup', function () { updateStatus(); });
    editor.addEventListener('click', function () { updateStatus(); refreshButtonStates(); });

    document.addEventListener('selectionchange', function () {
      if (!editor.contains(document.getSelection().anchorNode)) return;
      refreshButtonStates();
    });

    /* 貼り付けは書式なしを既定にする（Word からの貼り付け崩れを避ける） */
    editor.addEventListener('paste', function (e) {
      if (e.clipboardData) {
        e.preventDefault();
        var text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }
    });

    /* 検索バー */
    $('#findInput').addEventListener('input', function () { runFind(this.value); });
    $('#findInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); moveFind(e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') closeFindBar();
    });
    $('#replaceInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); }
      if (e.key === 'Escape') closeFindBar();
    });

    /* モーダル */
    $('#modalOk').addEventListener('click', function () {
      var vals = {};
      $$('#modalBody [data-key]').forEach(function (el) {
        vals[el.getAttribute('data-key')] = el.value;
      });
      var cb = modalCallback;
      closeModal();
      if (cb) cb(vals);
    });
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
    $('#modalBody').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#modalOk').click(); }
    });

    /* ファイル入力とドラッグ＆ドロップ */
    fileInput.addEventListener('change', function () {
      if (this.files && this.files[0]) openFile(this.files[0]);
      this.value = '';
    });
    ['dragover', 'drop'].forEach(function (type) {
      window.addEventListener(type, function (e) {
        e.preventDefault();
        if (type === 'drop' && e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]);
      });
    });

    /* キーボードショートカット */
    document.addEventListener('keydown', function (e) {
      var ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      var key = e.key.toLowerCase();
      if (key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (key === 's') { e.preventDefault(); saveJson(); }
      else if (key === 'o') { e.preventDefault(); fileInput.click(); }
      else if (key === 'p') { e.preventDefault(); printDocument(); }
      else if (key === 'f') { e.preventDefault(); openFindBar(); }
      else if (key === 'h') { e.preventDefault(); openFindBar(); $('#replaceInput').focus(); }
      else if (key === 'n' && e.altKey) { e.preventDefault(); newDocument(); }
      else if (e.key === 'Enter') { e.preventDefault(); insertPageBreak(); }
      else if (key === 'y') { e.preventDefault(); redo(); }
    });

    window.addEventListener('resize', scheduleReflow);
    window.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
    /* ブラウザのメニューから印刷された場合にもページを用意する */
    window.addEventListener('beforeprint', function () {
      clearHighlights();
      if (!$('#printArea').children.length) buildPrintPages();
    });
    window.addEventListener('afterprint', clearPrintPages);
  }

  /* =========================================================
   *  初期文書
   * ========================================================= */
  var SAMPLE =
    '<h1>縦書きエディタ</h1>' +
    '<p class="noindent">この画面は、右から左へ流れる<span class="em-dot">縦書き</span>の原稿用の編集画面です。' +
    'ふつうのワープロと同じように文字を入力し、リボンから書式を選べます。</p>' +
    '<p>行が用紙の左端まで届くと、自動的に次のページへ折り返します。' +
    '<ruby>頁<rt>ページ</rt></ruby>の区切りは薄い罫線で示され、' +
    '「レイアウト」タブから用紙の大きさや余白を変えられます。</p>' +
    '<p>半角の数字は<span class="tcy">21</span>のようにまとめて横に組めます（縦中横）。' +
    '強調したい語には圏点、読みにくい語にはルビを振ってください。</p>' +
    '<p class="noindent">　―― 「ホーム」タブの各ボタンを試してみてください。</p>';

  /* =========================================================
   *  起動
   * ========================================================= */
  function init() {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}

    bindEvents();

    if (!restoreAutosave()) {
      editor.innerHTML = SAMPLE;
      docTitle.value = state.title;
      syncControls();
      applyLayout();
      setSaved();
    }

    /* Web フォントの読み込み完了後に組み直す */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleReflow);
    }

    resetHistory();
    scheduleReflow();
    updateStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
