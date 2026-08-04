import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

/*
 * Embed a PNG image into an .xlsx that was produced by SheetJS (which — in its
 * free build — can't add drawings/images itself). We unzip the workbook, add
 * the image as a worksheet drawing (one-cell anchor), wire up the required
 * relationships + content types, and rezip. Pure JS (fflate), so it runs the
 * same in the browser and in React Native.
 */

const EMU_PER_PX = 9525; // 1px = 9525 EMU at 96 DPI

export type ImageAnchor = {
  /** 0-based column the image's top-left sits in. */
  col: number;
  /** 0-based row the image's top-left sits in. */
  row: number;
  widthPx: number;
  heightPx: number;
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Resolve the worksheet part path (xl/worksheets/sheetN.xml) for a sheet name.
function resolveSheetPath(
  files: Record<string, Uint8Array>,
  sheetName: string
): string | null {
  const wb = files["xl/workbook.xml"];
  const rels = files["xl/_rels/workbook.xml.rels"];
  if (!wb || !rels) return null;
  const wbXml = strFromU8(wb);
  const relsXml = strFromU8(rels);

  const name = escapeRe(sheetName);
  const m =
    wbXml.match(new RegExp(`<sheet[^>]*name="${name}"[^>]*r:id="(rId\\d+)"`)) ||
    wbXml.match(new RegExp(`<sheet[^>]*r:id="(rId\\d+)"[^>]*name="${name}"`));
  if (!m) return null;
  const rid = m[1];
  const rm = relsXml.match(
    new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`)
  );
  if (!rm) return null;
  const target = rm[1].replace(/^\/?(xl\/)?/, ""); // -> worksheets/sheet1.xml
  return `xl/${target}`;
}

function nextRid(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((x) => Number(x[1]));
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
}

/**
 * Add `png` to the Summary-style sheet named `sheetName`. Returns the new xlsx
 * bytes. On any structural surprise it returns the original bytes unchanged so
 * the export never fails just because the picture couldn't be placed.
 */
export function embedImageInSheet(
  xlsx: Uint8Array,
  sheetName: string,
  png: Uint8Array,
  anchor: ImageAnchor
): Uint8Array {
  try {
    const files = unzipSync(xlsx);
    const sheetPath = resolveSheetPath(files, sheetName);
    if (!sheetPath || !files[sheetPath]) return xlsx;

    // Unique-ish indices. SheetJS free never emits drawings, so "1" is safe.
    const drawingPath = "xl/drawings/drawing1.xml";
    const drawingRelsPath = "xl/drawings/_rels/drawing1.xml.rels";
    const mediaPath = "xl/media/image1.png";

    const cx = Math.round(anchor.widthPx * EMU_PER_PX);
    const cy = Math.round(anchor.heightPx * EMU_PER_PX);

    // 1) media (copy into a fresh ArrayBuffer-backed view for fflate's types)
    files[mediaPath] = new Uint8Array(png);

    // 2) drawing xml (one-cell anchor with an absolute extent)
    files[drawingPath] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<xdr:oneCellAnchor>` +
        `<xdr:from><xdr:col>${anchor.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${cx}" cy="${cy}"/>` +
        `<xdr:pic>` +
        `<xdr:nvPicPr><xdr:cNvPr id="1" name="Chart"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        `</xdr:pic>` +
        `<xdr:clientData/>` +
        `</xdr:oneCellAnchor>` +
        `</xdr:wsDr>`
    );

    // 3) drawing rels -> media
    files[drawingRelsPath] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>` +
        `</Relationships>`
    );

    // 4) worksheet rels: add a drawing relationship
    const wsRelsPath = sheetPath.replace(
      /worksheets\/([^/]+)$/,
      "worksheets/_rels/$1.rels"
    );
    let wsRelsXml = files[wsRelsPath]
      ? strFromU8(files[wsRelsPath])
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const drawingRid = nextRid(wsRelsXml);
    wsRelsXml = wsRelsXml.replace(
      "</Relationships>",
      `<Relationship Id="${drawingRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
    );
    files[wsRelsPath] = strToU8(wsRelsXml);

    // 5) worksheet xml: ensure the `r` namespace, then append <drawing/>
    let wsXml = strFromU8(files[sheetPath]);
    if (!/<worksheet[^>]*xmlns:r=/.test(wsXml)) {
      wsXml = wsXml.replace(
        /<worksheet(\s|>)/,
        `<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"$1`
      );
    }
    wsXml = wsXml.replace(
      "</worksheet>",
      `<drawing r:id="${drawingRid}"/></worksheet>`
    );
    files[sheetPath] = strToU8(wsXml);

    // 6) content types: png default + drawing override
    const ctPath = "[Content_Types].xml";
    let ct = strFromU8(files[ctPath]);
    if (!/Extension="png"/.test(ct)) {
      ct = ct.replace(
        "<Default",
        `<Default Extension="png" ContentType="image/png"/><Default`
      );
    }
    if (!ct.includes("/xl/drawings/drawing1.xml")) {
      ct = ct.replace(
        "</Types>",
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
      );
    }
    files[ctPath] = strToU8(ct);

    return zipSync(files);
  } catch {
    return xlsx; // never let a picture break the export
  }
}
