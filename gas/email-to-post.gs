/**
 * =========================================================================
 *  四街道吹奏楽団ホームページ  メール投稿（Email to Post）
 * =========================================================================
 *
 *  ブログ投稿専用のGmail（yotsukaido.wo.pr@gmail.com）に届いたメールを、
 *  Markdownファイル＋画像に変換して GitHub へ直接コミットします。
 *  GitHub が更新されると Netlify が自動でビルドし、ブログに反映されます。
 *
 *  使いかた（投稿する人）
 *    件名  … 記事のタイトル
 *    本文  … 記事の本文（そのまま載ります。空行で段落が分かれます）
 *    添付  … 写真（何枚でも可。1枚目が一覧のサムネイルになります）
 *
 *  本文の中に [写真1] [写真2] …と書くと、その場所に写真が入ります。
 *  書かなかった写真は本文のいちばん下にまとめて並びます。
 *
 *  ※ 最初に1回だけ setup() を実行してください（ラベルと定期実行をまとめて作ります）。
 * =========================================================================
 */


/* =========================================================================
   1. 設定  ここだけ書きかえれば使えます
   ========================================================================= */

var CONFIG = {

  /* --- GitHub --- */
  GITHUB_OWNER:  'yotsukaido-wo',          // GitHubのアカウント名
  GITHUB_REPO:   'yotsusui-website',       // リポジトリ名
  GITHUB_BRANCH: 'main',                   // Netlifyが見ているブランチ

  /* --- ブログ投稿専用のGmail ---
     完了メールに付ける「修正」「削除」ボタンの宛先になります。 */
  BLOG_ADDRESS: 'yotsukaido.wo.pr@gmail.com',

  /* --- サイトのURL ---
     完了メールに入れる「記事を見る」リンクの行き先です。
     サイトの置き場所を変えたときは、ここを書きかえるか、Apps Script の
     「スクリプト プロパティ」に SITE_URL を登録してください。
     （スクリプト プロパティのほうが優先されるので、コードを触らずに切りかえられます） */
  SITE_URL: 'https://yotsukaido-wo.netlify.app',

  /**
   * リポジトリの中で、サイト（onepage.html がある場所）がどこにあるか。
   *   リポジトリ直下に onepage.html がある      → ''
   *   リポジトリ/site/onepage.html にある       → 'site'
   */
  SITE_DIR: '',

  /* --- 投稿を受け付けるメールアドレス ---
     ★ここに書いた人からのメールだけを記事にします。
       ほかの人がこのGmailに送っても投稿されません（迷惑メール対策）。

     ▼ 団員の個人アドレスは、このファイルには書かないでください。
        このファイルはGitHubで公開されているため、書くと誰でも見られてしまいます。
        個人アドレスは Apps Script の「スクリプト プロパティ」に
        ALLOWED_SENDERS という名前で、カンマ区切りで登録してください。
        （例）aaa@gmail.com, bbb@gmail.com
        登録すると、下の一覧のかわりにそちらが使われます。 */
  ALLOWED_SENDERS: [
    'yotsukaido.wo.pr@gmail.com'    // 投稿専用アカウント本人（公開しても困らないアドレス）
  ],

  /* --- Gmailの検索条件とラベル ---
     ※「ブログ投稿済み」を除外していないのは、完了メールへの返信（記事の修正・削除）も
       受け取るためです。指示のない返信は、何もせずに既読にするだけです。 */
  GMAIL_QUERY:  'is:unread -label:ブログ投稿エラー',
  LABEL_DONE:   'ブログ投稿済み',
  LABEL_ERROR:  'ブログ投稿エラー',

  /* --- 画像 --- */
  IMAGE_MAX_WIDTH: 1200,                   // 横幅の上限（px）。これより大きい写真は縮めます
  MAX_IMAGES_PER_POST: 12,                 // 1記事に入れる写真の上限
  MAX_ATTACHMENT_BYTES: 25 * 1024 * 1024,  // これより大きい添付は無視します

  /* --- 動作 --- */
  MAX_POSTS_PER_RUN: 5,                    // 1回の実行で処理する記事数の上限
  EXCERPT_LENGTH: 80,                      // 一覧に出す抜粋の長さ（文字数）
  REPLY_ON_SUCCESS: true,                  // 投稿できたら送信者に完了メールを返す
  TIMEZONE: 'Asia/Tokyo'
};

/**
 * GitHubのトークンは、コードではなく「スクリプト プロパティ」に保存します。
 *   Apps Script の画面 →「プロジェクトの設定」→「スクリプト プロパティ」
 *   プロパティ名： GITHUB_TOKEN
 *   値　　　　　： ghp_... （GitHubで発行したトークン）
 */
