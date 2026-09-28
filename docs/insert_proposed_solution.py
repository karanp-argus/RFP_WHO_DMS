"""Insert docs/PROPOSED_SOLUTION.md into the WHO technical proposal .docx.

    python docs/insert_proposed_solution.py            # write
    python docs/insert_proposed_solution.py --dry-run  # report only

Why hand-rolled OOXML rather than python-docx: neither python-docx nor pandoc is
installed on this machine, and the target file is a Google Docs export whose body
paragraphs carry no pStyle at all. Every scrap of formatting is direct on the paragraph,
so new content has to imitate the surrounding runs rather than lean on a named style.
The templates below were lifted from the document itself.

The script always builds FROM the backup, so it is safe to re-run: fix the Markdown, run
again, and the result is regenerated from pristine input rather than layered on top of a
previous insertion.

What it does NOT do: fix the table of contents. That TOC is static exported text, not a
Word field, so the page numbers after the insertion point will be wrong until it is
rebuilt as a real TOC in Word. Reported at the end of the run.
"""

import re
import shutil
import struct
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "Reference" / "Technical Proposal_Argusoft India Ltd_WHO_Data_Management_System.docx"
BACKUP = DOCX.with_suffix(".docx.original")
MD = ROOT / "docs" / "PROPOSED_SOLUTION.md"
DRY = "--dry-run" in sys.argv

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
EMU_PER_IN = 914400
CONTENT_WIDTH_IN = 6.5          # US Letter, 1in left/right margins
BULLET_NUM_ID = "58"            # an existing bullet list in this document
BRAND = "7d2b74"                # the purple used by Heading1/2/3

# ---------------------------------------------------------------- markdown ----

def load_blocks():
    """Return a list of (kind, payload) blocks from the Markdown body.

    Only the subset the document actually uses is supported: h3, h4, paragraph,
    bullet, and image callouts. Verified against the source with a construct
    inventory before this was written.
    """
    text = MD.read_text(encoding="utf-8")
    start = text.index("## Proposed Solution")
    end = text.index("## Notes for review")
    lines = text[start:end].splitlines()

    blocks, para, quote = [], [], []

    def flush_para():
        if para:
            blocks.append(("p", " ".join(para).strip()))
            para.clear()

    def flush_quote():
        if not quote:
            return
        joined = " ".join(quote)
        m = re.search(r"\[(?:FIGURE|SCREENSHOT) \d+ · `([^`]+)`\]\*\*\s*(.*)", joined)
        if m:
            path, rest = m.group(1), m.group(2)
            cap = re.search(r"\*(Indicative prototype view.*?)\*", rest)
            desc = re.split(r"\*Indicative", rest)[0].strip()
            blocks.append(("img", (path, desc, cap.group(1) if cap else "")))
        quote.clear()

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("> "):
            flush_para()
            quote.append(line[2:].strip())
            continue
        flush_quote()
        if not line.strip() or line.strip() == "---":
            flush_para()
        elif line.startswith("## "):
            flush_para()          # the section heading itself already exists in the docx
        elif line.startswith("#### "):
            flush_para()
            blocks.append(("h4", line[5:].strip()))
        elif line.startswith("### "):
            flush_para()
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("- "):
            flush_para()
            blocks.append(("li", line[2:].strip()))
        else:
            para.append(line.strip())
    flush_para()
    flush_quote()
    return blocks


