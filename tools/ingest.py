#!/usr/bin/env python3
"""
ingest.py — Estrae testo da fonti eterogenee per l'ingest nella wiki.

Non scrive pagine: quello lo fa l'LLM. Questo script fa solo la parte
meccanica (estrarre testo, archiviare l'originale in raw/) in modo che
l'agente non debba improvvisare parser.

Uso:
  python ingest.py --file paper.pdf            (auto-detect del tipo)
  python ingest.py --url https://esempio.it/x
  python ingest.py --file foto.png             (archivia e stampa il path da leggere)
  python ingest.py --archive-only report.docx
"""

import argparse
import html
import os
import re
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wikilib as W  # noqa: E402

TEXT_EXT = {'.md', '.txt', '.markdown', '.rst', '.csv', '.json', '.yaml', '.yml', '.log'}
IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'}


# ────────────────────────────────────────────────────────── estrattori ──

def extract_pdf(path):
    """pdftotext se disponibile, altrimenti pypdf/PyPDF2, altrimenti istruzioni."""
    if shutil.which('pdftotext'):
        import subprocess
        try:
            out = subprocess.run(['pdftotext', '-layout', path, '-'],
                                 capture_output=True, timeout=120)
            if out.returncode == 0 and out.stdout.strip():
                return out.stdout.decode('utf-8', errors='replace')
        except (OSError, subprocess.SubprocessError):
            pass

    for module in ('pypdf', 'PyPDF2'):
        try:
            mod = __import__(module)
        except ImportError:
            continue
        try:
            reader = mod.PdfReader(path)
            return "\n\n".join((page.extract_text() or '') for page in reader.pages)
        except Exception:  # noqa: BLE001 - PDF corrotto o cifrato
            continue

    raise RuntimeError(
        "Nessun estrattore PDF disponibile.\n"
        "  Installa uno di questi:\n"
        "    pip install pypdf          (multipiattaforma)\n"
        "    apt install poppler-utils  (Linux, fornisce pdftotext)\n"
        "    brew install poppler       (macOS)\n"
        "  In alternativa apri il PDF e incolla il testo all'agente."
    )


def extract_docx(path):
    """DOCX = zip di XML: estraibile senza dipendenze."""
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8', errors='replace')
    xml = re.sub(r'</w:p>', '\n', xml)
    xml = re.sub(r'<w:tab[^>]*/>', '\t', xml)
    xml = re.sub(r'<w:br[^>]*/>', '\n', xml)
    text = re.sub(r'<[^>]+>', '', xml)
    text = html.unescape(text)
    return re.sub(r'\n{3,}', '\n\n', text).strip()


def strip_html(raw):
    raw = re.sub(r'<(script|style|nav|footer|header|aside)[^>]*>.*?</\1>', ' ', raw,
                 flags=re.DOTALL | re.IGNORECASE)
    raw = re.sub(r'<br\s*/?>|</p>|</div>|</li>|</h[1-6]>', '\n', raw, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', raw)
    text = html.unescape(text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return re.sub(r'\n\s*\n\s*\n+', '\n\n', text).strip()


def fetch_url(url):
    import urllib.request
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; llm-wiki-portable/{})'.format(W.VERSION),
    })
    with urllib.request.urlopen(req, timeout=45) as resp:
        charset = resp.headers.get_content_charset() or 'utf-8'
        raw = resp.read().decode(charset, errors='replace')

    title = ''
    m = re.search(r'<title[^>]*>(.*?)</title>', raw, re.DOTALL | re.IGNORECASE)
    if m:
        title = html.unescape(re.sub(r'\s+', ' ', m.group(1))).strip()

    return title, strip_html(raw)


# ───────────────────────────────────────────────────────────── archivio ──

def archive(root, src_path):
    """Copia l'originale in raw/ (o raw/assets/ per le immagini). Mai modificato."""
    ext = os.path.splitext(src_path)[1].lower()
    subdir = 'assets' if ext in IMAGE_EXT else ''
    dest_dir = os.path.join(root, 'raw', subdir) if subdir else os.path.join(root, 'raw')
    os.makedirs(dest_dir, exist_ok=True)

    name = W.slugify(os.path.splitext(os.path.basename(src_path))[0]) + ext
    dest = os.path.join(dest_dir, name)

    counter = 2
    while os.path.exists(dest) and not os.path.samefile(src_path, dest):
        dest = os.path.join(dest_dir, '{}-{}{}'.format(
            W.slugify(os.path.splitext(os.path.basename(src_path))[0]), counter, ext))
        counter += 1

    if not os.path.exists(dest):
        shutil.copy2(src_path, dest)
    return dest


def emit(title, text, archived, max_chars):
    print("=== FONTE ===")
    if title:
        print("titolo: {}".format(title))
    if archived:
        print("archiviato: {}".format(archived))
    print("caratteri: {}".format(len(text)))
    print("slug suggerito: src-{}".format(W.slugify(title or os.path.basename(archived or 'fonte'))))
    print("=== TESTO ===")
    if max_chars and len(text) > max_chars:
        print(text[:max_chars])
        print("\n[...troncato a {} caratteri di {}. Rilancia con --max-chars 0 per il testo completo.]"
              .format(max_chars, len(text)))
    else:
        print(text)


def main():
    parser = argparse.ArgumentParser(description='Estrai testo da una fonte per l\'ingest')
    parser.add_argument('--root', help='Wiki root (auto-detect se omesso)')
    parser.add_argument('--file', help='File locale (pdf, docx, txt, md, immagine)')
    parser.add_argument('--url', help='URL da scaricare')
    parser.add_argument('--archive-only', metavar='FILE', help='Archivia in raw/ senza estrarre')
    parser.add_argument('--no-archive', action='store_true', help='Non copiare in raw/')
    parser.add_argument('--max-chars', type=int, default=20000, help='0 = nessun limite')
    args = parser.parse_args()

    root = W.require_wiki_root(args.root)

    if args.archive_only:
        dest = archive(root, args.archive_only)
        print("Archiviato: {}".format(dest))
        return

    if args.url:
        title, text = fetch_url(args.url)
        emit(title or args.url, text, None, args.max_chars)
        return

    if not args.file:
        parser.error('serve --file, --url o --archive-only')

    path = os.path.expanduser(args.file)
    if not os.path.isfile(path):
        sys.stderr.write("Errore: file non trovato: {}\n".format(path))
        sys.exit(1)

    archived = None if args.no_archive else archive(root, path)
    ext = os.path.splitext(path)[1].lower()
    title = os.path.splitext(os.path.basename(path))[0]

    if ext in IMAGE_EXT:
        print("=== IMMAGINE ===")
        print("archiviata: {}".format(archived or path))
        print("slug suggerito: src-{}".format(W.slugify(title)))
        print("\nAzione per l'agente: leggi il file con lo strumento di lettura immagini,")
        print("descrivi cosa contiene e distillalo in una pagina sources/.")
        return

    if ext == '.pdf':
        text = extract_pdf(path)
    elif ext == '.docx':
        text = extract_docx(path)
    elif ext in TEXT_EXT or not ext:
        text = W.read_text(path)
    else:
        sys.stderr.write(
            "Tipo non supportato: {}\nSupportati: pdf, docx, immagini, {}\n".format(
                ext, ', '.join(sorted(TEXT_EXT))))
        sys.exit(1)

    emit(title, text, archived, args.max_chars)


if __name__ == '__main__':
    main()