/**
 * 投稿を許可するアドレスの一覧を返します。
 * スクリプト プロパティに ALLOWED_SENDERS があればそちらを（カンマ区切り）、
 * なければ上の CONFIG.ALLOWED_SENDERS を使います。
 */
function getAllowedSenders_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_SENDERS');
  var list = raw
    ? raw.split(',')
    : CONFIG.ALLOWED_SENDERS;

  return list
    .map(function (s) { return String(s).trim().toLowerCase(); })
    .filter(function (s) { return s; });
}

function getGitHubToken_() {
  var t = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!t) {
    throw new Error(
      'GITHUB_TOKEN が設定されていません。' +
      '「プロジェクトの設定」→「スクリプト プロパティ」に GITHUB_TOKEN を追加してください。');
  }
  return t.trim();
}


/* =========================================================================
   2. 最初に1回だけ実行する準備
   ========================================================================= */

/**
 * ラベルを作り、5分おきの定期実行をセットします。
 * 1回実行すれば、あとは自動で動きます（何度実行しても二重には増えません）。
 */
function setup() {
  [CONFIG.LABEL_DONE, CONFIG.LABEL_ERROR].forEach(function (name) {
    if (!GmailApp.getUserLabelByName(name)) {
      GmailApp.createLabel(name);
      Logger.log('ラベルを作成しました：' + name);
    }
  });

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processBlogMail') { ScriptApp.deleteTrigger(t); }
  });
  ScriptApp.newTrigger('processBlogMail').timeBased().everyMinutes(5).create();

  Logger.log('5分おきの自動実行を設定しました。');
  Logger.log('つづけて testConnection() を実行して、GitHubにつながるか確認してください。');
}

/** GitHubにつながるか、書き込み権限があるかを確かめます。 */
function testConnection() {
  var repo = githubApi_('GET', '');
  Logger.log('リポジトリ：' + repo.full_name + '（既定のブランチ：' + repo.default_branch + '）');
  Logger.log('書き込み権限：' + (repo.permissions && repo.permissions.push ? 'あり ✓' : 'なし ✗'));

  var ref = githubApi_('GET', '/git/ref/heads/' + CONFIG.GITHUB_BRANCH);
  Logger.log('ブランチ ' + CONFIG.GITHUB_BRANCH + ' の最新コミット：' + ref.object.sha);

  var idx = readIndexJson_();
  Logger.log('いまの記事数：' + idx.posts.length + '件');

  Logger.log('投稿を許可しているアドレス：' + getAllowedSenders_().join(' / '));
}


/* =========================================================================
   3. 本体  5分おきに自動で呼ばれます
   ========================================================================= */

function processBlogMail() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('前回の処理がまだ動いているため、今回は見送ります。');
    return;
  }

  try {
    var threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, CONFIG.MAX_POSTS_PER_RUN * 2);
    if (!threads.length) { return; }

    var doneLabel  = getOrCreateLabel_(CONFIG.LABEL_DONE);
    var errorLabel = getOrCreateLabel_(CONFIG.LABEL_ERROR);
    var allowed    = getAllowedSenders_();
    var published  = 0;

    for (var i = 0; i < threads.length && published < CONFIG.MAX_POSTS_PER_RUN; i++) {
      var thread   = threads[i];
      var messages = thread.getMessages();

      for (var j = 0; j < messages.length && published < CONFIG.MAX_POSTS_PER_RUN; j++) {
        var msg = messages[j];
        if (!msg.isUnread()) { continue; }

        var from = extractEmail_(msg.getFrom());

        // 許可していないアドレスからのメールは、記事にせず既読にするだけ
        if (allowed.indexOf(from) < 0) {
          Logger.log('許可されていない送信者のため無視しました：' + from);
          msg.markRead();
          continue;
        }

        try {
          var order     = parseEditDirective_(msg.getPlainBody());
          var alreadyIn = threadHasLabel_(thread, CONFIG.LABEL_DONE);

          if (order && order.action === '削除') {
            deletePost_(order.slug);
            Logger.log('削除しました：' + order.slug);
            if (CONFIG.REPLY_ON_SUCCESS) { sendDeletedMail_(msg, order.slug); }

          } else if (order) {
            var edited = editPost_(msg, order.slug);
            Logger.log('修正しました：' + edited.slug);
            if (CONFIG.REPLY_ON_SUCCESS) { sendSuccessMail_(msg, edited, true); }

          } else if (alreadyIn) {
            // 投稿済みスレッドへのふつうの返信。同じ記事が二重にできないよう、何もしません。
            Logger.log('修正の指示がない返信のため、何もしませんでした。');
            msg.markRead();
            continue;

          } else {
            var posted = publishMessage_(msg);
            Logger.log('投稿しました：' + posted.slug);
            if (CONFIG.REPLY_ON_SUCCESS) { sendSuccessMail_(msg, posted, false); }
          }

          msg.markRead();
          thread.addLabel(doneLabel);
          published++;

        } catch (e) {
          Logger.log('投稿に失敗しました：' + (e && e.message ? e.message : e));
          thread.addLabel(errorLabel);
          msg.markRead();           // 同じメールで何度も失敗しないように既読にします
          sendErrorMail_(msg, e);
        }
      }
    }

  } finally {
    lock.releaseLock();
  }
}


