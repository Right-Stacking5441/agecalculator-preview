"""Bake each page's empty result card and settings line into the static HTML."""
from __future__ import annotations
import pathlib, sys
from playwright.sync_api import sync_playwright
sys.path.append("/usr/local/lib/python3.13/dist-packages")
sys.path.append("/usr/lib/python3/dist-packages")
sys.path.append("/tmp/fvenv/lib/python3.13/site-packages")
from bs4 import BeautifulSoup

def prerender(docs: pathlib.Path, base: str = "http://127.0.0.1:8777") -> int:
    docs = pathlib.Path(docs)
    pages = [p for p in sorted(docs.glob("*.html")) if "data-calc" in p.read_text()]
    n = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 390, "height": 844}, locale="en-GB", timezone_id="Europe/London")
        for p in pages:
            pg.goto(f"{base.rstrip('/')}/{p.name}", wait_until="networkidle")
            pg.wait_for_timeout(250)
            d = pg.evaluate(
                """() => { const l = document.getElementById('leaf');
                  return { cls: l.className, state: l.getAttribute('data-state'),
                           html: l.innerHTML.replace(/<noscript>[\\s\\S]*?<\\/noscript>/, '') }; }"""
            )
            s = BeautifulSoup(p.read_text(), "html.parser")
            leaf = s.select_one("#leaf")
            ns = leaf.find("noscript") if leaf else None
            leaf.clear()
            leaf.append(BeautifulSoup(d["html"], "html.parser"))
            if ns:
                leaf.append(ns)
            leaf["class"] = d["cls"].split()
            leaf["data-state"] = d["state"] or "empty"
            p.write_text(str(s))
            print("baked", p.name, d["cls"])
            n += 1
        b.close()
    return n

if __name__ == "__main__":
    prerender(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/workspace/agecalculator/docs"))
