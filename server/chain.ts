import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineSchema, str, u64, bytes } from "@arkiv-network/sdk";
import { ExpirationTime } from "@arkiv-network/sdk";
import { desc } from "@arkiv-network/sdk/query";
import { rabdi } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/* ------------------------------------------------------------------ config */

const ROOT = path.resolve(process.cwd());

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

export const BLOCK_SECONDS = 2;
export const DAY_BLOCKS = 43_200n;
export const WEEK_BLOCKS = 302_400n;

/**
 * The key belongs to whoever runs this. Nothing here ever generates one.
 * If it is absent or malformed we stay up in read-only mode and every write
 * path throws SETUP with instructions instead of crashing the server.
 */
const rawKey = (process.env.PRIVATE_KEY || "").trim();

export type SetupIssue = { code: "NO_KEY" | "BAD_KEY"; message: string } | null;

function checkKey(k: string): SetupIssue {
  if (!k) {
    return {
      code: "NO_KEY",
      message:
        "No PRIVATE_KEY in .env. Put your own funded Rabdi testnet key in ~/ghost-site/.env, fund it at https://hub.arkiv.network/faucet, then restart.",
    };
  }
  const hex = k.startsWith("0x") ? k.slice(2) : k;
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    return { code: "BAD_KEY", message: "PRIVATE_KEY in .env is not a 32-byte hex private key (expect 64 hex chars)." };
  }
  return null;
}

export const setupIssue: SetupIssue = checkKey(rawKey);

export const account = setupIssue
  ? null
  : privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : "0x" + rawKey) as `0x${string}`);

export const GhostPages = defineSchema("ghost-site-v1", {
  slug: str().indexed(),
  section: str(),
  title: str(),
  dek: str(),
  author: str(),
  body: bytes(),
  slot: u64().indexed(),
});

const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY || "" });

export const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = account ? createWalletClient({ chain, transport: http(), account }) : null;

export function requireWallet() {
  if (!walletClient || !account) {
    const err: any = new Error(setupIssue?.message || "wallet not configured");
    err.code = setupIssue?.code || "NO_KEY";
    throw err;
  }
  return { client: walletClient, account };
}

/* ------------------------------------------------------------------- files */

const DATA = path.join(ROOT, "data");
fs.mkdirSync(DATA, { recursive: true });

type Json = Record<string, any>;
function readJson<T extends Json>(name: string, fallback: T): T {
  const f = path.join(DATA, name);
  if (!fs.existsSync(f)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as T;
  } catch {
    return fallback;
  }
}
function writeJson(name: string, value: unknown) {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(value, null, 2));
}

export type Snapshot = {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  body: string;
  bornAt: string;
  expiresAtBlock: number;
  lastSeenBlock: number;
  lastSeenAt: string;
  entityKey: string;
};

export type LedgerEntry = {
  saves: { at: string; txHash: string; blocks: number }[];
  lastSaver: string | null;
  firstSeen: string;
};
export type Ledger = Record<string, LedgerEntry>;

type RegistryFile = { pages: Record<string, Snapshot> };

export const registry = {
  read: () => readJson<RegistryFile>("registry.json", { pages: {} }),
  write: (v: RegistryFile) => writeJson("registry.json", v),
  /** Remember what a page said while it is still alive, so its tombstone can quote it. */
  remember(pages: LivePage[], block: number) {
    const r = registry.read();
    let dirty = false;
    for (const p of pages) {
      const prev = r.pages[p.slug];
      if (!prev) {
        r.pages[p.slug] = {
          slug: p.slug,
          section: p.section,
          title: p.title,
          dek: p.dek,
          author: p.author,
          body: p.body ?? "",
          bornAt: new Date().toISOString(),
          expiresAtBlock: p.expiresAt,
          lastSeenBlock: block,
          lastSeenAt: new Date().toISOString(),
          entityKey: p.entityKey,
        };
        dirty = true;
        continue;
      }
      prev.expiresAtBlock = p.expiresAt;
      prev.lastSeenBlock = block;
      prev.lastSeenAt = new Date().toISOString();
      prev.entityKey = p.entityKey;
      if (p.body && prev.body !== p.body) prev.body = p.body;
      dirty = true;
    }
    if (dirty) registry.write(r);
    return r;
  },
};

export const ledger = {
  read: () => readJson<Ledger>("ledger.json", {}),
  write: (v: Ledger) => writeJson("ledger.json", v),
  addSave(slug: string, txHash: string, blocks: number, saver: string) {
    const l = ledger.read();
    const e = (l[slug] ??= { saves: [], lastSaver: null, firstSeen: new Date().toISOString() });
    e.saves.push({ at: new Date().toISOString(), txHash, blocks });
    e.lastSaver = saver;
    ledger.write(l);
  },
};

export type Tomb = {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  body: string;
  bornAt: string;
  diedAt: string;
  saves: number;
  lastSaver: string | null;
  entityKey: string;
  livedSeconds: number;
  lastSaverShort: string | null;
};