/* =========================================================================
   4. メール1通 → 記事1本
   ========================================================================= */

function publishMessage_(msg) {
  var date  = msg.getDate();
  var ymd   = Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var slug  = ymd + '-' + shortHash_(msg.getId());

  var parsed   = parseSubject_(msg.getSubject());
  var rawBody  = cleanBody_(msg.getPlainBody());
  var directive = extractDirectives_(rawBody);     // 本文先頭の「タイトル：〜」など

  var title    = directive.values['タイトル'] || directive.values['title'] || parsed.title || '（無題）';
  var body     = directive.body;

  /* ---- 添付の写真を取り出して、縮めて、名前をつける ---- */
  var images = collectImages_(msg, slug, 0);

  savePost_(slug, ymd, title, body, images, 'ブログ記事を追加：' + title + ' (' + slug + ')');

  return { slug: slug, title: title, plainBody: body };
}


/**
 * 記事1本をGitHubに書き込みます（新規・修正の両方で使います）。
 * images は [{ webPath, blob }]。blob がないものは、すでにGitHubにある写真です。
 */
function savePost_(slug, ymd, title, body, images, commitMessage) {

  /* ---- 本文の [写真1] を実際の画像に置きかえる ---- */
  var used = {};
  body = body.replace(/[\[［](?:写真|画像|photo|image)\s*(\d+)[\]］]/gi, function (all, n) {
    var idx = parseInt(n, 10) - 1;
    if (idx < 0 || idx >= images.length) { return ''; }
    used[idx] = true;
    return '\n![](' + images[idx].webPath + ')\n';
  });

  /* ---- 使われなかった写真を本文の下に並べる（1枚目はサムネイルなので除く） ---- */
  var tail = [];
  for (var k = 1; k < images.length; k++) {
    if (!used[k]) { tail.push('![](' + images[k].webPath + ')'); }
  }
  if (tail.length) { body = body.replace(/\s+$/, '') + '\n\n' + tail.join('\n\n') + '\n'; }

  var cover   = images.length ? images[0].webPath : '';
  var excerpt = makeExcerpt_(body);

  /* ---- Markdownを組み立てる ---- */
  var markdown = [
    '---',
    'title: '    + yamlValue_(title),
    'date: '     + ymd,
    'cover: '    + cover,
    'excerpt: '  + yamlValue_(excerpt),
    '---',
    '',
    body.replace(/^\s+|\s+$/g, ''),
    ''
  ].join('\n');

  /* ---- index.json を書きかえる（新しい順） ---- */
  var index = readIndexJson_();
  index.posts = index.posts.filter(function (p) { return p.slug !== slug; });
  index.posts.unshift({
    slug: slug, title: title, date: ymd,
    excerpt: excerpt, cover: cover
  });
  index.posts.sort(function (a, b) {
    return String(b.date).localeCompare(String(a.date)) || String(b.slug).localeCompare(String(a.slug));
  });
  index.generated = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");

  /* ---- まとめて1つのコミットにして push ---- */
  var files = [
    { path: sitePath_('blog/posts/' + slug + '.md'), text: markdown },
    { path: sitePath_('blog/index.json'),            text: JSON.stringify(index, null, 2) + '\n' }
  ];
  images.forEach(function (img) {
    if (img.blob) { files.push({ path: sitePath_(img.webPath), bytes: img.blob.getBytes() }); }
  });

  commitFiles_(files, commitMessage);
}


/* =========================================================================
   4-2. 記事の修正と削除  完了メールのボタンから返信すると動きます
   ========================================================================= */

/** 完了メールの下に入れる目印。これより下は本文として扱いません。 */
var EDIT_SEPARATOR = '―――――（ここから下は消さないでください）―――――';

