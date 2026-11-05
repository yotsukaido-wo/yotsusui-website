"""
手元で見た目を確かめるための、かんたんなWebサーバーです。

python -m http.server との違いは1つだけで、
「このページを保存しておかないでください」という指示をブラウザに毎回返します。
こうしないと、ファイルを直したのにブラウザが古い内容を表示しつづけることがあります。

使いかた（このファイルがあるフォルダの1つ上＝リポジトリ直下で実行します）:

    python tools/devserver.py

ポートを変えたいときは、うしろに数字をつけます:

    python tools/devserver.py 8000

本番（Netlify）には関係のないファイルです。サイトの表示には影響しません。
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_PORT = 8765


class NoCacheHandler(SimpleHTTPRequestHandler):
    """ブラウザにキャッシュさせないHTTPハンドラ。"""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 既定のログは時刻の書式が読みにくいので、簡潔にします
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            sys.exit("ポート番号は数字で指定してください（例: python tools/devserver.py 8000）")

    handler = partial(NoCacheHandler, directory=".")
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"ローカル表示を開始しました → http://localhost:{port}")
        print("止めるときは Ctrl+C を押してください。")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n停止しました。")


if __name__ == "__main__":
    main()
