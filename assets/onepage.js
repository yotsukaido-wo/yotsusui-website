/* =========================================================
   四街道吹奏楽団 ワンページ版 スクリプト
   ・スマホのメニュー開閉
   ・スクロールに合わせた「ふわっと」フェードイン
   ・YouTube動画カードの自動生成
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- スマホのメニュー開閉 ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('header-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('.label').textContent = open ? '閉じる' : 'メニュー';
    });

    // メニュー内のリンクを押したら閉じる
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.querySelector('.label').textContent = 'メニュー';
      }
    });
  }

  /* ---------- 動画カードの自動生成（フェードインより先に実行） ---------- */
  var grid = document.getElementById('video-grid');
  if (grid && Array.isArray(window.YOTSUSUI_VIDEOS)) {
    window.YOTSUSUI_VIDEOS.forEach(function (v, i) {
      var hasId = !!(v.id && v.id.trim());
      var el = document.createElement(hasId ? 'a' : 'div');
      el.className = 'video-card reveal' + (i % 3 ? ' d' + (i % 3) : '');

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

  /* ---------- 並んだ要素を1つずつずらして表示 ----------
     HTML側で data-stagger を付けた要素は、その中身が
     0.1秒ずつ遅れてフェードインします。
  ------------------------------------------------------ */
  Array.prototype.forEach.call(
    document.querySelectorAll('[data-stagger]'),
    function (box) {
      Array.prototype.forEach.call(box.children, function (child, i) {
        if (/\bd[1-4]\b/.test(child.className)) { return; } // 個別指定があるものは触らない
        child.classList.add('reveal');
        child.style.transitionDelay = (Math.min(i, 9) * 0.1) + 's';
      });
    }
  );

  /* ---------- 写真スライドショー ----------
     .slideshow の中の <img class="slide"> を3秒ごとに切り替えます。
     ・切り替え時間（3000）を変えれば間隔を調整できます
     ・マウスを乗せている間と、別のタブを見ている間は止まります
     ・動きを減らす設定の端末では1枚目のまま動きません
  ------------------------------------------------ */
  var SLIDE_INTERVAL = 3000;

  Array.prototype.forEach.call(
    document.querySelectorAll('.slideshow'),
    function (box) {
      var slides = box.querySelectorAll('.slide');
      var dots = box.querySelectorAll('.slide-dots i');
      if (slides.length < 2 || reduceMotion) { return; }

      var index = 0;
      var timer = null;
      var paused = false;

      function show(next) {
        slides[index].classList.remove('is-current');
        if (dots[index]) { dots[index].classList.remove('is-current'); }
        index = next;
        slides[index].classList.add('is-current');
        if (dots[index]) { dots[index].classList.add('is-current'); }
      }

      // 写真は loading="lazy" で後回しにしてあるので、
      // 1枚先の写真だけ先に読み込ませておきます（最初の表示を軽くするため）
      function preload(i) {
        var img = slides[i];
        if (img.getAttribute('loading') === 'lazy') { img.removeAttribute('loading'); }
      }

      function isReady(i) {
        return slides[i].complete && slides[i].naturalWidth > 0;
      }

      function tick() {
        if (paused || document.hidden) { return; }

        // 読み込みが間に合っていない写真は飛ばして、次に表示できる写真を探す
        var next = -1;
        for (var n = 1; n < slides.length; n++) {
          var cand = (index + n) % slides.length;
          if (isReady(cand)) { next = cand; break; }
        }
        if (next === -1) { return; } // どれも読めていなければ今回は見送り

        show(next);
        preload((next + 1) % slides.length);
      }

      function start() {
        if (timer === null) { timer = setInterval(tick, SLIDE_INTERVAL); }
      }
      function stop() {
        if (timer !== null) { clearInterval(timer); timer = null; }
      }

      preload(1); // 2枚目を先に用意しておく

      box.addEventListener('mouseenter', function () { paused = true; });
      box.addEventListener('mouseleave', function () { paused = false; });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stop(); } else { start(); }
      });

      start();
    }
  );

  /* ---------- スクロールでふわっと表示 ----------
     ふだんは「少し見えたら」動きはじめます。
     背の高い写真は、それだと画面に入りきる前にフェードが終わってしまうので、
     HTML側に data-reveal-at="0.4" と書くと「4割見えてから」動きはじめます。
  ------------------------------------------------ */
  var targets = document.querySelectorAll('.reveal, .photo, .section-head');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    // 動きを減らす設定、または非対応ブラウザではそのまま表示
    Array.prototype.forEach.call(targets, function (el) {
      el.classList.add('is-visible');
    });
    return;
  }

  function makeObserver(threshold) {
    return new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -12% 0px',
      threshold: threshold
    });
  }

  var observer  = makeObserver(0.08);   // ふつうの要素
  var observers = {};                   // data-reveal-at ごとに1つずつ用意します

  Array.prototype.forEach.call(targets, function (el) {
    var at = parseFloat(el.getAttribute('data-reveal-at'));
    if (!(at > 0 && at <= 1)) { observer.observe(el); return; }

    if (!observers[at]) { observers[at] = makeObserver(at); }
    observers[at].observe(el);
  });
})();
