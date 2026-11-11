import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import {
  BLOCK_SECONDS,
  account,
  extendPage,
  graveyard,
  harvest,
  ledger,
  readLive,
  registry,
  setupIssue,
  type LivePage,
} from "./chain.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------- state */

const CACHE_MS = 6_000;
let cache: { at: number; payload: any } | null = null;

const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : null);

function shape(p: LivePage, block: number) {
  const l = ledger.read()[p.slug];
  const remainingBlocks = Math.max(0, p.expiresAt - block);
  const lifetime = p.createdAt != null ? Math.max(1, p.expiresAt - p.createdAt) : 302_400;
  return {
    slug: p.slug,
    section: p.section,
    title: p.title,
    dek: p.dek,
    author: p.author,
    entityKey: p.entityKey,
    owner: p.owner,
    ownerShort: short(p.owner),
    expiresAtBlock: p.expiresAt,
    createdAtBlock: p.createdAt,
    remainingBlocks,
    remainingSeconds: remainingBlocks * BLOCK_SECONDS,
    lifetimeBlocks: lifetime,
    decay: Math.min(1, Math.max(0, remainingBlocks / lifetime)),
    saves: l?.saves.length ?? 0,
    lastSaver: short(l?.lastSaver),
    saves24h: (l?.saves ?? []).filter((s) => Date.now() - new Date(s.at).getTime() < 86_400_000).length,
    history: (l?.saves ?? []).slice(-10).map((s) => ({ at: s.at, blocks: s.blocks, tx: s.txHash })),
  };
}

async function buildState() {
  const { pages, block } = await readLive();
  const reg = registry.remember(pages, block);
  const tombs = harvest(reg.pages, pages, block);
  const l = ledger.read();

  const shapes = pages.map((p) => shape(p, block)).sort((a, b) => a.remainingBlocks - b.remainingBlocks);
  const soonest = shapes[0];
  const totalSaves = Object.values(l).reduce((n, e) => n + e.saves.length, 0);

  return {
    ok: true,
    block,
    blockSeconds: BLOCK_SECONDS,
    now: new Date().toISOString(),
    relayer: account?.address ?? null,
    hasKey: Boolean(account),
    setupIssue,
    stats: {
      alive: shapes.length,
      dead: tombs.length,
      saves: totalSaves,
      secondsGiven: totalSaves * Number(2 * 43_200) * BLOCK_SECONDS,
      soonest: soonest
        ? { slug: soonest.slug, title: soonest.title, seconds: soonest.remainingSeconds }
        : null,
    },
    pages: shapes,
    graveyard: [...tombs].sort((a, b) => b.saves - a.saves || a.livedSeconds - b.livedSeconds),
    loved: [...shapes]
      .filter((p) => p.saves > 0)
      .sort((a, b) => b.saves - a.saves)
      .slice(0, 5)
      .map((p) => ({ slug: p.slug, title: p.title, saves: p.saves, alive: true })),
    forgotten: [...tombs]
      .sort((a, b) => a.livedSeconds - b.livedSeconds || a.saves - b.saves)
      .slice(0, 5)
      .map((t) => ({ slug: t.slug, title: t.title, saves: t.saves, livedSeconds: t.livedSeconds, alive: false })),
  };
}

app.get("/api/state", async (_req, res) => {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) return res.json(cache.payload);
    const payload = await buildState();
    cache = { at: Date.now(), payload };
    res.json(payload);
  } catch (err: any) {
    res.status(502).json({ ok: false, error: String(err?.shortMessage || err?.message || err) });
  }
});

app.get("/api/page/:slug", async (req, res) => {
  const slug = String(req.params.slug || "");
  try {
    const { pages, block } = await readLive(true);
    const page = pages.find((p) => p.slug === slug);
    if (page) {
      const s = shape(page, block);
      return res.json({ ok: true, block, blockSeconds: BLOCK_SECONDS, alive: true, page: { ...s, body: page.body ?? "" }, relayer: account?.address ?? null });
    }
    const tomb = graveyard.read().tombs.find((t) => t.slug === slug);
    if (tomb) return res.json({ ok: true, block, blockSeconds: BLOCK_SECONDS, alive: false, tomb });
    return res.status(404).json({ ok: false, error: "No such record, alive or dead." });
  } catch (err: any) {
    return res.status(502).json({ ok: false, error: String(err?.shortMessage || err?.message || err) });
  }
});

/* --------------------------------------------------------------- keep alive */

const lastKeep = new Map<string, number>();
const KEEP_COOLDOWN_MS = 15_000;

app.post("/api/keep", async (req, res) => {
  const slug = String(req.body?.slug || "");
  if (!slug) return res.status(400).json({ ok: false, error: "slug required" });

  const ip = String(req.ip || "anon");
  const prev = lastKeep.get(ip) ?? 0;
  if (Date.now() - prev < KEEP_COOLDOWN_MS) {
    const wait = Math.ceil((KEEP_COOLDOWN_MS - (Date.now() - prev)) / 1000);
    return res.status(429).json({ ok: false, error: `The relayer needs ${wait}s. One payment at a time.` });
  }

  try {
    const { pages, block } = await readLive();
    const page = pages.find((p) => p.slug === slug);
    if (!page) return res.status(404).json({ ok: false, error: "Record is not on chain. It may already be dead." });

    const out = await extendPage(page.entityKey, page.expiresAt, block);
    lastKeep.set(ip, Date.now());
    ledger.addSave(slug, out.txHash, Number(out.expiresAt) - page.expiresAt, account?.address ?? "");
    cache = null;

    res.json({
      ok: true,
      txHash: out.txHash,
      expiresAtBlock: Number(out.expiresAt),
      remainingSeconds: Math.max(0, Number(out.expiresAt) - block) * BLOCK_SECONDS,
      addedBlocks: Number(out.expiresAt) - page.expiresAt,
      explorer: `https://explorer.arkiv.network/tx/${out.txHash}`,
    });
  } catch (err: any) {
    const text = String(err?.shortMessage || err?.message || err);
    const broke = /insufficient|funds|balance|Execution error without revert/i.test(text);
    res.status(broke ? 402 : 502).json({
      ok: false,
      error: broke
        ? "The relayer is out of testnet GLM. Fund the address in .env at hub.arkiv.network/faucet."
        : text,
    });
  }
});

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(account), relayer: account?.address ?? null, setupIssue });
});

/* ------------------------------------------------------------- static dist */

const dist = path.resolve(process.cwd(), "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(
    `ghost-site api on :${PORT} · relayer ${account?.address ?? "NONE (read-only)"}`
  );
  if (setupIssue) console.log(`setup: ${setupIssue.code} — ${setupIssue.message}`);
});
