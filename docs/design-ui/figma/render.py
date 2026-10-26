"""Chụp ảnh toàn trang mọi màn hình *.html trong thư mục này vào screens/ (1440px).

Chạy: python docs/design-ui/figma/render.py [tên-file.html ...]
Cần: pip install playwright && playwright install chromium
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'screens'


def main(names):
    pages = [HERE / n for n in names] if names else sorted(p for p in HERE.glob('[0-9]*.html'))
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        for p in pages:
            page.goto(p.as_uri(), wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            target = OUT / (p.stem + '.png')
            page.screenshot(path=str(target), full_page=True)
            print('ok', target.relative_to(HERE))
        browser.close()


if __name__ == '__main__':
    main(sys.argv[1:])
