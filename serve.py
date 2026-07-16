# Dev server with no-store cache headers (avoids stale ES module cache).
import http.server, functools, os

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(('127.0.0.1', 8741), H).serve_forever()
