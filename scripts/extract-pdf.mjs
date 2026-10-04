// Download a PDF from a URL (or read a local file) and extract its text.
// Usage: node scripts/extract-pdf.mjs <pdfUrlOrPath> [maxPages] [--referer <pageUrl>] [--save]
// Council portals (Idox) often require a session cookie from the documents
// page before serving files — pass the documents page URL as --referer.
import { readFileSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error("usage: node scripts/extract-pdf.mjs <pdfUrl> [maxPages] [--referer pageUrl] [--save]");
  process.exit(1);
}
const maxPages = parseInt(args[1] ?? "15", 10) || 15;
const refererIdx = args.indexOf("--referer");
const referer = refererIdx >= 0 ? args[refererIdx + 1] : null;
const save = args.includes("--save");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) research";

async function getCookies(pageUrl) {
  const res = await fetch(pageUrl, { headers: { "User-Agent": UA }, redirect: "follow" });
  await res.arrayBuffer(); // drain
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

let buf;
if (/^https?:\/\//i.test(url)) {
  const headers = { "User-Agent": UA };
  if (referer) {
    headers.Cookie = await getCookies(referer);
    headers.Referer = referer;
  }
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    console.error(`HTTP ${res.status} fetching ${url}`);
    process.exit(1);
  }
  buf = Buffer.from(await res.arrayBuffer());
  console.error(`Downloaded ${(buf.length / 1024).toFixed(0)} KB`);
} else {
  buf = readFileSync(url);
  console.error(`Read ${(buf.length / 1024).toFixed(0)} KB from disk`);
}

if (save) {
  const name = `${process.env.TEMP}\\${decodeURIComponent(url.split("/").pop())}`;
  writeFileSync(name, buf);
  console.error(`Saved to ${name}`);
}

const parser = new PDFParse({ data: buf, max: maxPages });
try {
  const result = await parser.getText();
  console.log(result.text);
} finally {
  await parser.destroy().catch(() => {});
}