def runs_xml(text):
    """Inline Markdown to a sequence of <w:r>. Handles **bold**, *italic*, `code`."""
    out = []
    pattern = re.compile(r"\*\*(.+?)\*\*|(?<!\*)\*([^*]+?)\*(?!\*)|`([^`]+?)`")
    pos = 0
    for m in pattern.finditer(text):
        if m.start() > pos:
            out.append(run(text[pos:m.start()]))
        if m.group(1) is not None:
            out.append(run(m.group(1), bold=True))
        elif m.group(2) is not None:
            out.append(run(m.group(2), italic=True))
        else:
            out.append(run(m.group(3), mono=True))
        pos = m.end()
    if pos < len(text):
        out.append(run(text[pos:]))
    return "".join(out) or run("")


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def run(text, bold=False, italic=False, mono=False, size=None, color=None):
    rpr = ""
    if mono:
        rpr += '<w:rFonts w:ascii="Consolas" w:cs="Consolas" w:eastAsia="Consolas" w:hAnsi="Consolas"/>'
    if bold:
        rpr += '<w:b w:val="1"/><w:bCs w:val="1"/>'
    if italic:
        rpr += '<w:i w:val="1"/><w:iCs w:val="1"/>'
    if color:
        rpr += f'<w:color w:val="{color}"/>'
    if size:
        rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    rpr += '<w:rtl w:val="0"/>'
    return (f'<w:r><w:rPr>{rpr}</w:rPr>'
            f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')


# ------------------------------------------------------------- paragraphs ----

def p_body(text):
    return f'<w:p><w:pPr><w:rPr/></w:pPr>{runs_xml(text)}</w:p>'


def p_heading(text, level):
    # Heading3 instances in this document override the style's League Spartan 15pt with
    # Roboto Medium 14pt. Heading4 is defined but never used and its stock look (Arial
    # bold maroon) does not belong to this family, so it is overridden to sit one step
    # below Heading3: Roboto Medium 12pt in the same brand purple.
    if level == 3:
        rpr = ('<w:rFonts w:ascii="Roboto Medium" w:cs="Roboto Medium" '
               'w:eastAsia="Roboto Medium" w:hAnsi="Roboto Medium"/>'
               '<w:sz w:val="28"/><w:szCs w:val="28"/>')
        run_rpr = rpr
    else:
        rpr = ('<w:rFonts w:ascii="Roboto Medium" w:cs="Roboto Medium" '
               'w:eastAsia="Roboto Medium" w:hAnsi="Roboto Medium"/>'
               f'<w:b w:val="0"/><w:bCs w:val="0"/><w:color w:val="{BRAND}"/>'
               '<w:sz w:val="24"/><w:szCs w:val="24"/>')
        run_rpr = rpr
    body = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    return (f'<w:p><w:pPr><w:pStyle w:val="Heading{level}"/>'
            f'<w:rPr>{rpr}</w:rPr></w:pPr>'
            f'<w:r><w:rPr>{run_rpr}<w:rtl w:val="0"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(body)}</w:t></w:r></w:p>')


def p_bullet(text):
    return (f'<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/>'
            f'<w:numId w:val="{BULLET_NUM_ID}"/></w:numPr>'
            f'<w:spacing w:after="0" w:afterAutospacing="0"/>'
            f'<w:ind w:left="720" w:hanging="360"/>'
            f'<w:jc w:val="left"/><w:rPr/></w:pPr>{runs_xml(text)}</w:p>')


def png_size(path):
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def p_image(rid, docpr_id, px_w, px_h, name):
    cx = int(CONTENT_WIDTH_IN * EMU_PER_IN)
    cy = int(cx * px_h / px_w)
    return (
        '<w:p><w:pPr><w:spacing w:before="120" w:after="60"/>'
        '<w:jc w:val="center"/><w:rPr/></w:pPr>'
        '<w:r><w:rPr><w:rtl w:val="0"/></w:rPr><w:drawing>'
        f'<wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{docpr_id}" name="{esc(name)}" descr="{esc(name)}"/>'
        '<wp:cNvGraphicFramePr>'
        '<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>'
        '</wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="{docpr_id}" name="{esc(name)}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic></a:graphicData></a:graphic></wp:inline>'
        '</w:drawing></w:r></w:p>'
    )


def p_caption(text):
    return ('<w:p><w:pPr><w:spacing w:before="0" w:after="240"/>'
            '<w:jc w:val="center"/><w:rPr/></w:pPr>'
            + run(text, italic=True, size="18", color="595959") + '</w:p>')


# ------------------------------------------------------------------- build ----

def main():
    if not DOCX.exists():
        sys.exit(f"missing: {DOCX}")
    if not BACKUP.exists():
        shutil.copy2(DOCX, BACKUP)
        print(f"backup written: {BACKUP.name}")
    else:
        print(f"backup already present, building from it: {BACKUP.name}")

    src = zipfile.ZipFile(BACKUP)
    doc = src.read("word/document.xml").decode("utf-8")
    rels = src.read("word/_rels/document.xml.rels").decode("utf-8")

    blocks = load_blocks()

    # --- images: collect, allocate relationship ids and media names -----------
    next_rid = max(int(n) for n in re.findall(r'Id="rId(\d+)"', rels)) + 1
    existing_media = {n for n in src.namelist() if n.startswith("word/media/")}
    media_no = 1
    new_media, new_rels = {}, []
    docpr = 4000

    xml_parts = []
    for kind, payload in blocks:
        if kind == "h3":
            xml_parts.append(p_heading(payload, 3))
        elif kind == "h4":
            xml_parts.append(p_heading(payload, 4))
        elif kind == "li":
            xml_parts.append(p_bullet(payload))
        elif kind == "p":
            xml_parts.append(p_body(payload))
        elif kind == "img":
            rel_path, desc, caption = payload
            img = ROOT / rel_path
            if not img.exists():
                sys.exit(f"image not found: {img}")
            while f"word/media/dms_image{media_no}.png" in existing_media:
                media_no += 1
            target = f"media/dms_image{media_no}.png"
            new_media[f"word/{target}"] = img.read_bytes()
            rid = f"rId{next_rid}"
            new_rels.append(
                f'<Relationship Id="{rid}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
                f'Target="{target}"/>'
            )
            next_rid += 1
            media_no += 1
            docpr += 1
            w, h = png_size(img)
            xml_parts.append(p_image(rid, docpr, w, h, Path(rel_path).name))
            if desc:
                xml_parts.append(p_caption(desc))
            if caption:
                xml_parts.append(p_caption(caption))

    new_xml = "".join(xml_parts)

    # --- splice: replace the run of empty paragraphs that currently sits between
    # the "Proposed Solution" heading and the "Proposed Work Plan" heading -----
    heading_re = re.compile(
        r'(<w:p\b[^>]*>(?:(?!</w:p>).)*?<w:pStyle w:val="Heading2"/>'
        r'(?:(?!</w:p>).)*?<w:t[^>]*>Proposed Solution</w:t>(?:(?!</w:p>).)*?</w:p>)',
        re.S,
    )
    matches = list(heading_re.finditer(doc))
    if len(matches) != 1:
        sys.exit(f"expected exactly 1 'Proposed Solution' Heading2, found {len(matches)}")
    at = matches[0].end()

    nxt = doc.index("Proposed Work Plan", at)
    nxt_p = doc.rindex("<w:p ", at, nxt)
    between = doc[at:nxt_p]
    empties = len(re.findall(r"<w:p\b", between))
    if re.search(r"<w:t[^>]*>[^<]", between) or "<w:tbl" in between or "<w:drawing" in between:
        sys.exit("content already present between the two headings — refusing to overwrite")

    result = doc[:at] + new_xml + doc[nxt_p:]

    counts = {}
    for kind, _ in blocks:
        counts[kind] = counts.get(kind, 0) + 1
    print(f"\nparsed: {counts}")
    print(f"replaced {empties} empty paragraph(s) between the headings")
    print(f"generated {len(new_xml):,} characters of body XML")
    print(f"embedded {len(new_media)} image(s)")

    if DRY:
        print("\n--dry-run: nothing written")
        return

    rels_out = rels.replace("</Relationships>", "".join(new_rels) + "</Relationships>")

    tmp = DOCX.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for item in src.infolist():
            if item.filename == "word/document.xml":
                out.writestr(item, result.encode("utf-8"))
            elif item.filename == "word/_rels/document.xml.rels":
                out.writestr(item, rels_out.encode("utf-8"))
            else:
                # Everything else is copied byte for byte. comments.xml, numbering.xml
                # and the embedded fonts all have to survive untouched.
                out.writestr(item, src.read(item.filename))
        for name, data in new_media.items():
            out.writestr(name, data)
    src.close()
    tmp.replace(DOCX)
    print(f"\nwritten: {DOCX.name}")
    print("NOTE: the table of contents is static text, not a Word field. Page numbers "
          "after this section are now wrong and the TOC needs rebuilding in Word.")


if __name__ == "__main__":
    main()
