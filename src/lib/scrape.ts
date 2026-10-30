import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

export class ScrapeError extends Error {}

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/** Blocks loopback, private, link-local and similar ranges so the scraper can't reach internal services. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScrapeError("Kun http- og https-adresser understøttes.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new ScrapeError("Kunne ikke finde siden. Tjek adressen.");
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ScrapeError("Adressen peger på et internt netværk og kan ikke hentes.");
  }
}

async function fetchHtml(start: URL) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Generalproeven/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "da,en;q=0.8",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new ScrapeError(`Siden svarede med fejl ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new ScrapeError("Adressen er ikke en webside (HTML).");
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new ScrapeError("Siden er for stor.");
    const html = await res.text();
    if (html.length > MAX_BYTES) throw new ScrapeError("Siden er for stor.");
    return { html, finalUrl: url };
  }
  throw new ScrapeError("For mange omdirigeringer.");
}

/** Fetches a public web page and returns its main readable text. */
export async function scrape(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim().match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new ScrapeError("Ugyldig adresse.");
  }

  let page;
  try {
    page = await fetchHtml(url);
  } catch (err) {
    if (err instanceof ScrapeError) throw err;
    if (err instanceof Error && err.name === "TimeoutError") throw new ScrapeError("Siden svarede ikke i tide.");
    throw new ScrapeError("Kunne ikke hente siden.");
  }

  // Scripts never run: JSDOM only parses. The silent console hides CSS parse noise.
  const dom = new JSDOM(page.html, { url: page.finalUrl.href, virtualConsole: new VirtualConsole() });
  const article = new Readability(dom.window.document).parse();
  dom.window.close();

  const text = (article?.textContent ?? "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (text.length < 50) throw new ScrapeError("Fandt ingen brødtekst på siden. Kopiér teksten ind i stedet.");

  const title = article?.title?.trim();
  return { title: title ?? null, text: title && !text.startsWith(title) ? `${title}\n\n${text}` : text, url: page.finalUrl.href };
}
