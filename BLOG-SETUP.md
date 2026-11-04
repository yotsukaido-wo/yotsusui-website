# メールを送るだけでブログが更新される仕組み　設定手順

ブログ投稿専用のGmail（`yotsukaido.wo.pr@gmail.com`）にメールを送ると、
5分以内に記事がホームページに追加されます。

```
　投稿者 ──メール──▶ Gmail
　　　　　　　　　　　 │ 5分おきにチェック（Google Apps Script）
　　　　　　　　　　　 ▼
　　　　　　　　 Markdown + 縮小した写真
　　　　　　　　　　　 │ GitHub API でコミット
　　　　　　　　　　　 ▼
　　　　　　　　　　GitHub ──自動ビルド──▶ Netlify ──▶ ブログに反映
```

---

## 0. ファイルの置きかた

GitHubのリポジトリには、`site` フォルダの **中身** をそのまま入れてください。

```
リポジトリの直下
├── onepage.html          ← サイト本体
├── blog.html             ← ブログ一覧
├── blog-post.html        ← 記事ページ
├── _headers              ← Netlifyのキャッシュ設定
├── assets/
│   ├── onepage.css
│   ├── onepage.js
│   ├── blog.css          ← 追加
│   └── blog.js           ← 追加
├── images/
├── blog/                 ← 追加（ここがブログのデータ置き場）
│   ├── index.json        ← 記事の一覧。GASが自動で書きかえます
│   ├── posts/            ← 記事本文（.md）。GASが自動で追加します
│   └── images/           ← 記事の写真。GASが自動で追加します
└── gas/
    └── email-to-post.gs  ← Apps Scriptに貼りつけるコード（公開はされません）
```

> `site` フォルダごと push する場合は、Apps Script の `CONFIG.SITE_DIR` を
> `'site'` に変えてください。直下に置くなら `''` のままでOKです。

---

## 1. GitHub のリポジトリを用意する

1. GitHub に `yotsukaido-wo` でログインします。
2. 新しいリポジトリ **`yotsusui-website`** を作ります（Public）。
3. 上の構成でファイルを push します。

Apps Script の `CONFIG.GITHUB_REPO` は `'yotsusui-website'` に設定済みです。
別の名前にした場合は、そこを書きかえてください。

---

## 2. GitHub のアクセストークン（PAT）を発行する

GitHub の画面右上のアイコン →
**Settings** → 左下の **Developer settings** →
**Personal access tokens** → **Fine-grained tokens** → **Generate new token**

| 項目 | 設定する値 |
|---|---|
| Token name | `yotsukaido-blog-gas`（分かる名前なら何でも可） |
| Expiration | 1年など。※期限が切れると投稿が止まるので、カレンダーに入れておく |
| Repository access | **Only select repositories** → 作ったリポジトリだけを選ぶ |
| Repository permissions → **Contents** | **Read and write** ← これが必須 |
| そのほかの権限 | すべて **No access** のままでOK |

> `Metadata: Read-only` は自動で付きます。そのままにしてください。

**Generate token** を押すと `github_pat_...` という文字列が1回だけ表示されます。
この画面を閉じると二度と見られないので、コピーして次の手順へ進んでください。

<details>
<summary>Classic token を使う場合</summary>

**Personal access tokens (classic)** → **Generate new token (classic)** →
スコープは **`repo`** だけにチェック。
文字列は `ghp_...` で始まります。
</details>

---

## 3. Netlify につなぐ

1. Netlify にログイン → **Add new site** → **Import an existing project**
2. GitHub を選び、作ったリポジトリを選択します。
3. ビルド設定は次のとおり（ビルド作業は不要なサイトです）。

| 項目 | 値 |
|---|---|
| Build command | **空のまま** |
| Publish directory | `.`（`site` フォルダごと push した場合は `site`） |
| Branch to deploy | `main` |

これで、GitHubに新しいコミットが入るたびに自動で公開されます（1〜2分）。

公開URLが決まったら、`blog.html` の `<link rel="canonical">` と、
Apps Script の `postUrl_()` の中のURLを、実際のURLに書きかえてください。

---

## 4. Google Apps Script を設定する

### 4-1. プロジェクトを作る

1. **ブログ投稿専用のGmail（`yotsukaido.wo.pr@gmail.com`）でログイン**します。
   　※ 必ずこのアカウントで作成してください。別のアカウントだとメールを読めません。
