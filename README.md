# 四街道吹奏楽団 Yotsukaido Wind Orchestra ホームページ（サンプル）

旧サイト（Ameba Ownd）を引き継ぐ形で作成した、HTML + CSS のみのシンプルなサイトです。
特別なソフトやサーバー機能は不要で、ファイルをレンタルサーバーにアップロードするだけで公開できます。

## ファイル構成

```
index.html        トップページ（ワンページ版。1枚のページに全内容）
index-multipage.html  旧マルチページ版のトップページ（保管用。どこからもリンクしていません）
profile.html      プロフィール（楽団紹介・楽団概要・指揮者紹介）
contact.html      見学・お問合せ（Googleフォーム埋め込み・見学の流れ・FAQ）
schedule.html     練習日程（フリカレのカレンダー埋め込み・練習場所）
recruit.html      団員募集（活動概要・応募条件・団員構成・入団までの流れ）
activity.html     活動記録（令和8年度の活動・これまでの歩み）
concert.html      定期演奏会（第1回〜第4回の記録）
winter.html       ウィンターコンサート（2026年の案内・2018年〜の曲目）
blog.html         よつすいブログ 一覧（新しい順に横スクロール）
blog-post.html    ブログ記事ページ（blog/posts の .md を読んで表示）
movie.html        ヨツスイ動画紹介（YouTube動画カード 8枠）
link.html         リンク（公式SNS・関連団体・相互リンク案内）
assets/style.css  全ページ共通のデザイン
assets/script.js  スマホメニューの開閉・動画カードの自動生成
assets/blog.css   ブログのデザイン
assets/blog.js    ブログの表示（記事の読み込み・Markdown変換）
blog/index.json   記事の一覧データ（メール投稿で自動更新）
blog/posts/*.md   記事の本文（メール投稿で自動追加）
blog/images/      記事の写真（メール投稿で自動追加）
gas/email-to-post.gs  メール投稿の仕組み（Google Apps Scriptに貼りつけるコード）
robots.txt        検索ロボットへのあいさつ文（sitemapの場所を伝える）
sitemap.xml       ページの一覧表（tools/make-sitemap.py が作る）
tools/make-sitemap.py  sitemap.xml を作りなおす道具
_headers          Netlifyのキャッシュ設定
```

## ブログ（メールを送るだけで更新される仕組み）

ブログ投稿専用のGmailに記事をメールすると、5分以内にサイトへ反映されます。
GitHubのトークン発行・Netlify・Apps Scriptの設定手順は **`BLOG-SETUP.md`** にまとめてあります。

## Google 検索に出るようにする（SEO）

タイトル・説明文・構造化データ・robots.txt・sitemap.xml はすでに入れてあります。
残っているのは Google Search Console への登録（要ログイン作業）です。
手順は **`SEO-SETUP.md`** にまとめてあります。

## 公開前に差し替えが必要な箇所

HTMLの中に `<!-- TODO: ... -->` というコメントを入れてあります。検索すると見つかります。

| 場所 | 内容 |
|---|---|
| `blog.html` | 公開URLが決まったら `<link rel="canonical">` を書きかえ |
| `concert.html` | 第1回〜第4回の曲目 |
| 各ページに残る `.photo-ph` | 写真（集合写真・本番写真など、まだ入っていない場所） |

### 入れ替え済みの画像

| ファイル | 使っている場所 |
|---|---|
| `images/kaise-eiji.jpg` | 指揮者紹介（`index.html` / `profile.html`） |
| `images/fire-festival-2026.png` | 消防フェスティバル四街道2026（`index.html`） |
| `images/winter-concert-2026.jpg` | ウインターコンサート2026（`index.html` / `winter.html`） |
| `images/ensemble-2027.jpg` | アンサンブル発表会（`index.html`） |

公式YouTubeチャンネルの新しい10本を `movie.html` / `index.html` の一覧に設定済みです。
サムネイルはYouTubeの画像をそのまま読み込んでいます（動画IDから自動）。