/** 使いかたの案内と、記事本文の境目。これより上は本文として扱いません。 */
var BODY_START = '―――――（ここから下が記事の本文です）―――――';

/**
 * メール本文から「#修正 記事ID」「#削除 記事ID」を探します。
 * 見つからなければ null（＝ふつうの新規投稿）を返します。
 */
function parseEditDirective_(rawBody) {
  var m = String(rawBody || '').match(/#\s*(修正|削除)\s+(\d{4}-\d{2}-\d{2}-[0-9a-z]+)/);
  return m ? { action: m[1], slug: m[2] } : null;
}

/**
 * 2つの目印のあいだを、記事の本文として取り出します。
 *   （上）使いかたの案内　→ BODY_START より上は捨てる
 *   （下）#修正 などの指示　→ EDIT_SEPARATOR より下は捨てる
 */
function bodyWithoutMarker_(rawBody) {
  var s = String(rawBody || '').replace(/\r\n?/g, '\n');

  var tail = s.indexOf(EDIT_SEPARATOR);
  if (tail >= 0) { s = s.slice(0, tail); }

  var head = s.indexOf(BODY_START);
  if (head >= 0) { s = s.slice(head + BODY_START.length); }

  return s.replace(/^\s*#\s*(修正|削除)\s+\S+\s*$/gm, '');
}

/** すでにGitHubにある、その記事の写真を一覧します。 */
function listExistingImages_(slug) {
  var path = sitePath_('blog/images/' + slug);
  var res  = githubApi_('GET', '/contents/' + encodeURI(path) + '?ref=' + CONFIG.GITHUB_BRANCH);
  if (!res || !res.length) { return []; }

  return res
    .filter(function (f) { return f.type === 'file' && /\.(jpe?g|png|gif|webp)$/i.test(f.name); })
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
    .map(function (f) { return { webPath: 'blog/images/' + slug + '/' + f.name }; });
}

/**
 * 既存の記事を、届いたメールの内容で書きかえます。
 * 写真はそのまま残り、新しく添付された写真はうしろに足されます。
 */
function editPost_(msg, slug) {
  var index = readIndexJson_();
  var current = null;
  for (var i = 0; i < index.posts.length; i++) {
    if (index.posts[i].slug === slug) { current = index.posts[i]; break; }
  }
  if (!current) {
    throw new Error('修正しようとした記事が見つかりません（' + slug + '）。すでに削除されていませんか。');
  }

  var cleaned = cleanBody_(bodyWithoutMarker_(msg.getPlainBody()));
  var found   = extractDirectives_(cleaned);
  var body    = found.body;

  if (!body.replace(/\s/g, '')) {
    throw new Error('本文が空でした。直した文章を書いてから送りなおしてください。');
  }

  var parsed = parseSubject_(msg.getSubject());
  var title  = found.values['タイトル'] || found.values['title'] || parsed.title || current.title;

  // もとの写真を残したうえで、今回あたらしく添付されたぶんを足します
  var kept   = listExistingImages_(slug);
  var images = kept.concat(collectImages_(msg, slug, kept.length));

  savePost_(slug, current.date, title, body, images,
            'ブログ記事を修正：' + title + ' (' + slug + ')');

  return { slug: slug, title: title, plainBody: body };
}

/** 記事を一覧から取りのぞきます（本文と写真のファイルはそのまま残します）。 */
function deletePost_(slug) {
  var index  = readIndexJson_();
  var before = index.posts.length;

  index.posts = index.posts.filter(function (p) { return p.slug !== slug; });
  if (index.posts.length === before) {
    throw new Error('削除しようとした記事が見つかりません（' + slug + '）。すでに削除されていませんか。');
  }

  index.generated = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");

  commitFiles_(
    [{ path: sitePath_('blog/index.json'), text: JSON.stringify(index, null, 2) + '\n' }],
    'ブログ記事を削除：' + slug);
}


/* ---------- 件名 ---------- */

function parseSubject_(subject) {
  var s = String(subject || '').trim();
  s = s.replace(/^\s*(?:re|fwd?|返信|転送)\s*[:：]\s*/i, '').trim();

  // 件名の先頭に ［お知らせ］ のような囲みがあれば、タイトルから取りのぞきます
  var m = s.match(/^[\[［【][^\]］】]{1,20}[\]］】]\s*(.*)$/);
  if (m && m[1].trim()) { s = m[1].trim(); }

  return { title: s };
}


/* ---------- 本文のそうじ ---------- */

function cleanBody_(text) {
  var body = String(text || '').replace(/\r\n?/g, '\n');

  // 返信の引用や署名より下を切り落とします
  var cutters = [
    /\n--\s*\n[\s\S]*$/,                       // 署名の区切り
    /\n-{4,}\s*Original Message[\s\S]*$/i,
    /\n-{4,}\s*元のメッセージ[\s\S]*$/,
    /\n\d{4}年\d{1,2}月\d{1,2}日[^\n]{0,40}:\n[\s\S]*$/,
    /\nOn .{5,60}wrote:\n[\s\S]*$/
  ];
  cutters.forEach(function (re) { body = body.replace(re, ''); });

  // スマホの自動署名
  body = body
    .replace(/\n*(iPhone|iPad|Android|Galaxy)から送信\s*$/i, '')
    .replace(/\n*Sent from my .*$/i, '');

  // 全角スペースだけの行は空行に、3行以上の空行は2行にまとめます
  body = body.replace(/^[ 　\t]+$/gm, '').replace(/\n{3,}/g, '\n\n');

  return body.replace(/^\s+|\s+$/g, '');
}

/**
 * 本文の先頭に書かれた「タイトル：〜」の指定を取り出します。
 * 指定がなければ、本文はそのまま返します。
 */
function extractDirectives_(body) {
  var lines  = body.split('\n');
  var values = {};
  var i = 0;

  while (i < lines.length) {
    var m = lines[i].match(/^\s*(タイトル|title)\s*[:：]\s*(.+?)\s*$/i);
    if (!m) { break; }
    values[m[1]] = m[2];
    values[m[1].toLowerCase()] = m[2];
    i++;
  }
  if (!i) { return { values: {}, body: body }; }

  while (i < lines.length && !lines[i].trim()) { i++; }
  return { values: values, body: lines.slice(i).join('\n') };
}

function makeExcerpt_(body) {
  var t = String(body || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')     // 画像を取りのぞく
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // リンクは文字だけ残す
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*`>_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return t.length > CONFIG.EXCERPT_LENGTH ? t.slice(0, CONFIG.EXCERPT_LENGTH) + '…' : t;
}

/** Markdown先頭の設定欄に安全に書ける形にします。 */
function yamlValue_(v) {
  return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/"/g, '”').trim();
}


/* =========================================================================
   5. 画像  取り出す → 横1200pxに縮める → 名前をつける
   ========================================================================= */

function collectImages_(msg, slug, startFrom) {
  var atts  = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
  var begin = startFrom > 0 ? startFrom : 0;   // すでにある写真の枚数（修正のとき）
  var out   = [];

  for (var i = 0; i < atts.length && begin + out.length < CONFIG.MAX_IMAGES_PER_POST; i++) {
    var att  = atts[i];
    var type = String(att.getContentType() || '').toLowerCase();

    if (type.indexOf('image/') !== 0) { continue; }
    if (att.getSize() > CONFIG.MAX_ATTACHMENT_BYTES) {
      Logger.log('大きすぎるため除外：' + att.getName());
      continue;
    }

    var blob = att.copyBlob();
    var resized;
    try {
      resized = resizeImage_(blob, CONFIG.IMAGE_MAX_WIDTH);
    } catch (e) {
      Logger.log('縮小に失敗したので、そのまま使います：' + att.getName() + ' / ' + e);
      resized = blob;
    }

    var ext = extensionFor_(resized.getContentType(), att.getName());
    var num = ('0' + (begin + out.length + 1)).slice(-2);

    out.push({
      blob: resized,
      webPath: 'blog/images/' + slug + '/' + num + ext
    });
  }

  return out;
}

/**
 * Googleドライブのサムネイル生成を使って写真を縮めます。
 * （Apps Script には画像を縮小する命令がないため、この方法を使います）
 * 横幅が maxWidth より小さい写真は、そのままの大きさで返ってきます。
 */
function resizeImage_(blob, maxWidth) {
  var folder = getWorkFolder_();
  var file   = folder.createFile(blob.setName('tmp-' + Date.now()));

  try {
    var token = ScriptApp.getOAuthToken();
    var link  = '';

    // アップロード直後はサムネイルがまだ無いことがあるので、数回待って取りに行きます
    for (var attempt = 0; attempt < 4 && !link; attempt++) {
      if (attempt) { Utilities.sleep(1200); }

      var res = UrlFetchApp.fetch(
        'https://www.googleapis.com/drive/v3/files/' + file.getId() + '?fields=thumbnailLink',
        { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });

      if (res.getResponseCode() === 200) {
        link = JSON.parse(res.getContentText()).thumbnailLink || '';
      }
    }
    if (!link) { throw new Error('サムネイルのURLを取得できませんでした'); }

    // 末尾の「=s220」などを「=w1200」に置きかえて、大きいサイズをもらいます
    var sized = link.replace(/=[swh]\d+(-[a-z0-9]+)*$/i, '=w' + maxWidth);
    if (sized === link) { sized = link + '=w' + maxWidth; }

    var img = UrlFetchApp.fetch(sized,
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });

    if (img.getResponseCode() !== 200) {
      throw new Error('縮小した画像を取得できませんでした（' + img.getResponseCode() + '）');
    }

    var out = img.getBlob();
    // 縮小後のほうが大きくなってしまった場合は、元の画像を使います
    return out.getBytes().length < blob.getBytes().length ? out : blob;

  } finally {
    try { file.setTrashed(true); } catch (ignore) {}
  }
}

/** 作業用フォルダ（中身はすぐ削除されます） */
function getWorkFolder_() {
  var NAME  = 'ブログ投稿_作業用（自動）';
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('WORK_FOLDER_ID');

  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) { return f; }
    } catch (ignore) {}
  }

  var folder = DriveApp.createFolder(NAME);
  props.setProperty('WORK_FOLDER_ID', folder.getId());
  return folder;
}

function extensionFor_(contentType, name) {
  var t = String(contentType || '').toLowerCase();
  if (t.indexOf('png')  >= 0) { return '.png'; }
  if (t.indexOf('webp') >= 0) { return '.webp'; }
  if (t.indexOf('gif')  >= 0) { return '.gif'; }
  if (t.indexOf('jpeg') >= 0 || t.indexOf('jpg') >= 0) { return '.jpg'; }

  var m = String(name || '').match(/(\.[A-Za-z0-9]{2,4})$/);
  return m ? m[1].toLowerCase() : '.jpg';
}


/* =========================================================================
   6. GitHub  1記事を1コミットにまとめて push
   ========================================================================= */

/** リポジトリの中での本当のパスにします（SITE_DIR を前につけます）。 */
function sitePath_(p) {
  var dir = String(CONFIG.SITE_DIR || '').replace(/^\/+|\/+$/g, '');
  return dir ? dir + '/' + p : p;
}

function githubApi_(method, path, payload) {
  var url = 'https://api.github.com/repos/' +
            CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + path;

  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + getGitHubToken_(),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (payload) {
    options.contentType = 'application/json; charset=utf-8';
    options.payload = JSON.stringify(payload);
  }

  var res  = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var text = res.getContentText();

  if (code === 404 && method === 'GET') { return null; }
  if (code < 200 || code >= 300) {
    throw new Error('GitHub API エラー（' + code + ' ' + method + ' ' + path + '）: ' + text);
  }
  return text ? JSON.parse(text) : {};
}

/** 現在の blog/index.json を読みます（まだ無ければ空の状態を返します）。 */
function readIndexJson_() {
  var path = sitePath_('blog/index.json');
  var res  = githubApi_('GET', '/contents/' + encodeURI(path) + '?ref=' + CONFIG.GITHUB_BRANCH);

  if (!res || !res.content) { return { generated: '', posts: [] }; }

  var raw  = Utilities.newBlob(Utilities.base64Decode(res.content.replace(/\s/g, ''))).getDataAsString('UTF-8');
  var data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('blog/index.json の形がこわれています。GitHubで中身をご確認ください。');
  }

  if (Array.isArray(data)) { data = { generated: '', posts: data }; }
  if (!Array.isArray(data.posts)) { data.posts = []; }
  return data;
}

/**
 * 複数のファイルを1つのコミットにまとめて push します。
 * files: [{ path, text }] または [{ path, bytes }]
 */
function commitFiles_(files, message) {
  var ref        = githubApi_('GET', '/git/ref/heads/' + CONFIG.GITHUB_BRANCH);
  if (!ref) { throw new Error('ブランチ ' + CONFIG.GITHUB_BRANCH + ' が見つかりません。'); }

  var parentSha  = ref.object.sha;
  var baseCommit = githubApi_('GET', '/git/commits/' + parentSha);

  var tree = files.map(function (f) {
    var content = f.bytes
      ? Utilities.base64Encode(f.bytes)
      : Utilities.base64Encode(f.text, Utilities.Charset.UTF_8);

    var blob = githubApi_('POST', '/git/blobs', { content: content, encoding: 'base64' });
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
  });

  var newTree = githubApi_('POST', '/git/trees', {
    base_tree: baseCommit.tree.sha,
    tree: tree
  });

  var commit = githubApi_('POST', '/git/commits', {
    message: message,
    tree: newTree.sha,
    parents: [parentSha]
  });

  githubApi_('PATCH', '/git/refs/heads/' + CONFIG.GITHUB_BRANCH, { sha: commit.sha, force: false });

  return commit.sha;
}


/* =========================================================================
   7. こまごました部品
   ========================================================================= */

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function extractEmail_(from) {
  var m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(from || '')).trim().toLowerCase();
}

/** メールIDから、短くて重ならない文字列を作ります（記事のURLに使います）。 */
function shortHash_(seed) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(seed));
  var hex   = bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return hex.slice(0, 6);
}

/**
 * サイトのURL。スクリプト プロパティの SITE_URL があればそちらを使います。
 * おしまいの「/」は取りのぞきます。
 */
function siteUrl_() {
  var u = PropertiesService.getScriptProperties().getProperty('SITE_URL') || CONFIG.SITE_URL;
  return String(u || '').trim().replace(/\/+$/, '');
}

function postUrl_(slug) {
  return siteUrl_() + '/blog-post.html?slug=' + slug;
}

function threadHasLabel_(thread, name) {
  return thread.getLabels().some(function (l) { return l.getName() === name; });
}

/**
 * 投稿用Gmailのアドレス（完了メールのボタンの宛先に使います）。
 * 以前はGoogleに問い合わせていましたが、自動実行のときに空で返ることがあり、
 * 宛先の入っていないボタンができてしまったため、設定の値を使うようにしました。
 */
function blogAddress_() {
  var a = String(CONFIG.BLOG_ADDRESS || '').trim();
  if (a) { return a; }

  var list = getAllowedSenders_();
  return list.length ? list[0] : '';
}

/**
 * 「修正」「削除」のメールを、宛先・件名・本文まで用意ずみで開くリンクを作ります。
 * ボタンを押すと、ふだんのメールソフトで作成画面が開きます。
 */
function editMailto_(action, slug, title, currentBody) {
  var body;

  if (action === '削除') {
    body = 'この記事をブログから消します。何も書きかえずに、そのまま送信してください。\n\n'
         + EDIT_SEPARATOR + '\n#削除 ' + slug + '\n';
  } else {
    // 本文が長すぎるとリンクに収まらないので、その場合は入れずにご案内だけにします
    var text  = String(currentBody || '');
    var guide = (text && text.length <= 1200)
      ? '【使いかた】下の「記事の本文」のところを、直したいように書きかえて送信してください。\n'
        + 'この案内の部分は、記事には入りません。\n'
        + '写真はそのまま残ります。新しく添付すると、うしろに足されます。\n'
      : '【使いかた】下の「記事の本文」のところに、直した本文を「まるごと」書いてください。\n'
        + '書いた内容で記事が置きかわります。この案内の部分は、記事には入りません。\n'
        + '（本文が長いため、いまの文章は入れていません。写真はそのまま残ります）\n';

    body = guide + '\n' + BODY_START + '\n\n'
         + text + '\n\n' + EDIT_SEPARATOR + '\n#修正 ' + slug + '\n';
  }

  // 宛先はそのまま書きます（＠を %40 にすると、開けないメールソフトがあります）
  return 'mailto:' + blogAddress_()
       + '?subject=' + encodeURIComponent('[' + action + '] ' + title)
       + '&body='    + encodeURIComponent(body);
}

function button_(url, label, color) {
  // HTMLの中では & をそのまま書けないので、&amp; に直します
  url = String(url).replace(/&/g, '&amp;');
  return '<a href="' + url + '" style="display:inline-block;padding:12px 22px;margin:0 8px 8px 0;'
       + 'background:' + color + ';color:#fff;text-decoration:none;border-radius:999px;'
       + 'font-weight:bold;font-size:15px;">' + label + '</a>';
}

/**
 * 投稿・修正が終わったことを、送信者に返信でお知らせします。
 * あわせて「修正」「削除」のボタンを付けます。
 */
function sendSuccessMail_(msg, posted, wasEdit) {
  try {
    var what     = wasEdit ? '修正' : '投稿';
    var editUrl  = editMailto_('修正', posted.slug, posted.title, posted.plainBody);
    var delUrl   = editMailto_('削除', posted.slug, posted.title, '');

    var plain =
      'ブログに' + what + 'しました。\n\n' +
      '　タイトル：' + posted.title + '\n' +
      '　記事のURL：' + postUrl_(posted.slug) + '\n' +
      '　記事ID：' + posted.slug + '\n\n' +
      '■ 直したいとき\n' +
      'このメールに返信し、直した本文を書いて、いちばん下に次の1行を入れて送ってください。\n' +
      '　#修正 ' + posted.slug + '\n\n' +
      '■ 消したいとき\n' +
      'このメールに返信し、次の1行だけ書いて送ってください。\n' +
      '　#削除 ' + posted.slug + '\n\n' +
      '（返信ではなく新しいメールで送るときの宛先： ' + blogAddress_() + '）\n' +
      '（このメールは自動で送られています）';

    var html =
      '<div style="font-family:sans-serif;font-size:15px;line-height:1.9;color:#222">' +
      '<p>ブログに<strong>' + what + 'しました</strong>。</p>' +
      '<table style="border-collapse:collapse;margin:16px 0">' +
      '<tr><td style="padding:4px 14px 4px 0;color:#777">タイトル</td><td style="padding:4px 0"><strong>' +
        escapeHtml_(posted.title) + '</strong></td></tr>' +
      '<tr><td style="padding:4px 14px 4px 0;color:#777">記事ID</td><td style="padding:4px 0">' +
        escapeHtml_(posted.slug) + '</td></tr>' +
      '</table>' +
      '<p style="margin:22px 0 10px">直したいときは、下のボタンを押してください。' +
      'メールの作成画面が開くので、そのまま送れば記事に反映されます。</p>' +
      '<p style="margin:0 0 18px">' +
        // 絵文字やHTMLの記号は、メールソフトによって文字化けするので使いません
        button_(editUrl, 'この記事を修正する', '#c2185b') +
        button_(delUrl,  'この記事を削除する', '#777777') +
      '</p>' +
      '<p style="font-size:13px;color:#777;margin-top:24px">' +
      '「修正」は、書いた本文で記事をまるごと置きかえます。写真はそのまま残り、' +
      '新しく添付した写真はうしろに足されます。<br>' +
      'ボタンが押せないときは、このメールにそのまま返信して、いちばん下に ' +
      '<code>#修正 ' + escapeHtml_(posted.slug) + '</code> と書いて送ってください。<br>' +
      '新しいメールで送るときの宛先は <strong>' + escapeHtml_(blogAddress_()) + '</strong> です。' +
      '</p></div>';

    msg.reply(plain, { htmlBody: html });

  } catch (e) {
    Logger.log('完了メールを送れませんでした：' + e);
  }
}

function sendDeletedMail_(msg, slug) {
  try {
    msg.reply(
      'ブログから記事を削除しました。\n\n' +
      '　記事ID：' + slug + '\n\n' +
      '一覧と記事ページから見えなくなりました。\n' +
      '（本文と写真のファイルはGitHubに残っているので、必要なら元に戻せます）\n\n' +
      '（このメールは自動で送られています）');
  } catch (e) {
    Logger.log('削除のお知らせを送れませんでした：' + e);
  }
}

function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sendErrorMail_(msg, err) {
  try {
    msg.reply(
      'ブログへの投稿に失敗しました。おそれ入りますが、下の内容を広報係にお伝えください。\n\n' +
      '　件名：' + msg.getSubject() + '\n' +
      '　エラー：' + (err && err.message ? err.message : err) + '\n\n' +
      '（このメールは自動で送られています）');
  } catch (e) {
    Logger.log('エラーメールを送れませんでした：' + e);
  }
}


/* =========================================================================
   8. 手で動かして確かめたいとき
   ========================================================================= */

/** いまGmailにある未読のうち、記事になりそうなメールを一覧します（投稿はしません）。 */
function dryRun() {
  var threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, 10);
  if (!threads.length) { Logger.log('対象のメールはありません。'); return; }

  var allowed = getAllowedSenders_();
  Logger.log('投稿を許可しているアドレス：' + allowed.join(' / '));

  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) {
      if (!m.isUnread()) { return; }
      var from = extractEmail_(m.getFrom());
      var ok   = allowed.indexOf(from) >= 0;
      var p    = parseSubject_(m.getSubject());
      var imgs = m.getAttachments({ includeInlineImages: true, includeAttachments: true })
                  .filter(function (a) { return /^image\//i.test(a.getContentType() || ''); });

      var order = parseEditDirective_(m.getPlainBody());
      var kind  = order ? (order.action + '（記事ID：' + order.slug + '）') : '新規投稿';

      Logger.log(
        (ok ? '○ ' : '× 許可外 ') + from +
        '｜' + kind +
        '｜タイトル：' + p.title +
        '｜写真：' + imgs.length + '枚');
    });
  });
}

/** 自動実行を止めたいとき。 */
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processBlogMail') { ScriptApp.deleteTrigger(t); }
  });
  Logger.log('自動実行を解除しました。');
}