2. [script.google.com](https://script.google.com/) を開き、**新しいプロジェクト**。
3. プロジェクト名を「よつすいブログ メール投稿」などにします。
4. `コード.gs` の中身をすべて消し、`gas/email-to-post.gs` の中身を貼りつけます。

### 4-2. 設定を書きかえる

ファイルの上のほう、`var CONFIG = {` の中を確認します。

| 項目 | 書く内容 |
|---|---|
| `GITHUB_OWNER` | `yotsukaido-wo`（そのままでOK） |
| `GITHUB_REPO` | **手順1で作ったリポジトリ名** |
| `GITHUB_BRANCH` | `main` |
| `SITE_DIR` | リポジトリ直下にサイトを置いたなら `''` |
| `ALLOWED_SENDERS` | **投稿を許可するメールアドレス**（複数可） |

### 4-3. トークンを保存する

左のメニュー **⚙ プロジェクトの設定** → いちばん下の
**スクリプト プロパティ** → **スクリプト プロパティを追加**

| プロパティ | 値 |
|---|---|
| `GITHUB_TOKEN` | 手順2でコピーしたトークン |

> コードの中にトークンを直接書かないでください。
> 書いてしまうと、GitHubにコードを置いたときに漏れてしまいます。

### 4-4. 動かしてみる

1. 上の関数リストから **`setup`** を選び、**実行**。
   - 初回は「承認が必要です」と出ます →
     **詳細** → **（安全ではないページ）に移動** → **許可**
     （Googleが作ったアプリではないための表示です。自分で作ったスクリプトなので問題ありません）
   - Gmail・Googleドライブ・外部接続の許可を求められます。すべて許可してください。
   - これでラベル2つと、**5分おきの自動実行**が作られます。
2. **`testConnection`** を実行し、実行ログに
   `書き込み権限：あり ✓` と出れば成功です。
3. ブログ用Gmailあてに、件名と写真をつけたテストメールを送ります。
4. 5分以内に返信メールが届き、ブログに記事が増えていれば完成です。

---

## 5. 記事の書きかた（投稿する人むけ）

ブログ投稿専用のGmailあてに、ふつうにメールを送るだけです。

| メールの場所 | ブログでの扱い |
|---|---|
| **件名** | 記事のタイトル |
| **件名の先頭 `［お知らせ］`** | カテゴリー（省略すると「お知らせ」） |
| **本文** | 記事の本文。空の行で段落が分かれます |
| **添付写真** | 1枚目が一覧のサムネイル、2枚目以降は本文の下に並びます |

### 件名の例

```
［練習日誌］今日の合奏はアルヴァマー序曲から
```

### 本文で使える書きかた（使わなくても大丈夫です）

```
カテゴリ：本番レポート          ← 本文の先頭に書くと、件名より優先されます

## 小見出しにしたいとき

ふつうに書いた文は、そのまま段落になります。

- 箇条書きは行頭にハイフン
- もうひとつ

> 引用したいときは行頭に大なり記号

[写真2] ← この場所に2枚目の写真が入ります
```

### 気をつけること

- `ALLOWED_SENDERS` に書いたアドレスから送ってください。ほかの人のメールは無視されます。
- 写真は横1200pxに自動で縮小・軽量化されます。元の写真はそのまま送って大丈夫です。
- 送信後、処理されたメールには **「ブログ投稿済み」** ラベルが付き、既読になります。
- 失敗したメールには **「ブログ投稿エラー」** ラベルが付き、理由が返信で届きます。

---

## 6. 困ったときに

| 症状 | 見るところ |
|---|---|
| 記事が増えない | Apps Script の **実行数** タブでエラーを確認 |
| `GITHUB_TOKEN が設定されていません` | 手順4-3のスクリプト プロパティ |
| `GitHub API エラー（401）` | トークンの期限切れ。発行しなおして入れかえる |
| `GitHub API エラー（403 / 404）` | トークンの Repository access に、そのリポジトリが入っているか確認 |
| 写真が大きいまま | Googleドライブの権限が許可されているか確認（`setup` を実行しなおす） |
| GitHubは更新されたのにサイトが古い | Netlify の **Deploys** でビルドが成功しているか確認 |

投稿を一時的に止めたいときは、Apps Script で **`removeTriggers`** を実行します。
再開は **`setup`** です。

### 手で確かめたいとき

| 関数 | すること |
|---|---|
| `dryRun` | いま未読のメールが、どんな記事になるかをログに出す（投稿はしない） |
| `testConnection` | GitHubにつながるか、書き込めるかを確認する |
| `processBlogMail` | 5分待たずに、いますぐ処理する |

---

## 7. 記事を直したい・消したいとき

GitHub上でファイルを編集すれば、そのままサイトに反映されます。

| したいこと | 操作 |
|---|---|
| 本文を直す | `blog/posts/<記事のID>.md` を編集 |
| タイトルや抜粋を直す | 上の `.md` と `blog/index.json` の両方を直す |
| 記事を消す | `blog/index.json` から該当の `{ ... }` を削除（`.md` は残しても害はありません） |
| 表示順を変える | `blog/index.json` の `date` を変える（新しい日付が上に来ます） |

1ページに出す記事の数は `assets/blog.js` の先頭、`PER_PAGE`（初期値9）で変えられます。
