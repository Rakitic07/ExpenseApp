import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

/*
 * Embed a PNG into a SheetJS-produced .xlsx (its free build can't add images).
 * Works on base64 in/out because that's what RNFS reads/writes. Pure JS — no
 * ExcelJS (which doesn't run reliably in React Native). Mirrors the web
 * implementation in src/lib/report/xlsxImage.ts.
 */

const EMU_PER_PX = 9525;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type ImageAnchor = {
  col: number;
  row: number;
  widthPx: number;
  heightPx: number;
};

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    const chunk = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    if (o < len) out[o++] = (chunk >> 16) & 0xff;
    if (c !== -1 && o < len) out[o++] = (chunk >> 8) & 0xff;
    if (d !== -1 && o < len) out[o++] = chunk & 0xff;
  }
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveSheetPath(files: Record<string, Uint8Array>, sheetName: string): string | null {
  const wb = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  if (!wb || !rels) return null;
  const wbXml = strFromU8(wb);
  const relsXml = strFromU8(rels);
  const name = escapeRe(sheetName);
  const m =
    wbXml.match(new RegExp(`<sheet[^>]*name="${name}"[^>]*r:id="(rId\\d+)"`)) ||
    wbXml.match(new RegExp(`<sheet[^>]*r:id="(rId\\d+)"[^>]*name="${name}"`));
  if (!m) return null;
  const rid = m[1];
  const rm = relsXml.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`));
  if (!rm) return null;
  const target = rm[1].replace(/^\/?(xl\/)?/, '');
  return `xl/${target}`;
}

function nextRid(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map(x => Number(x[1]));
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
}

/** Embed base64 PNG into the given sheet of a base64 xlsx; returns base64. */
export function embedImageBase64(
  xlsxB64: string,
  sheetName: string,
  pngB64: string,
  anchor: ImageAnchor,
): string {
  try {
    const files = unzipSync(b64ToBytes(xlsxB64));
    const sheetPath = resolveSheetPath(files, sheetName);
    if (!sheetPath || !files[sheetPath]) return xlsxB64;

    const cx = Math.round(anchor.widthPx * EMU_PER_PX);
    const cy = Math.round(anchor.heightPx * EMU_PER_PX);

    files['xl/media/image1.png'] = new Uint8Array(b64ToBytes(pngB64));

    files['xl/drawings/drawing1.xml'] = strToU8(
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
        `</xdr:wsDr>`,
    );

    files['xl/drawings/_rels/drawing1.xml.rels'] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>` +
        `</Relationships>`,
    );

    const wsRelsPath = sheetPath.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels');
    let wsRelsXml = files[wsRelsPath]
      ? strFromU8(files[wsRelsPath])
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const drawingRid = nextRid(wsRelsXml);
    wsRelsXml = wsRelsXml.replace(
      '</Relationships>',
      `<Relationship Id="${drawingRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    );
    files[wsRelsPath] = strToU8(wsRelsXml);

    let wsXml = strFromU8(files[sheetPath]);
    if (!/<worksheet[^>]*xmlns:r=/.test(wsXml)) {
      wsXml = wsXml.replace(
        /<worksheet(\s|>)/,
        `<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"$1`,
      );
    }
    wsXml = wsXml.replace('</worksheet>', `<drawing r:id="${drawingRid}"/></worksheet>`);
    files[sheetPath] = strToU8(wsXml);

    const ctPath = '[Content_Types].xml';
    let ct = strFromU8(files[ctPath]);
    if (!/Extension="png"/.test(ct)) {
      ct = ct.replace('<Default', `<Default Extension="png" ContentType="image/png"/><Default`);
    }
    if (!ct.includes('/xl/drawings/drawing1.xml')) {
      ct = ct.replace(
        '</Types>',
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
      );
    }
    files[ctPath] = strToU8(ct);

    return bytesToB64(zipSync(files));
  } catch {
    return xlsxB64;
  }
}
