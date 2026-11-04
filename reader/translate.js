// Переклад слів і фраз при кліку / наведенні / виділенні.
// Джерело: безкоштовний ендпоінт Google Translate (без ключа), запасний — MyMemory.
(function () {
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var lang = store.get('tr-lang', 'uk');
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  var hoverOn = !touch && store.get('tr-hover', '0') === '1';
  var cache = {};
  try { cache = JSON.parse(store.get('tr-cache', '{}')); } catch (e) {}

  // ---------- розмір шрифту (вигляд сторінки — у reader.css) ----------
  var fs = parseInt(store.get('tr-fs', '20'), 10) || 20;
  function applyFs() { document.documentElement.style.setProperty('--fs', fs + 'px'); }
  applyFs();
  document.documentElement.lang = 'en';

  // ---------- стилі ----------
  var css = document.createElement('style');
  css.textContent =
    '#tr-pop{position:absolute;z-index:9999;max-width:380px;background:#fffbe8;color:#222;border:1px solid #d9c98a;' +
    'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:10px 12px;font:15px/1.45 Segoe UI,Arial,sans-serif;display:none}' +
    '#tr-pop .src{color:#666;font-size:13px;margin-bottom:4px}' +
    '#tr-pop .main{font-weight:600;font-size:16px}' +
    '#tr-pop .alt{margin-top:6px;font-size:13px;color:#444}' +
    '#tr-pop .alt b{color:#8a6d00;font-weight:600}' +
    '#tr-pop button{margin-top:8px;font-size:12px;cursor:pointer;border:1px solid #ccb;border-radius:4px;background:#fff;padding:2px 8px}' +
    '#tr-bar{position:fixed;right:12px;bottom:12px;z-index:9998;background:#fff;border:1px solid #ccc;border-radius:8px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.15);padding:6px 8px;font:13px Segoe UI,Arial,sans-serif;display:flex;gap:6px;align-items:center}' +
    '#tr-bar button{cursor:pointer;border:1px solid #bbb;border-radius:4px;background:#f6f6f6;padding:3px 8px;font-size:13px}' +
    '#tr-bar button.on{background:#2f6fdb;color:#fff;border-color:#2f6fdb}' +
    '.tr-hl{background:#ffe58a}';
  document.head.appendChild(css);

  // ---------- панель налаштувань ----------
  var bar = document.createElement('div');
  bar.id = 'tr-bar';
  bar.innerHTML = '<button id="tr-sm" title="Менший шрифт">A−</button><button id="tr-lg" title="Більший шрифт">A+</button>' +
    '<span>Переклад:</span><button data-l="uk">УКР</button><button data-l="ru">РУС</button>' +
    '<button id="tr-hv" title="Перекладати при наведенні миші">Наведення</button>';
  document.body.appendChild(bar);
  if (touch) document.getElementById('tr-hv').style.display = 'none'; // наведення без миші не буває
  function paintBar() {
    var bs = bar.querySelectorAll('button[data-l]');
    for (var i = 0; i < bs.length; i++) bs[i].className = bs[i].getAttribute('data-l') === lang ? 'on' : '';
    document.getElementById('tr-hv').className = hoverOn ? 'on' : '';
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'tr-sm' || b.id === 'tr-lg') {
      fs = Math.max(14, Math.min(32, fs + (b.id === 'tr-lg' ? 2 : -2)));
      store.set('tr-fs', String(fs)); applyFs(); return;
    }
    if (b.id === 'tr-hv') { hoverOn = !hoverOn; store.set('tr-hover', hoverOn ? '1' : '0'); }
    else { lang = b.getAttribute('data-l'); store.set('tr-lang', lang); }
    paintBar(); hide();
  });
  paintBar();

  // ---------- спливаюче вікно ----------
  var pop = document.createElement('div');
  pop.id = 'tr-pop';
  document.body.appendChild(pop);
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hide() { pop.style.display = 'none'; }
  function place(rect) {
    pop.style.display = 'block';
    var x = rect.left + window.scrollX, y = rect.bottom + window.scrollY + 6;
    var w = pop.offsetWidth, maxX = window.scrollX + document.documentElement.clientWidth - w - 8;
    pop.style.left = Math.max(window.scrollX + 8, Math.min(x, maxX)) + 'px';
    pop.style.top = y + 'px';
  }

  // ---------- переклад ----------
  function saveCache() {
    var keys = Object.keys(cache);
    if (keys.length > 3000) for (var i = 0; i < 1000; i++) delete cache[keys[i]];
    store.set('tr-cache', JSON.stringify(cache));
  }
  function translate(text) {
    var key = lang + '|' + text.toLowerCase();
    if (cache[key]) return Promise.resolve(cache[key]);
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + lang +
      '&dt=t&dt=bd&q=' + encodeURIComponent(text);
    return fetch(url).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      var main = (d[0] || []).map(function (s) { return s[0]; }).join('');
      var alts = (d[1] || []).map(function (e) { return { pos: e[0], words: (e[1] || []).slice(0, 6) }; });
      return { main: main, alts: alts };
    }).catch(function () {
      var u = 'https://api.mymemory.translated.net/get?langpair=en|' + lang + '&q=' + encodeURIComponent(text);
      return fetch(u).then(function (r) { return r.json(); }).then(function (d) {
        return { main: d.responseData.translatedText, alts: [] };
      });
    }).then(function (res) { cache[key] = res; saveCache(); return res; });
  }
  var POS = { uk: { noun: 'ім.', verb: 'дієсл.', adjective: 'прикм.', adverb: 'присл.', preposition: 'прийм.', pronoun: 'займ.', conjunction: 'спол.' },
              ru: { noun: 'сущ.', verb: 'глаг.', adjective: 'прил.', adverb: 'нареч.', preposition: 'предл.', pronoun: 'мест.', conjunction: 'союз' } };

  var reqId = 0;
  function show(text, rect, sentence) {
    var id = ++reqId;
    pop.innerHTML = '<div class="src">' + esc(text) + '</div><div class="main">…</div>';
    place(rect);
    translate(text).then(function (res) {
      if (id !== reqId) return;
      var h = '<div class="src">' + esc(text) + '</div><div class="main">' + esc(res.main) + '</div>';
      res.alts.forEach(function (a) {
        h += '<div class="alt"><b>' + esc((POS[lang] || {})[a.pos] || a.pos) + '</b> ' + esc(a.words.join(', ')) + '</div>';
      });
      if (sentence && sentence !== text) h += '<button id="tr-sent">Перекласти речення</button>';
      pop.innerHTML = h;
      place(rect);
      var sb = document.getElementById('tr-sent');
      if (sb) sb.onclick = function (e) { e.stopPropagation(); show(sentence, rect, null); };
    }).catch(function () {
      if (id === reqId) pop.querySelector('.main').textContent = 'Немає зʼєднання з сервісом перекладу';
    });
  }

  // ---------- пошук слова під курсором ----------
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      return p && { node: p.offsetNode, offset: p.offset };
    }
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(x, y);
      return r && { node: r.startContainer, offset: r.startOffset };
    }
    return null;
  }
  var WORD = /[A-Za-zÀ-ɏ'’-]/;
  function wordAt(x, y) {
    var c = caretAt(x, y);
    if (!c || !c.node || c.node.nodeType !== 3) return null;
    var t = c.node.data, s = c.offset, e = c.offset;
    while (s > 0 && WORD.test(t[s - 1])) s--;
    while (e < t.length && WORD.test(t[e])) e++;
    var w = t.slice(s, e).replace(/^['’-]+|['’-]+$/g, '');
    if (!/[A-Za-z]/.test(w)) return null;
    s = t.indexOf(w, s);
    var range = document.createRange();
    range.setStart(c.node, s); range.setEnd(c.node, s + w.length);
    var rect = range.getBoundingClientRect();
    // курсор має бути саме над словом, а не поруч
    if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
    return { word: w, rect: rect, sentence: sentenceAround(c.node, s) };
  }
  function sentenceAround(node, pos) {
    var block = node.parentNode;
    while (block && block !== document.body && !/^(P|LI|TD|BLOCKQUOTE|DIV|H\d|DD|DT)$/.test(block.nodeName)) block = block.parentNode;
    if (!block) return null;
    // позиція слова всередині тексту блоку
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT), off = 0, n;
    while ((n = walker.nextNode())) { if (n === node) { off += pos; break; } off += n.data.length; }
    var full = block.textContent;
    var start = 0, end = full.length, re = /[.!?]["”’)]*(?=\s+["“(]?[A-Z0-9])/g, m;
    while ((m = re.exec(full))) {
      if (m.index < off) start = m.index + m[0].length; else { end = m.index + m[0].length; break; }
    }
    var s = full.slice(start, end).replace(/\s+/g, ' ').trim();
    return s.length > 1500 ? s.slice(0, 1500) : s;
  }

  function inUi(el) { return el && el.closest && el.closest('#tr-pop,#tr-bar'); }

  function showSelection() {
    var sel = window.getSelection(), txt = sel && sel.rangeCount ? sel.toString().trim() : '';
    if (!txt || !/[A-Za-z]/.test(txt)) return false;
    show(txt.replace(/\s+/g, ' ').slice(0, 1500), sel.getRangeAt(0).getBoundingClientRect(), null);
    return true;
  }

  // клік / тап по слову або виділення фрази мишею
  document.addEventListener('pointerup', function (e) {
    if (e.button !== 0 || inUi(e.target)) return;
    if (e.pointerType === 'mouse') { if (showSelection()) return; }
    else { var s = window.getSelection(); if (s && !s.isCollapsed) return; } // фразу на телефоні обробляє selectionchange
    if (e.target.closest && e.target.closest('a[href]')) return; // посилання працюють як звичайно
    var w = wordAt(e.clientX, e.clientY);
    if (w) show(w.word, w.rect, w.sentence); else hide();
  });

  // на сенсорному екрані фразу виділяють довгим натисканням і маркерами — перекладаємо після паузи
  var selTimer, lastSel = '';
  if (touch) document.addEventListener('selectionchange', function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      var t = String(window.getSelection() || '').trim();
      if (t && t !== lastSel) { lastSel = t; showSelection(); }
      if (!t) lastSel = '';
    }, 700);
  });

  // наведення (якщо увімкнено)
  var hoverTimer, lastWord = '';
  document.addEventListener('mousemove', function (e) {
    if (!hoverOn || inUi(e.target) || e.buttons) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      var w = wordAt(e.clientX, e.clientY);
      if (w && w.word !== lastWord) { lastWord = w.word; show(w.word, w.rect, w.sentence); }
      if (!w) lastWord = '';
    }, 450);
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', function () { if (hoverOn) hide(); }, { passive: true });
})();
