#!/usr/bin/env python3
"""scripts/serve-spa.py — Copero (MGC-367 SPA fallback + MGC-374 font preload)

Servidor HTTP stdlib-only para servir el bundle web de Copero en CI/local
sin levantar Node/Expo. Dos responsabilidades:

  1. SPA fallback (MGC-367): rutas sin extensión que no existen en disco se
     sirven como `dist/index.html` para que Expo Router hidrate el route en
     cliente. Antes `python3 -m http.server` devolvía 404 antes del bootstrap
     de Expo Router, y 7 specs de Playwright fallaban al primer
     `waitForSelector('[data-testid="..."]')`.

  2. Font preload (MGC-374): al servir `dist/index.html`, garantizamos que
     existan `<link rel="preload" as="font" type="font/woff2" crossorigin>`
     para Inter-Regular.woff2 y Poppins-Bold.woff2 antes del primer byte
     del body. `scripts/inject-preload.mjs` ya los inyecta post-build, pero
     este fallback cubre builds donde ese paso falló o se omitió (CI en
     self-hosted runner sin Node 20+). El spec MGC-556
     (`e2e/copero-ar-visual-parity.spec.ts:142-143`) valida que Inter y
     Poppins aparezcan en network requests al cargar `/`.

Uso:
  python3 scripts/serve-spa.py [--port 8081] [--root ./dist]

Sin dependencias. Solo stdlib (`http.server`, `argparse`, `re`, `mimetypes`).
"""
from __future__ import annotations

import argparse
import io
import mimetypes
import os
import re
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


# Regex para detectar rutas "tipo archivo" (tienen extensión).
# Si NO matchea, asumimos SPA route y hacemos fallback a index.html.
HAS_EXTENSION = re.compile(r"[^/]+\.[a-zA-Z0-9]{1,6}$")

# Tags de preload que inyectamos si no están ya presentes.
# Mantener sincronizado con scripts/inject-preload.mjs (CRITICAL_FONTS).
INTER_PRELOAD = (
    '<link rel="preload" as="font" type="font/woff2" '
    'href="/assets/assets/fonts/woff2/Inter-Regular.'
    'd4eeb371e488df6267b012350b4dd1eb.woff2" crossorigin>'
)
POPPINS_PRELOAD = (
    '<link rel="preload" as="font" type="font/woff2" '
    'href="/assets/assets/fonts/woff2/Poppins-Bold.'
    'a5086b2749fddda9fb42a73be77a7819.woff2" crossorigin>'
)


class SpaHandler(SimpleHTTPRequestHandler):
    """HTTP handler con SPA fallback + inyección de font preload en index.html."""

    # Extender SimpleHTTPRequestHandler requiere que el directorio se pase en
    # el constructor; lo hacemos vía translate_path() que ya usa self.directory.
    def __init__(self, *args, directory: str | None = None, **kwargs) -> None:
        if directory is not None:
            super().__init__(*args, directory=directory, **kwargs)
        else:
            super().__init__(*args, **kwargs)

    # override send_head para implementar SPA fallback
    def send_head(self):  # type: ignore[override]
        path = self.translate_path(self.path)
        clean_path = self.path.split("?", 1)[0].split("#", 1)[0]

        # 1) Directorio: servir index.html del dir si existe, si no SPA root.
        if os.path.isdir(path):
            dir_index = os.path.join(path, "index.html")
            if os.path.isfile(dir_index):
                return self._send_html(dir_index)
            return self._send_spa_root()

        # 2) Archivo existe: servir normal.
        if os.path.isfile(path):
            mime, _ = mimetypes.guess_type(path)
            return self._send_file(path, mime or "application/octet-stream")

        # 3) No existe y NO tiene extensión → SPA fallback.
        if not HAS_EXTENSION.search(clean_path):
            return self._send_spa_root()

        # 4) No existe y SÍ tiene extensión → 404 legítimo.
        self.send_error(404, f"Asset no encontrado: {self.path}")
        return None

    def _send_html(self, path: str):
        """Sirve un archivo HTML con inyección idempotente de preload."""
        try:
            with open(path, "rb") as f:
                raw = f.read().decode("utf-8", errors="replace")
        except OSError:
            self.send_error(404, f"Archivo no encontrado: {path}")
            return None
        decorated = self._inject_preload(raw)
        encoded = decorated.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        return io.BytesIO(encoded)

    def _send_file(self, path: str, content_type: str):
        """Sirve un archivo binario/estático sin decoración."""
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, f"Archivo no encontrado: {path}")
            return None
        size = os.fstat(f.fileno()).st_size
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        return f

    def _send_spa_root(self):
        """Sirve `dist/index.html` raíz con inyección de preload."""
        root_dir = getattr(self, "directory", None) or os.getcwd()
        index_path = os.path.join(root_dir, "index.html")
        if not os.path.isfile(index_path):
            self.send_error(404, f"SPA root no encontrado: {index_path}")
            return None
        return self._send_html(index_path)

    @staticmethod
    def _inject_preload(html: str) -> str:
        """Inyecta preload de Inter/Poppins si no están ya presentes.

        Idempotente: si los tags ya existen, no duplica. Inserta antes del
        primer `<link rel="preload">` (agrupa preloads), o antes de `</head>`
        si no hay ninguno.
        """
        has_inter = "Inter-Regular" in html and 'rel="preload"' in html
        has_poppins = "Poppins-Bold" in html and 'rel="preload"' in html

        additions = []
        if not has_inter:
            additions.append(INTER_PRELOAD)
        if not has_poppins:
            additions.append(POPPINS_PRELOAD)

        if not additions:
            return html

        block = "\n  ".join(additions)

        first_preload = re.search(r'<link\s+rel="preload"', html)
        if first_preload:
            idx = first_preload.start()
            return html[:idx] + block + "\n  " + html[idx:]

        return html.replace("</head>", f"  {block}\n  </head>", 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Copero SPA static server (MGC-367 + MGC-374).")
    parser.add_argument("--port", type=int, default=8081, help="Puerto TCP (default: 8081)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    parser.add_argument(
        "--root",
        default="./dist",
        help="Directorio raíz a servir (default: ./dist)",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"[serve-spa] ERROR: root no existe o no es directorio: {root}", file=sys.stderr)
        return 1

    index_html = root / "index.html"
    if not index_html.is_file():
        print(f"[serve-spa] ERROR: index.html no encontrado en {root}", file=sys.stderr)
        return 1

    handler = lambda *a, **kw: SpaHandler(*a, directory=str(root), **kw)
    server = HTTPServer((args.host, args.port), handler)
    print(
        f"[serve-spa] listening on http://{args.host}:{args.port} "
        f"serving {root} (SPA fallback ON, font preload ON)",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[serve-spa] shutdown", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