export const graveyard = {
  read: () => readJson<{ tombs: Tomb[] }>("graveyard.json", { tombs: [] }),
  write: (v: { tombs: Tomb[] }) => writeJson("graveyard.json", v),
};

/* ------------------------------------------------------------------- chain */

export type LivePage = {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  body?: string;
  slot: number;
  entityKey: string;
  owner: string;
  expiresAt: number;
  createdAt: number | null;
};

function decodeText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const hex = v.startsWith("0x") ? v.slice(2) : v;
    try {
      return new TextDecoder().decode(Buffer.from(hex, "hex"));
    } catch {
      return v;
    }
  }
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (typeof v === "object" && "value" in (v as any)) return decodeText((v as any).value);
  return String(v);
}

function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

const BASE = {
  $key: true,
  $owner: true,
  $expiresAt: true,
  $createdAt: true,
  slug: true,
  section: true,
  title: true,
  dek: true,
  author: true,
  slot: true,
} as const;

const WITH_BODY = { ...BASE, body: true } as const;

export async function readLive(withBody = false): Promise<{ pages: LivePage[]; block: number }> {
  const res = await publicClient
    .select(withBody ? WITH_BODY : BASE)
    .from(GhostPages)
    .orderBy(desc("slot"))
    .limit(100)
    .fetch();

  const pages = res.entities.map((r: any) => ({
    slug: String(r.slug?.value ?? ""),
    section: String(r.section?.value ?? ""),
    title: String(r.title?.value ?? ""),
    dek: String(r.dek?.value ?? ""),
    author: String(r.author?.value ?? ""),
    ...(withBody ? { body: decodeText(r.body) } : {}),
    slot: Number(r.slot?.value ?? 0),
    entityKey: String(r.$key ?? ""),
    owner: String(r.$owner ?? ""),
    expiresAt: Number(r.$expiresAt ?? 0),
    createdAt: r.$createdAt != null ? Number(r.$createdAt) : null,
  }));

  return { pages, block: Number(res.blockNumber) };
}

export async function createPage(input: {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  body: string;
  slot: number;
  days?: number;
}) {
  const { client } = requireWallet();
  const out = await client.createEntity(
    GhostPages,
    {
      slug: input.slug,
      section: input.section,
      title: input.title,
      dek: input.dek,
      author: input.author,
      body: encodeText(input.body),
      slot: u64(BigInt(input.slot)),
    } as any,
    { expiration: ExpirationTime.fromDays(input.days ?? 7), flags: { readonly: true, permissionlessExtension: true } } as any
  );
  return out as unknown as { entityKey: `0x${string}`; txHash: `0x${string}`; expiresAt: bigint };
}

/**
 * Adds two days on top of whatever is left. The engine refuses to move an
 * expiry earlier, so we always extend from max(current, now).
 */
export async function extendPage(entityKey: string, currentExpiresBlock: number, block: number) {
  const { client } = requireWallet();
  const target = BigInt(Math.max(currentExpiresBlock, block) + Number(DAY_BLOCKS * 2n));
  const out = await client.extendEntity({
    entityKey,
    expiration: ExpirationTime.atBlock(target),
  } as any);
  return { ...(out as { txHash: `0x${string}`; expiresAt: bigint }), target };
}

/* ---------------------------------------------------------------- harvest */

const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : null);

/**
 * Pages that fell out of the database become tombstones. The chain has already
 * deleted the record; this local index is what the graveyard is printed from.
 */
export function harvest(known: Record<string, Snapshot>, live: LivePage[], block: number): Tomb[] {
  const liveSlugs = new Set(live.map((p) => p.slug));
  const g = graveyard.read();
  const have = new Set(g.tombs.map((t) => t.slug));
  const l = ledger.read();
  let changed = false;

  for (const [slug, meta] of Object.entries(known)) {
    if (liveSlugs.has(slug) || have.has(slug)) continue;

    const seenAt = Date.parse(meta.lastSeenAt || new Date().toISOString());
    const blocksLeft = Math.max(0, (meta.expiresAtBlock || 0) - (meta.lastSeenBlock || block));
    const diedAtMs = seenAt + blocksLeft * BLOCK_SECONDS * 1000;
    const bornMs = Date.parse(meta.bornAt || meta.lastSeenAt);
    const entry = l[slug];

    g.tombs.push({
      slug,
      section: meta.section || "",
      title: meta.title || slug,
      dek: meta.dek || "",
      author: meta.author || "",
      body: meta.body || "",
      bornAt: new Date(bornMs).toISOString(),
      diedAt: new Date(Math.max(diedAtMs, bornMs + 60_000)).toISOString(),
      saves: entry?.saves.length ?? 0,
      lastSaver: entry?.lastSaver ?? null,
      lastSaverShort: short(entry?.lastSaver),
      entityKey: meta.entityKey || "",
      livedSeconds: Math.round((Math.max(diedAtMs, bornMs + 60_000) - bornMs) / 1000),
    });
    changed = true;
  }
  if (changed) graveyard.write(g);
  return g.tombs;
}
