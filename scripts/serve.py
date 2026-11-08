#!/usr/bin/env python3
"""Servidor de desarrollo de Halcon.

`sdk/index.html` no trae rutas literales: usa `{url}` y `{rand}`, que en
produccion reemplaza el backend. `python -m http.server` sirve el archivo tal
cual, deja `src="{url}sdk/sys/core/loader.js"` y el loader nunca arranca.

Este servidor hace ese reemplazo al vuelo y despues sirve los estaticos desde
la raiz del repositorio, sin dependencias.

Uso: python3 scripts/serve.py [puerto] [--bind 0.0.0.0]
"""

import argparse
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(RAIZ, "sdk", "index.html")

def leer_index():
    """Devuelve el index con `{url}` resuelto y `{rand}` pendiente."""
    with open(INDEX, encoding="utf-8") as archivo:
        html = archivo.read()
    return html.replace("{url}", "/")


def hacer_handler():
    """Arma el handler HTTP que sirve el index y los estaticos del repo."""
    html = leer_index()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=RAIZ, **kwargs)

        def do_GET(self):
            ruta = self.path.split("?")[0]
            if ruta == "/":
                self.responder_html(html.replace("{rand}", str(int(time.time()))))
                return
            if ruta in ("/index.html", "/sdk/index.html"):
                self.responder_redirect("/")
                return
            super().do_GET()

        def responder_html(self, cuerpo):
            datos = cuerpo.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(datos)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(datos)

        def responder_redirect(self, destino):
            self.send_response(302)
            self.send_header("Location", destino)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def log_message(self, formato, *args):
            pass

    return Handler


def main():
    """Lee los argumentos y deja el servidor escuchando."""
    parser = argparse.ArgumentParser(description="Servidor de desarrollo de Halcon")
    parser.add_argument(
        "puerto",
        nargs="?",
        type=int,
        default=int(os.environ.get("PORT", "8090")),
    )
    parser.add_argument("--bind", default=os.environ.get("BIND", "0.0.0.0"))
    args = parser.parse_args()

    servidor = ThreadingHTTPServer((args.bind, args.puerto), hacer_handler())
    print(f"Halcon en http://{args.bind}:{args.puerto}/")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()


if __name__ == "__main__":
    main()
