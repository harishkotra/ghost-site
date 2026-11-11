/**
 * Visual QA with request interception. The shipped app never sees these fixtures:
 * the browser is fed a fabricated /api/state purely so the populated layout can be
 * reviewed and measured. Delete before shipping if you like.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import { writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:8787";
const BLOCK_SECONDS = 2;

const real = await (await fetch(`${BASE}/api/state`)).json();

function page(o) {
  const remainingBlocks = o.remainingBlocks;
  return {
    slug: o.slug,
    section: o.section,
    title: o.title,
    dek: o.dek,
    author: o.author ?? "THE EDITORS",
    entityKey: "0x" + o.slug.replace(/[^a-z]/g, "").padEnd(64, "7").slice(0, 64),
    owner: "0x94BD35f30403a95d2F19Ae4a7c49d7F583a17B05",
    ownerShort: "0x94BD…7B05",
    createdAtBlock: real.block - 40_000,
    expiresAtBlock: real.block + remainingBlocks,
    remainingBlocks,
    remainingSeconds: remainingBlocks * BLOCK_SECONDS,
    lifetimeBlocks: o.lifetimeBlocks,
    decay: Math.max(0, Math.min(1, remainingBlocks / o.lifetimeBlocks)),
    saves: o.saves,
    lastSaver: o.saves ? "0x94BD…7B05" : null,
    saves24h: o.saves24h ?? 0,
    history: Array.from({ length: o.saves }, (_, i) => ({
      at: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
      blocks: 86_400,
      tx: "0x" + String(i + 1).repeat(64).slice(0, 64),
    })),
    body: fs.existsSync("scripts/content.ts") ? undefined : undefined,
  };
}

const alive = [
  page({
    slug: "notice-of-death",
    section: "NOTICE",
    title: "The first page dies at 3am",
    dek: "A record can expire while everyone is asleep. That is the whole point.",
    remainingBlocks: 380,
    lifetimeBlocks: 900,
    saves: 1,
    saves24h: 1,
  }),
  page({
    slug: "the-premise",
    section: "PREMISE",
    title: "A website is a promise to keep paying",
    dek: "Every URL you have ever bookmarked is a bill somebody stopped paying.",
    remainingBlocks: 210_400,
    lifetimeBlocks: 302_400,
    saves: 14,
    saves24h: 6,
  }),
  page({
    slug: "dead-links",
    section: "FIELD NOTES",
    title: "The dead link is the most honest page on the internet",
    dek: "A 404 is a receipt for a decision someone made about a bill.",
    remainingBlocks: 96_000,
    lifetimeBlocks: 302_400,
    saves: 7,
    saves24h: 2,
  }),
  page({
    slug: "keep-alive",
    section: "MECHANIC",
    title: "You cannot edit this. You can only pay for it to exist",
    dek: "Permissionless extension: a stranger adds time to a record they do not own.",
    remainingBlocks: 250_000,
    lifetimeBlocks: 302_400,
    saves: 23,
    saves24h: 9,
  }),
  page({
    slug: "first-entity",
    section: "LOREM",
    title: "The oldest thing on the chain is a test",
    dek: "Someone's first entity is still out there, still earning its keep.",
    remainingBlocks: 18_000,
    lifetimeBlocks: 302_400,
    saves: 3,
    saves24h: 0,
  }),
];

const tombs = [
  {
    slug: "the-shortest-page",
    section: "EXPERIMENT",
    title: "This page was given one hour",
    body: "It existed for exactly one hour and nobody came.\n\nWe made it to see what a site looks like when it runs out of time.",
    bornAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    diedAt: new Date(Date.now() - 8 * 86_400_000 - 23 * 3_600_000).toISOString(),
    livedSeconds: 3_600,
    saves: 0,
    lastSaver: null,
    entityKey: "0x" + "a".repeat(64),
    section_: undefined,
  },
  {
    slug: "nobody-came",
    section: "FIELD NOTES",
    title: "Nobody came",
    body: "We published this at noon and watched the counter for two days.",
    bornAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    diedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    livedSeconds: 604_800,
    saves: 0,
    lastSaver: null,
    entityKey: "0x" + "b".repeat(64),
  },
  {
    slug: "one-saver",
    section: "PREMISE",
    title: "One person paid for this to exist",
    body: "Then they stopped. That is not a failure; that is the record of a decision.",
    bornAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    diedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    livedSeconds: 2_419_200,
    saves: 1,
    lastSaver: "0x94BD…7B05",
    entityKey: "0x" + "c".repeat(64),
  },
];

const state = {
  ...real,
  hasKey: true,
  relayer: "0x94BD35f30403a95d2F19Ae4a7c49d7F583a17B05",
  setupIssue: null,
  stats: {
    alive: alive.length,
    dead: tombs.length,
    saves: alive.reduce((n, p) => n + p.saves, 0),
    secondsGiven: 48 * 172_800,
    soonest: { slug: alive[0].slug, title: alive[0].title, seconds: alive[0].remainingSeconds },
  },
  pages: alive.slice().sort((a, b) => a.remainingBlocks - b.remainingBlocks),
  graveyard: tombs,
  loved: alive
    .filter((p) => p.saves > 0)
    .sort((a, b) => b.saves - a.saves)
    .map((p) => ({ slug: p.slug, title: p.title, saves: p.saves, alive: true })),
  forgotten: tombs
    .sort((a, b) => a.livedSeconds - b.livedSeconds || a.saves - b.saves)
    .map((t) => ({ slug: t.slug, title: t.title, saves: t.saves, livedSeconds: t.livedSeconds, alive: false })),
};

writeFileSync("/tmp/fixtures.json", JSON.stringify({ state, alive, tombs, block: real.block }));

const record = (slug) => {
  const p = alive.find((x) => x.slug === slug);
  const body = `Every page on this site was written by hand, published once, and given an expiry block.

When that block arrives, Arkiv deletes the entity. Not archived. Not hidden from search. Deleted, the way a file is deleted.

## What survives

Nothing on the page. The text was written with the readonly flag, so the database will reject any attempt to change a character of it, forever.

> The only mutable property is whether it keeps existing.

What can change is the expiry block. Anybody can pay to push it further out, one extension at a time. You do not need to own the page. You do not need a wallet on this site: the relayer signs, and the relayer can only add time.

- An extension is a transaction, receipt included
- The author cannot edit their own page either
- When nobody pays, the page dies at the block it was always going to die at

That is the whole mechanic. It is not a subscription, and it is not a paywall. It is a wake.`;
  return { ok: true, block: real.block, blockSeconds: BLOCK_SECONDS, alive: true, relayer: state.relayer, page: { ...p, body } };
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page_ = await browser.newPage();
const errors = [];
page_.on("pageerror", (e) => errors.push(e.message));
page_.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page_.setRequestInterception(true);
page_.on("request", (req) => {
  const url = req.url();
  if (url.includes("/api/state")) return req.respond({ contentType: "application/json", body: JSON.stringify(state) });
  if (url.match(/\/api\/page\/(.+)$/)) {
    const slug = url.split("/api/page/")[1].split("?")[0];
    if (alive.some((p) => p.slug === slug)) {
      return req.respond({ contentType: "application/json", body: JSON.stringify(record(slug)) });
    }
    const t = tombs.find((x) => x.slug === slug);
    if (t) return req.respond({ contentType: "application/json", body: JSON.stringify({ ok: true, block: real.block, blockSeconds: 2, alive: false, tomb: t }) });
    const r = record("the-premise");
    return req.respond({ contentType: "application/json", body: JSON.stringify({ ...r, page: { ...r.page, slug, title: t?.title ?? slug, section: "MISSING", dek: "No such record." } }) });
  }
  req.continue();
});

async function shot(path, file, w = 1440, h = 1000, full = true) {
  await page_.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page_.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 900));
  await page_.screenshot({ path: file, fullPage: full });
  const info = await page_.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const bad = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && !el.closest(".marquee") && (r.right > docW + 1.5 || r.left < -1.5);
      })
      .slice(0, 8)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${(el.textContent || "").trim().slice(0, 30)}"`);

    const parse = (c) => {
      const m = c.match(/[\d.]+/g);
      if (!m) return null;
      return m.length > 3 ? [+m[0], +m[1], +m[2], +m[3]] : [+m[0], +m[1], +m[2], 1];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg && bg[3] > 0.6) return bg;
        n = n.parentElement;
      }
      return [242, 242, 247, 1];
    };
    const low = [];
    for (const el of document.querySelectorAll("p, span, a, li, small, div, h1, h2, h3, h4, td, dt, dd, label, strong, em, code")) {
      if (!el.textContent || !el.textContent.trim()) continue;
      if (el.children.length && !/^(P|H1|H2|H3|H4|A|LI|SMALL|SPAN|STRONG|EM|CODE)$/.test(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.5) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const L1 = lum(fg);
      const L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const need = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
      if (ratio < need) low.push(`${ratio.toFixed(2)} ${Math.round(size)}px ${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${el.textContent.trim().slice(0, 26)}"`);
    }
    const uniq = [...new Set(low)];
    return { h: document.documentElement.scrollHeight, overflow: bad, lowContrast: uniq.slice(0, 10), lowCount: low.length };
  });
  console.log(`${file}  ${JSON.stringify(info)}`);
}

await shot("/", "/tmp/qa-home.png");
await shot("/p/the-premise", "/tmp/qa-record.png");
await shot("/p/the-shortest-page", "/tmp/qa-tomb.png", 1440, 1000, false);
await shot("/graveyard", "/tmp/qa-grave.png");
await shot("/", "/tmp/qa-mobile.png", 390, 844, true);
await shot("/p/the-premise", "/tmp/qa-mobile-record.png", 390, 844, true);

console.log("errors:", errors.slice(0, 6));
await browser.close();