### 楽団紹介のスライドショー（ワンページ版）

`images/about-1.jpg`〜`about-8.jpg`（8枚）が3秒ごとに切り替わります。

- 写真を変える：同じ名前で画像を差し替えるだけです
- 枚数を変える：`index.html` の `<img class="slide" ...>` と、その下の `<i></i>`（点）を同じ数だけ増減します
- 速さを変える：`assets/onepage.js` の `SLIDE_INTERVAL`（ミリ秒）を書きかえます

マウスを乗せている間と、別のタブを見ている間は止まります。

teket の公演ページURLは `https://teket.jp/15970/78556` に設定済みです。

### 写真の入れ方

`images` というフォルダを作って画像を置き、プレースホルダを置きかえます。

```html
<!-- 置きかえる前 -->
<div class="photo">
  <div class="photo-ph">
    <span class="ico" aria-hidden="true">📷</span>
    <span class="txt">当日の写真を入れる場所</span>
  </div>
</div>

<!-- 置きかえた後 -->
<div class="photo">
  <img src="images/concert04-01.jpg" alt="第4回定期演奏会 全体合奏のようす">
</div>
```

`alt` には写真の内容を短く書いてください（読み上げソフトや、画像が表示できないときに使われます）。

### 動画の入れ方

`movie.html` の下のほうにある一覧を書きかえるだけです。サムネイルは動画IDから自動表示されます。

```js
window.YOTSUSUI_VIDEOS = [
  { id: "AbCdEfGh123", title: "アルヴァマー序曲", date: "2025.12.21", note: "ウインターコンサート2025" },
  ...
];
```

動画IDは YouTube のURL `https://www.youtube.com/watch?v=AbCdEfGh123` の `v=` のうしろの部分です。

### SNSのアカウントを変えるとき（ワンページ版）

`index.html` の最初の画面（ファーストビュー）に、
「団員募集を見る」ボタンのとなりへ Instagram → X → YouTube の順で
丸いアイコンボタンを並べています。`hero-sns` という目印で探して、
`href="..."` のURLを書きかえてください。
CTA部分とフッターにも同じリンクがあるので、あわせて直してください。

### Googleフォームの高さ

`assets/onepage.css` の `.embed-form iframe { height: ... }` で調整します。
1ページ目の高さ（PC約545px／スマホ約640px）にあわせて詰めてあります。
2ページ目以降は質問が多いので、枠の中でスクロールします。

### 記事・公演を追加するとき

`concert.html` / `winter.html` の中に（ブログはメール投稿で自動追加されます）

```
<!-- ▼▼ 新しい公演は、このブロックをコピーしてここに追加してください ▼▼ -->
```

という目印を入れてあります。そのブロックをコピーして、日付とタイトルを書きかえてください。

## デザインの方針

- 白を基調に、藍色（`#23506f`）と真鍮色（`#a98a4b`）をアクセントに使用
- 本文は 18px・行間 1.9、ボタンは高さ 60px 以上（高齢の方でも読みやすく、押しやすく）
- スマートフォン・タブレット・パソコンに対応（画面幅1000px以下でメニューがハンバーガーに変わります）
- 色の指定は `assets/style.css` の先頭 `:root` にまとめてあるので、まとめて変更できます

## 動作確認

ファイルをダブルクリックしてブラウザで開けば確認できます。
埋め込み（Googleフォーム・フリカレ）はインターネット接続が必要です。

---

## 内容について確認が必要な点

- **第4回定期演奏会の日付**：旧サイトの表記（2025.5.17）と活動記録（令和8年度5月）が合わないため、`concert.html` では **2026年5月17日** としています。正しい日付をご確認ください。
- **第1回〜第3回定期演奏会の会場**：旧サイトに記載がなかったため「四街道市文化センター 大ホール」としています。
- **お知らせの日付**：トップページのお知らせの日付は仮の値です。
