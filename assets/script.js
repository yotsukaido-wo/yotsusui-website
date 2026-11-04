/* =========================================================
   四街道吹奏楽団 共通スクリプト
   ・スマホのメニュー開閉
   ・いま見ているページをメニューで強調
   ・YouTube 動画カードの自動生成（movie.html）
   ========================================================= */
(function () {
  'use strict';

  /* ---------- スマホのメニュー開閉 ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('.label').textContent = open ? '閉じる' : 'メニュー';
    });
  }

  /* ---------- いま見ているページをメニューで強調 ---------- */
  var here = location.pathname.split('/').pop() || 'index.html';
  Array.prototype.forEach.call(
    document.querySelectorAll('.site-nav a, .footer-grid a'),
    function (a) {
      var href = (a.getAttribute('href') || '').split('/').pop();
      if (href && href === here) {
        a.setAttribute('aria-current', 'page');
      }
    }
  );

  /* ---------- YouTube 動画カードの自動生成 ----------
     movie.html の <script> で定義した YOTSUSUI_VIDEOS を読み込み、
     動画IDからサムネイルとリンクを組み立てます。
     id を空にしておくと「準備中」のカードになります。
  ------------------------------------------------------ */
  var grid = document.getElementById('video-grid');
  if (grid && Array.isArray(window.YOTSUSUI_VIDEOS)) {
    window.YOTSUSUI_VIDEOS.forEach(function (v) {
      var hasId = !!(v.id && v.id.trim());
      var el = document.createElement(hasId ? 'a' : 'div');
      el.className = 'video-card';

      if (hasId) {
        el.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id);
        el.target = '_blank';
        el.rel = 'noopener';
      }

      var thumb = document.createElement('div');
      thumb.className = 'video-thumb';
      if (hasId) {
        var img = document.createElement('img');
        // YouTube のサムネイルをそのまま表示します。
        // maxresdefault（16:9・高画質）を優先し、無い動画は hqdefault に切り替えます。
        var vid = encodeURIComponent(v.id);
        img.src = 'https://i.ytimg.com/vi/' + vid + '/maxresdefault.jpg';
        img.onerror = function () {
          if (this.getAttribute('data-fallback')) { return; }
          this.setAttribute('data-fallback', '1');
          this.src = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
        };
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
        var play = document.createElement('span');
        play.className = 'play';
        play.setAttribute('aria-hidden', 'true');
        play.textContent = '▶';
        thumb.appendChild(play);
      } else {
        thumb.innerHTML =
          '<span class="ph"><span class="ico" aria-hidden="true">🎬</span>' +
          '<span class="txt">動画IDを設定してください</span></span>';
      }
      el.appendChild(thumb);

      var body = document.createElement('div');
      body.className = 'video-body';

      var title = document.createElement('span');
      title.className = 'v-title';
      title.textContent = v.title || '（タイトル未設定）';
      body.appendChild(title);

      var meta = document.createElement('span');
      meta.className = 'v-meta';
      meta.textContent = [v.date, v.note].filter(Boolean).join('　/　');
      if (meta.textContent) { body.appendChild(meta); }

      el.appendChild(body);
      grid.appendChild(el);
    });
  }

  /* ---------- ゆっくりフェードイン ----------
     HTML側で class="fade-slow" を付けた要素が画面に入ると、
     CSSのトランジションでゆっくり現れます。
  ------------------------------------------------ */
  var fadeTargets = document.querySelectorAll('.fade-slow');

  if (fadeTargets.length) {
    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      // 動きを減らす設定、または非対応ブラウザではそのまま表示
      Array.prototype.forEach.call(fadeTargets, function (el) {
        el.classList.add('is-visible');
      });
    } else {
      var fadeObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            fadeObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

      Array.prototype.forEach.call(fadeTargets, function (el) {
        fadeObserver.observe(el);
      });
    }
  }
})();
