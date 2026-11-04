/* =========================================================
   よつすいブログ
   ・blog.html       … 記事一覧（カード／カテゴリー／ページ送り）
   ・blog-post.html  … 記事ページ（Markdown を読んで表示）

   記事データは次の場所に置きます（メール投稿の仕組みが自動で書きます）。
     blog/index.json          … 記事の一覧（新しい順）
     blog/posts/<slug>.md     … 記事の本文（Markdown）
     blog/images/<slug>/1.jpg … 記事の写真

   ※ このファイルは書きかえなくても動きます。
      1ページあたりの表示件数だけ変えたいときは、すぐ下の PER_PAGE を直してください。
   ========================================================= */
(function () {
  'use strict';

  var PER_PAGE   = 9;                 // 1ページに並べる記事の数（3列×3段）
  var INDEX_URL  = 'blog/index.json'; // 記事一覧データ
  var POSTS_DIR  = 'blog/posts/';     // Markdown の置き場所

  /* =======================================================
     共通の小道具
     ======================================================= */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // javascript: などの危ないリンクを弾きます
  function safeUrl(u) {
    var s = String(u || '').trim();
    if (!s) { return ''; }
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(s)) { return s; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) { return ''; }  // 不明なスキームは捨てる
    return s;                                            // 相対パスはそのまま
  }

  // 2026-11-04 → 2026.11.04
  function fmtDate(d) {
    var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '.' + m[2] + '.' + m[3] : String(d || '');
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function fetchJson(url) {
    return fetch(url + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error(url + ' が読み込めませんでした（' + r.status + '）'); }
      return r.json();
    });
  }

  function fetchText(url) {
    return fetch(url + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error(url + ' が読み込めませんでした（' + r.status + '）'); }
      return r.text();
    });
  }

  // index.json は { posts: [...] } でも [...] でも受け取れるようにしています
  function toPosts(data) {
    var list = Array.isArray(data) ? data : (data && data.posts) || [];
    return list.filter(function (p) { return p && p.slug; }).sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) ||
             String(b.slug).localeCompare(String(a.slug));
    });
  }

  /* =======================================================
     Markdown → HTML（よく使う書き方だけに対応した軽い変換）
     見出し / 箇条書き / 番号つき / 引用 / 区切り線 / 画像 /
     リンク / 太字 / 斜体 / コード
     ======================================================= */

  function inline(text) {
    var out = esc(text);

    // 画像 ![説明](パス)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (_, alt, src, cap) {
      var u = safeUrl(src.replace(/&amp;/g, '&'));
      if (!u) { return ''; }
      var img = '<img src="' + esc(u) + '" alt="' + alt + '" loading="lazy" decoding="async">';
      return cap ? '<figure>' + img + '<figcaption>' + cap + '</figcaption></figure>' : img;
    });

    // リンク [文字](URL)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
      var u = safeUrl(href.replace(/&amp;/g, '&'));
      if (!u) { return label; }
      var ext = /^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(u) + '"' + ext + '>' + label + '</a>';
    });

    // むきだしのURLも自動でリンクにします
    out = out.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, function (all, head, url) {
      return head + '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + url + '</a>';
    });

    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    return out;
  }

  function mdToHtml(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var html  = [];
    var para  = [];
    var list  = null;   // 'ul' か 'ol'
    var quote = [];

    function flushPara() {
      if (!para.length) { return; }
      html.push('<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
      para = [];
    }
    function flushList() {
      if (!list) { return; }
      html.push('</' + list + '>');
      list = null;
    }
    function flushQuote() {
      if (!quote.length) { return; }
      html.push('<blockquote><p>' + inline(quote.join('\n')).replace(/\n/g, '<br>') + '</p></blockquote>');
      quote = [];
    }
    function flushAll() { flushPara(); flushList(); flushQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (!line.trim()) { flushAll(); continue; }

      // 区切り線
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushAll(); html.push('<hr>'); continue; }

      // 見出し
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushAll();
        var lv = Math.min(h[1].length + 1, 4);  // # は記事タイトル用なので h2 から始めます
        html.push('<h' + lv + '>' + inline(h[2].trim()) + '</h' + lv + '>');
        continue;
      }

      // 引用
      var q = line.match(/^\s*&gt;\s?(.*)$|^\s*>\s?(.*)$/);
      if (q) { flushPara(); flushList(); quote.push(q[1] != null ? q[1] : q[2]); continue; }

      // 箇条書き・番号つき
      var li = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
      if (li) {
        flushPara(); flushQuote();
        var kind = /^\d/.test(li[1]) ? 'ol' : 'ul';
        if (list !== kind) { flushList(); list = kind; html.push('<' + kind + '>'); }
        html.push('<li>' + inline(li[2]) + '</li>');
        continue;
      }

      // 画像だけの行は段落にせず、そのまま大きく置きます
      if (/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(line)) {
        flushAll();
        html.push(inline(line.trim()));
        continue;
      }

      flushList(); flushQuote();
      para.push(line);
    }
    flushAll();

    return html.join('\n');
  }

  // 記事ファイル先頭の「--- で囲んだ設定」を取り出します
  function parseFrontMatter(raw) {
    var text = String(raw || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) { return { meta: {}, body: text }; }

    var meta = {};
    m[1].split('\n').forEach(function (line) {
      var kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!kv) { return; }
      var v = kv[2].trim().replace(/^["']|["']$/g, '');
      meta[kv[1].toLowerCase()] = v;
    });
    return { meta: meta, body: text.slice(m[0].length) };
  }

  /* =======================================================
     一覧ページ（blog.html）
     ======================================================= */

  function initList(grid) {
    var stateEl  = document.getElementById('blog-state');
    var pagerEl  = document.getElementById('pager');
    var filterEl = document.getElementById('cat-filter');

    var all = [], cat = qs('cat'), page = parseInt(qs('page'), 10) || 1;

    function cardHtml(p) {
      var href  = 'blog-post.html?slug=' + encodeURIComponent(p.slug);
      var thumb = p.cover
        ? '<img src="' + esc(safeUrl(p.cover)) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="ph"><span class="ico" aria-hidden="true">♪</span><span class="txt">よつすいブログ</span></span>';

      return '' +
        '<li>' +
          '<a class="post-card" href="' + href + '">' +
            '<div class="post-thumb">' + thumb + '</div>' +
            '<div class="post-body">' +
              '<span class="post-date">' + esc(fmtDate(p.date)) + '</span>' +
              '<h2 class="post-title">' + esc(p.title || '（無題）') + '</h2>' +
              (p.excerpt ? '<p class="post-excerpt">' + esc(p.excerpt) + '</p>' : '') +
              '<div class="post-foot">' +
                '<span class="post-cat">' + esc(p.category || 'お知らせ') + '</span>' +
                '<span class="post-more">読む →</span>' +
              '</div>' +
            '</div>' +
          '</a>' +
        '</li>';
    }

    function filtered() {
      return cat ? all.filter(function (p) { return (p.category || '') === cat; }) : all;
    }

    function renderFilter() {
      if (!filterEl) { return; }
      var cats = [];
      all.forEach(function (p) {
        var c = p.category || '';
        if (c && cats.indexOf(c) < 0) { cats.push(c); }
      });
      if (!cats.length) { filterEl.hidden = true; return; }

      var html = '<button type="button" data-cat="" aria-pressed="' + (cat ? 'false' : 'true') + '">すべて</button>';
      cats.forEach(function (c) {
        html += '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' +
                (cat === c ? 'true' : 'false') + '">' + esc(c) + '</button>';
      });
      filterEl.innerHTML = html;
      filterEl.hidden = false;
    }

    function renderPager(total) {
      if (!pagerEl) { return; }
      var pages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (pages < 2) { pagerEl.innerHTML = ''; pagerEl.hidden = true; return; }

      var html = '<button type="button" data-page="' + (page - 1) + '" aria-label="前のページ"' +
                 (page <= 1 ? ' disabled' : '') + '>‹</button>';
      for (var i = 1; i <= pages; i++) {
        html += '<button type="button" data-page="' + i + '"' +
                (i === page ? ' aria-current="page"' : '') + '>' + i + '</button>';
      }
      html += '<button type="button" data-page="' + (page + 1) + '" aria-label="次のページ"' +
              (page >= pages ? ' disabled' : '') + '>›</button>';

      pagerEl.innerHTML = html;
      pagerEl.hidden = false;
    }

    function render() {
      var list  = filtered();
      var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      if (page > pages) { page = pages; }
      if (page < 1) { page = 1; }

      var slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

      if (!slice.length) {
        grid.innerHTML = '';
        if (stateEl) {
          stateEl.hidden = false;
          stateEl.textContent = all.length
            ? 'このカテゴリーの記事はまだありません。'
            : '記事はまだありません。最初の記事を準備中です。';
        }
      } else {
        if (stateEl) { stateEl.hidden = true; }
        grid.innerHTML = slice.map(cardHtml).join('');
      }

      renderPager(list.length);

      // アドレスバーにも今の状態を残します（ブラウザの「戻る」で戻れます）
      var q = [];
      if (cat)      { q.push('cat=' + encodeURIComponent(cat)); }
      if (page > 1) { q.push('page=' + page); }
      history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : ''));
    }

    if (filterEl) {
      filterEl.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-cat]');
        if (!b) { return; }
        cat = b.getAttribute('data-cat');
        page = 1;
        renderFilter();
        render();
      });
    }

    if (pagerEl) {
      pagerEl.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-page]');
        if (!b || b.disabled) { return; }
        page = parseInt(b.getAttribute('data-page'), 10) || 1;
        render();
        var head = document.querySelector('.blog-list');
        if (head) { head.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    }

    fetchJson(INDEX_URL).then(function (data) {
      all = toPosts(data);
      renderFilter();
      render();
    })['catch'](function (err) {
      if (stateEl) {
        stateEl.hidden = false;
        stateEl.textContent = '記事の読み込みに失敗しました。時間をおいて、もう一度お試しください。';
      }
      if (window.console) { console.error(err); }
    });
  }

  /* =======================================================
     記事ページ（blog-post.html）
     ======================================================= */

  function initPost(root) {
    var slug    = qs('slug');
    var stateEl = document.getElementById('blog-state');

    function fail(msg) {
      root.hidden = true;
      if (stateEl) {
        stateEl.hidden = false;
        stateEl.textContent = msg;
      }
    }

    if (!/^[A-Za-z0-9._-]+$/.test(slug)) {
      fail('記事が見つかりませんでした。');
      return;
    }

    Promise.all([
      fetchText(POSTS_DIR + slug + '.md'),
      fetchJson(INDEX_URL)['catch'](function () { return { posts: [] }; })
    ]).then(function (res) {
      var parsed = parseFrontMatter(res[0]);
      var meta   = parsed.meta;
      var posts  = toPosts(res[1]);
      var idx    = posts.map(function (p) { return p.slug; }).indexOf(slug);
      var entry  = idx >= 0 ? posts[idx] : {};

      var title = meta.title || entry.title || '（無題）';
      var date  = meta.date  || entry.date  || '';
      var cat   = meta.category || entry.category || '';
      var cover = meta.cover || entry.cover || '';

      document.title = title + '｜よつすいブログ｜四街道吹奏楽団';
      var desc = document.querySelector('meta[name="description"]');
      if (desc) {
        desc.setAttribute('content', meta.excerpt || entry.excerpt ||
          (title + ' - 四街道吹奏楽団（よつすい）のブログです。'));
      }

      var coverHtml = cover
        ? '<div class="article-cover"><img src="' + esc(safeUrl(cover)) + '" alt=""></div>'
        : '';

      root.innerHTML =
        coverHtml +
        '<div class="article-inner">' +
          '<div class="article-meta">' +
            '<span>' + esc(fmtDate(date)) + '</span>' +
            (cat ? '<span class="post-cat">' + esc(cat) + '</span>' : '') +
          '</div>' +
          '<h1>' + esc(title) + '</h1>' +
          '<hr class="article-rule">' +
          '<div class="prose">' + mdToHtml(parsed.body) + '</div>' +
        '</div>';
      root.hidden = false;
      if (stateEl) { stateEl.hidden = true; }

      // パンくずの記事名
      var crumb = document.getElementById('crumb-title');
      if (crumb) { crumb.textContent = title; }

      // 前後の記事（posts は新しい順なので、次 = 1つ前の番号）
      var navEl = document.getElementById('article-nav');
      if (navEl && idx >= 0) {
        var newer = idx > 0 ? posts[idx - 1] : null;
        var older = idx < posts.length - 1 ? posts[idx + 1] : null;
        var html = '';
        if (older) {
          html += '<a href="blog-post.html?slug=' + encodeURIComponent(older.slug) + '">' +
                  '<span class="dir">← 前の記事</span><span class="t">' + esc(older.title || '') + '</span></a>';
        }
        if (newer) {
          html += '<a class="next" href="blog-post.html?slug=' + encodeURIComponent(newer.slug) + '">' +
                  '<span class="dir">次の記事 →</span><span class="t">' + esc(newer.title || '') + '</span></a>';
        }
        navEl.innerHTML = html;
        navEl.hidden = !html;
      }
    })['catch'](function (err) {
      fail('記事が見つかりませんでした。削除されたか、アドレスが間違っている可能性があります。');
      if (window.console) { console.error(err); }
    });
  }

  /* =======================================================
     start
     ======================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    var grid = document.getElementById('post-grid');
    if (grid) { initList(grid); }

    var article = document.getElementById('article');
    if (article) { initPost(article); }
  });
})();
