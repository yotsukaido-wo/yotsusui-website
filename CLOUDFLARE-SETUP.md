# Cloudflare Pages への引っ越し手順

四街道吹奏楽団　ホームページ

---

## なぜ引っ越すのか

いま使っている Netlify は、無料だと **1か月に20回しかサイトを公開できません**（300クレジット ÷ 1回15クレジット）。ブログを1本出すたびに1回ぶん使うので、団員の方が気軽に投稿するには足りません。

Cloudflare Pages は、無料で **1か月に500回** です。25倍あるので、毎日投稿しても足りなくなりません。

| | Netlify 無料 | Cloudflare Pages 無料 |
|---|---|---|
| 公開できる回数 | 月20回 | 月500回 |
| ファイル数の上限 | — | 2万個（いまは116個） |
| 1ファイルの上限 | — | 25MiB（いまは最大0.2MB） |
| 独自ドメイン | 使える | 使える（100個まで） |

ブログの仕組み（メールを送ると記事になる）は、**そのまま動きます。**Google 側の仕組みは GitHub に書き込んでいるだけで、その先がどこかを知らないためです。

---

## 進めかた

**いきなり乗りかえません。**しばらく両方で動かして、Cloudflare のほうが問題なく表示されることを確かめてから、Netlify をやめます。両方とも同じ GitHub を見にいくので、並行して動かせます。

---

## 手順1　Cloudflare のアカウントを作る

1. https://dash.cloudflare.com/sign-up を開きます
2. 団のアドレス（`yotsukaido.wo@gmail.com`）で登録します
3. 届いたメールのリンクを押して、本登録をすませます

クレジットカードの登録は要りません。

---

## 手順2　GitHub とつなぐ

1. Cloudflare の画面で **Compute (Workers)** → **Workers & Pages** を開きます
2. **Create** を押します
3. **Pages** のタブに切りかえます
4. **Connect to Git** を押します
5. GitHub との連携をたずねられるので、**ご自身で許可してください**
6. リポジトリの一覧から `yotsukaido-wo/yotsusui-website` を選びます

---

## 手順3　作りかたの設定

次の画面で、こう入れます。**ここを間違えると表示されません。**

| 項目 | 入れる値 |
|---|---|
| Project name | `yotsusui`（お好きな名前。URLになります） |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | **空のまま**（何も入れない） |
| Build output directory | `/` |

このサイトは組み立て作業が要らない作りなので、Build command は空で正解です。

**Save and Deploy** を押すと、1〜2分でできあがります。

---

## 手順4　表示を確かめる

できあがると `https://○○○.pages.dev` というURLがもらえます。次のページを開いて、Netlify のときと同じに見えるか確かめてください。

- トップページ
- ブログ一覧（`/blog.html`）
- ブログ記事（一覧から1本開く）
- 定期演奏会の記録（`/concert.html`）
- ウィンターコンサートの記録（`/winter.html`）
- 写真がちゃんと出ているか
- スマホでも崩れていないか

### `.html` が消えることについて

Cloudflare は `/concert.html` を `/concert` に転送します。**リンクは切れません**が、アドレス欄の見ために `.html` が出なくなります。これは Cloudflare の仕様です。

---

## 手順5（任意）独自ドメインを取る

`.netlify.app` や `.pages.dev` は、置き場所を変えるたびにURLが変わってしまいます。独自ドメイン（例：`yotsusui.com`）を取っておくと、**今後どこに引っ越してもURLは変わりません。**

- 年1,000〜2,000円ほどです
- 団のチラシやSNSに書いても見栄えがします
- Cloudflare の画面で、Pages のプロジェクト → **Custom domains** から設定します

URLがどのみち変わるこのタイミングが、取りどきです。

---

## 手順6　切り替える

Cloudflare のほうで問題がないと確かめられたら、仕上げをします。**この作業をするまでは、Netlify を消さないでください。**

### 6-1　サイトの中の設定を直す

新しいURLが決まってから、次の場所を書きかえます。

| 場所 | いまの中身 | 直したあと |
|---|---|---|
| `blog.html` 8行目 | `https://yotsukaido-wo.netlify.app/blog.html` | 新しいURL |
| `concert.html` 8行目 | `https://yotsukaido-wo.netlify.app/concert.html` | 新しいURL |
| `winter.html` 8行目 | `https://yotsukaido-wo.netlify.app/winter.html` | 新しいURL |

これは「このページの正式なアドレスはこれです」と検索エンジンに伝えるための行です。古いままだと、消えたアドレスを指してしまいます。

あわせて、用意してある **`_redirects`** というファイルを GitHub に入れます。制作中に使っていた `/onepage.html` をトップページへ転送するためのものです（Netlify では `netlify.toml` に書いてありましたが、Cloudflare はこのファイルを見ます）。

### 6-2　ブログの完了メールの行き先を直す

Apps Script の画面を開き、**「プロジェクトの設定」→「スクリプト プロパティ」**に、次を足します。

| プロパティ名 | 値 |
|---|---|
| `SITE_URL` | 新しいURL（例：`https://yotsusui.com`） |

コードを書きかえる必要はありません。ここを入れると、完了メールの「記事を見る」リンクが新しいURLになります。

### 6-3　Netlify を止める

**ここを忘れると、ブログを投稿するたびに Netlify のクレジットも減りつづけます。**

Netlify の画面で、プロジェクトの設定から**自動ビルドを止める**か、プロジェクトごと削除します。

---

## 困ったときに見るところ

| 困ったこと | 見るところ |
|---|---|
| ページが真っ白 | Build output directory が `/` になっているか |
| 見ためが崩れる | Build command を空にしたか（何か入れると失敗します） |
| ブログ記事が出ない | GitHub に記事が入っているか。Cloudflare の Deployments に失敗が出ていないか |
| 写真が出ない | 1ファイル25MiBを超えていないか |

---

## 参考

- Cloudflare Pages の制限： https://developers.cloudflare.com/pages/platform/limits/
- Netlify からの引っ越し案内： https://developers.cloudflare.com/pages/migrations/migrating-from-netlify/
