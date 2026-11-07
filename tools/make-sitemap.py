# -*- coding: utf-8 -*-
"""
=========================================================
 sitemap.xml（ページの一覧表）を作りなおす道具
=========================================================

 sitemap.xml は、Google に「このサイトにはこのページがあります」と
 まとめて知らせるための一覧表です。

 ■ 使いかた
     サイトのフォルダで、次の1行を実行してください。

         python tools/make-sitemap.py

     ブログ記事は blog/index.json から自動で読みこみます。
     できあがった sitemap.xml を、ふだんどおり GitHub に上げれば終わりです。

 ■ いつ使う？
     ・ページ（.html）を増やしたり減らしたりしたとき
     ・ブログ記事をたくさん足したあと（急がなければ、やらなくても大丈夫です）

 ■ ページを増やしたときは
     下の PAGES の表に1行足してください。
         ("ファイル名.html", "公開URLの後ろ", 重要度)
     重要度は 0.0〜1.0 で、トップページを 1.0 にしています。
"""

import io
import json
import os
import subprocess
import sys
from datetime import datetime

# サイトの住所（独自ドメインに変えたら、ここを直してください）
SITE = "https://yotsusui-website.pages.dev"

# このファイルから見て、ひとつ上がサイトのフォルダです
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 一覧表に載せるページ
#   （ファイル名, URLの後ろ, 重要度）
#   ※ 載せないページ
#      ・404.html … ページが見つからなかったときの画面
#      ・index-multipage.html / link.html / profile.html
#        … 制作中に作った、いまは使っていないページ。
#          _redirects で404ページへ飛ばしているので、sitemap にも載せません。
#          もう一度サイトで使うようになったら、_redirects の行を消して、
#          下の PAGES に1行もどしてください。
PAGES = [
    ("index.html",    "/",          "1.0"),
    ("concert.html",  "/concert",   "0.9"),
    ("winter.html",   "/winter",    "0.8"),
    ("recruit.html",  "/recruit",   "0.9"),
    ("contact.html",  "/contact",   "0.8"),
    ("schedule.html", "/schedule",  "0.8"),
    ("activity.html", "/activity",  "0.7"),
    ("movie.html",    "/movie",     "0.7"),
    ("blog.html",     "/blog",      "0.7"),
]


def last_modified(path):
    """そのファイルを最後に直した日（YYYY-MM-DD）を返します。"""
    full = os.path.join(ROOT, path)
    # まず Git の記録を見ます（どのパソコンでも同じ日付になるので確実です）
    try:
        out = subprocess.check_output(
            ["git", "log", "-1", "--format=%cs", "--", path],
            cwd=ROOT, stderr=subprocess.STDOUT)
        day = out.decode("utf-8", "replace").strip()
        if len(day) == 10:
            return day
    except Exception:
        pass
    # Git が使えないときは、ファイルの更新日時を使います
    return datetime.fromtimestamp(os.path.getmtime(full)).strftime("%Y-%m-%d")


def blog_posts():
    """blog/index.json から、記事の一覧（URLの後ろ, 日付）を読みます。"""
    index_path = os.path.join(ROOT, "blog", "index.json")
    if not os.path.exists(index_path):
        print("  ※ blog/index.json が見つからないので、記事は載せません。")
        return []
    with io.open(index_path, encoding="utf-8") as f:
        data = json.load(f)
    items = []
    for post in data.get("posts", []):
        slug = str(post.get("slug", "")).strip()
        if not slug:
            continue
        date = str(post.get("date", "")).strip()
        items.append(("/blog-post?slug=" + slug, date if len(date) == 10 else None))
    return items


def url_entry(loc, lastmod, changefreq, priority):
    # XML では & をそのまま書けないので &amp; に直します
    loc = loc.replace("&", "&amp;")
    lines = ["  <url>", "    <loc>%s</loc>" % loc]
    if lastmod:
        lines.append("    <lastmod>%s</lastmod>" % lastmod)
    lines.append("    <changefreq>%s</changefreq>" % changefreq)
    lines.append("    <priority>%s</priority>" % priority)
    lines.append("  </url>")
    return "\n".join(lines)


def main():
    entries = []

    for filename, url_path, priority in PAGES:
        if not os.path.exists(os.path.join(ROOT, filename)):
            print("  ※ %s が見つかりません。とばします。" % filename)
            continue
        freq = "weekly" if url_path in ("/", "/blog", "/schedule") else "monthly"
        entries.append(url_entry(SITE + url_path, last_modified(filename), freq, priority))

    posts = blog_posts()
    for url_path, date in posts:
        entries.append(url_entry(SITE + url_path, date, "yearly", "0.5"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!-- このファイルは tools/make-sitemap.py が作っています。\n'
        '     手で書きかえても、次に作りなおしたときに消えてしまいます。 -->\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries) + "\n"
        '</urlset>\n'
    )

    out = os.path.join(ROOT, "sitemap.xml")
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(xml)

    print("sitemap.xml を作りました。")
    print("  ページ：%d件　ブログ記事：%d件　合計：%d件"
          % (len(entries) - len(posts), len(posts), len(entries)))
    print("  場所：%s" % out)


if __name__ == "__main__":
    sys.exit(main())
