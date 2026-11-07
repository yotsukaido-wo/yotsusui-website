/* =========================================================
   よつすいブログ
   ・index.html      … トップページのブログ欄（最新のものだけを横並びで）
   ・blog.html       … 記事一覧（新しい順に並べて、横にスクロールできます）
   ・blog-post.html  … 記事ページ（Markdown を読んで表示）

   記事データは次の場所に置きます（メール投稿の仕組みが自動で書きます）。
     blog/index.json          … 記事の一覧（新しい順）
     blog/posts/<slug>.md     … 記事の本文（Markdown）
     blog/images/<slug>/1.jpg … 記事の写真

   ※ このファイルは書きかえなくても動きます。
   ========================================================= */
(function () {
  'use strict';

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
    var stateEl = document.getElementById('blog-state');
    var carEl   = document.getElementById('post-carousel');
    var prevBtn = document.getElementById('car-prev');
    var nextBtn = document.getElementById('car-next');
    var hintEl  = document.getElementById('car-hint');

    /* 並べ方は2とおりあります。
       ・<ul id="post-grid" class="post-list">  … たて1列（タイトルの横に写真）。blog.html
       ・<ul id="post-grid" class="post-track"> … 横に送るカード型。トップページ
       どちらにするかは HTML 側の class で決まるので、ここは直さなくて大丈夫です */
    var isList = grid.classList.contains('post-list');
    var boxEl  = carEl || grid;   // 読み込みが終わるまで隠しておく入れもの

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
                '<span class="post-more">読む →</span>' +
              '</div>' +
            '</div>' +
          '</a>' +
        '</li>';
    }

    // たて1列の一覧のとき、1記事ぶんの書き方。
    // 左にタイトル、右に写真（写真がない記事は「よつすいブログ」の絵）。
    function rowHtml(p) {
      var href  = 'blog-post.html?slug=' + encodeURIComponent(p.slug);
      var thumb = p.cover
        ? '<img src="' + esc(safeUrl(p.cover)) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="ph"><span class="ico" aria-hidden="true">♪</span><span class="txt">よつすいブログ</span></span>';

      return '' +
        '<li>' +
          '<a class="post-row" href="' + href + '">' +
            '<div class="post-row-body">' +
              '<span class="post-date">' + esc(fmtDate(p.date)) + '</span>' +
              '<h2 class="post-title">' + esc(p.title || '（無題）') + '</h2>' +
              (p.excerpt ? '<p class="post-excerpt">' + esc(p.excerpt) + '</p>' : '') +
            '</div>' +
            '<div class="post-thumb post-row-thumb">' + thumb + '</div>' +
          '</a>' +
        '</li>';
    }

    // 1回の矢印クリックで動かす幅（カード1枚ぶん）
    function stepWidth() {
      var first = grid.firstElementChild;
      if (!first) { return grid.clientWidth; }
      var gap = parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap) || 0;
      return first.getBoundingClientRect().width + gap;
    }

    // 端まで来たら矢印を消します（横に動かせるぶんが無いときは両方消えます）
    function syncNav() {
      var max = grid.scrollWidth - grid.clientWidth;
      var x   = grid.scrollLeft;
      if (prevBtn) { prevBtn.disabled = x <= 2; }
      if (nextBtn) { nextBtn.disabled = x >= max - 2; }
      if (hintEl)  { hintEl.hidden = max <= 2; }
    }

    function slide(dir) {
      grid.scrollBy({ left: dir * stepWidth(), behavior: 'smooth' });
    }

    if (prevBtn) { prevBtn.addEventListener('click', function () { slide(-1); }); }
    if (nextBtn) { nextBtn.addEventListener('click', function () { slide(1); }); }

    /* ---- 矢印にマウスを乗せるだけで、となりの記事へ送ります ----
       <div class="post-carousel" data-hover-scroll> と書いたときだけ働きます。
       ・通りがかっただけで動かないよう、0.35秒おいてから1枚目を送ります
       ・そのまま乗せていると、1.2秒ごとに次の記事へ進みます
       ・マウスを離す、端まで来る、動きを減らす設定の端末、では止まります
       ・指で操作する端末（マウスのない端末）では何もしません
    ------------------------------------------------------------ */
    var HOVER_WAIT   = 350;   // 乗せてから最初に送るまで
    var HOVER_REPEAT = 1200;  // そのあと、次を送るまでの間隔

    var hoverOn = carEl && carEl.hasAttribute('data-hover-scroll') &&
      !(window.matchMedia && (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.matchMedia('(hover: none)').matches));

    if (hoverOn) {
      [[prevBtn, -1], [nextBtn, 1]].forEach(function (pair) {
        var btn = pair[0], dir = pair[1];
        if (!btn) { return; }

        var waitTimer = null, repeatTimer = null;

        function stop() {
          clearTimeout(waitTimer);   waitTimer   = null;
          clearInterval(repeatTimer); repeatTimer = null;
        }
        function step() {
          if (btn.disabled) { stop(); return; }   // 端まで来たら止めます
          slide(dir);
        }

        btn.addEventListener('mouseenter', function () {
          stop();
          waitTimer = setTimeout(function () {
            step();
            repeatTimer = setInterval(step, HOVER_REPEAT);
          }, HOVER_WAIT);
        });

        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('blur', stop);
        window.addEventListener('blur', stop);
      });
    }

    // 左右キーでも動かせるようにします（横に送るカード型のときだけ）
    if (!isList) {
      grid.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); slide(1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); slide(-1); }
      });

      grid.addEventListener('scroll', syncNav, { passive: true });
      window.addEventListener('resize', syncNav);
    }

    // トップページのように「最新のいくつかだけ」出したいときは、
    // <ul id="post-grid" data-limit="6"> のように書くと、その数だけ並びます。
    var limit = parseInt(grid.getAttribute('data-limit'), 10);

    fetchJson(INDEX_URL).then(function (data) {
      var posts = toPosts(data);   // 新しい順（日付のあたらしいものが先頭）
      if (limit > 0) { posts = posts.slice(0, limit); }

      if (!posts.length) {
        if (boxEl)   { boxEl.hidden = true; }
        if (stateEl) {
          stateEl.hidden = false;
          stateEl.textContent = '記事はまだありません。最初の記事を準備中です。';
        }
        return;
      }

      grid.innerHTML = posts.map(isList ? rowHtml : cardHtml).join('');
      if (boxEl)   { boxEl.hidden = false; }
      if (stateEl) { stateEl.hidden = true; }

      // 画像の読み込みで幅が変わることがあるので、少しおいてからもう一度そろえます
      syncNav();
      setTimeout(syncNav, 300);
    })['catch'](function (err) {
      if (boxEl)   { boxEl.hidden = true; }
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
      var cover = meta.cover || entry.cover || '';

      document.title = title + '｜よつすいブログ｜四街道吹奏楽団';
      var summary = meta.excerpt || entry.excerpt ||
        (title + ' - 四街道吹奏楽団（よつすい）のブログです。');
      var desc = document.querySelector('meta[name="description"]');
      if (desc) { desc.setAttribute('content', summary); }

      // LINEやSNSに貼ったときの見出し・説明・画像（OGP）も、記事のものに書きかえます。
      // ※ 読みとる側がページの JavaScript を動かさない場合は、
      //    blog-post.html に書いてあるブログ全体の内容が使われます。
      function setMeta(attr, name, value) {
        var el = document.querySelector('meta[' + attr + '="' + name + '"]');
        if (el && value) { el.setAttribute('content', value); }
      }
      setMeta('property', 'og:title', title + '｜よつすいブログ');
      setMeta('property', 'og:description', summary);
      // 公開中のサイトは「.html」なしのURLが正式なので、ここでも外しておきます
      // （sitemap.xml に書いてあるURLと形をそろえるためです）
      var postUrl = location.origin +
        location.pathname.replace(/\.html$/, '') + location.search;

      setMeta('property', 'og:url', postUrl);
      if (cover) {
        setMeta('property', 'og:image', new URL(cover, location.href).href);
        setMeta('property', 'og:image:alt', title);
        // 画像を差しかえたので、もとの画像の大きさの指定は外します
        ['og:image:width', 'og:image:height'].forEach(function (name) {
          var el = document.querySelector('meta[property="' + name + '"]');
          if (el) { el.parentNode.removeChild(el); }
        });
      }

      // このページの正式なURL（canonical）を、記事ごとのURLに直します。
      // こうしておくと、Google が記事を1本ずつ別のページとして登録してくれます。
      var canon = document.querySelector('link[rel="canonical"]');
      if (!canon) {
        canon = document.createElement('link');
        canon.setAttribute('rel', 'canonical');
        document.head.appendChild(canon);
      }
      canon.setAttribute('href', postUrl);

      // 検索エンジン向けに「これはブログ記事です」と書いた札（構造化データ）を足します。
      // 画面には表示されません。
      try {
        var ld = {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          'headline': title,
          'description': summary,
          'inLanguage': 'ja',
          'mainEntityOfPage': { '@type': 'WebPage', '@id': postUrl },
          'url': postUrl,
          'isPartOf': {
            '@type': 'Blog',
            'name': 'よつすいブログ',
            'url': location.origin + '/blog'
          },
          'author':    { '@type': 'MusicGroup', 'name': '四街道吹奏楽団' },
          'publisher': { '@id': location.origin + '/#organization' }
        };
        if (date) { ld.datePublished = date; ld.dateModified = date; }
        if (cover) { ld.image = new URL(cover, location.href).href; }
        var ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.textContent = JSON.stringify(ld);
        document.head.appendChild(ldEl);
      } catch (e) { /* 札が作れなくても、記事の表示には影響しません */ }

      var coverHtml = cover
        ? '<div class="article-cover"><img src="' + esc(safeUrl(cover)) + '" alt=""></div>'
        : '';

      root.innerHTML =
        coverHtml +
        '<div class="article-inner">' +
          '<div class="article-meta">' +
            '<span>' + esc(fmtDate(date)) + '</span>' +
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
