# Ghost Site

**A website whose pages have to earn their next day.**

Seven pages, published once to Arkiv with a seven day expiry. The top bar carries a live death clock. Any reader can pay to push a page's expiry further out. Nobody, including the author, can edit a single word after publication. When the last extension runs out, Arkiv deletes the record and the page turns into a tombstone in the graveyard.

Built on Rabdi testnet, served from a single Express process plus a React SPA.

```
ARKIV · RABDI TESTNET      RECORD 516,304 · NEXT DEATH IN 04:12:38:07      RELAYER 0x94BD…7B05
```

---

## Why this exists

Every website is a promise to keep paying for a server. Most of those promises get broken quietly, and the URL keeps working long enough that nobody notices until it doesn't. Reading other people's writing on the internet is mostly reading tombstones of things that used to be there.

Arkiv makes expiry a first class property of a record. An entity carries its own deadline on chain, and the database refuses to serve it once that deadline passes. That is a different mechanic from deleting a row in Postgres, because nobody can quietly extend a record forever without paying for the privilege, and nobody can rewrite the record to mean something else.

Ghost Site is the smallest honest application of that idea: a publication where survival is the only mutable property.

---

## The mechanic

1. `npm run seed` writes seven pages to the `ghost-site-v1` schema, each with `flags: { readonly: true, permissionlessExtension: true }`.
2. The index shows every page with a decay bar, computed from `expiresAt` and the live block.
3. A reader clicks **Keep this alive**. The server's relayer signs `extendEntity`, adding two days on top of whatever remains, and returns the transaction hash.
4. The page's expiry moves forward. The reader never needs a wallet, and never gains control over the page.
5. If nobody clicks it long enough, the entity expires. The relayer notices it is gone, writes a tombstone with the death date, the lifetime in seconds, the number of saves, and the last saver's address.
6. Two boards rank the dead: **Most Loved** by GLM spent keeping it alive, **Most Forgotten** by dying fastest with zero saves.

The important detail is that extension is permissionless at the protocol level, not at the app level. Ghost Site's relayer is a convenience, not an authority. Anyone could extend these pages with their own key and the result would be identical.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Chain | Arkiv Rabdi testnet (`chainId 7794095`) | Entities with native expiry, free reads on DB Chain 1 |
| SDK | `@arkiv-network/sdk@1.0.1` | `createEntity`, `extendEntity`, typed schemas, query builder |
| Transport | `viem` (`http()`, `privateKeyToAccount`) | The SDK expects a viem transport and account |
| API | Express 4 on `tsx` | One file, no build step, hot reload via `tsx watch` |
| UI | Vite 5, React 18, TypeScript strict | Fast iteration, no framework opinions to fight |
| Styles | One hand written `index.css` (1800+ lines) | Full control over the editorial layout, no utility soup |
| Type | Space Grotesk + IBM Plex Mono, self hosted | Brand match with arkiv.network, no third party font calls |
| QA | `puppeteer-core` + local Chrome | Layout, overflow, contrast and console audits against the real app |

No component library, no CSS framework, no animation library. Everything you see is markup plus one stylesheet.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│                                                                      │
│  src/App.tsx            route: /  /graveyard  /p/:slug               │
│  src/lib/useGhost.ts    poll /api/state every 6s, tick clock every 1s│
│  src/components/        chrome, home, record                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  JSON over HTTP (same origin, or Vite proxy)
┌───────────────────────────────▼──────────────────────────────────────┐
│  Relayer and read API (Express, server/index.ts)                     │
│                                                                      │
│  GET  /api/state          cached 6s, shapes pages + tombs + boards   │
│  GET  /api/page/:slug     full record, or its tombstone              │
│  POST /api/keep           one extension per IP per 15s               │
│  GET  /api/health         block number, key state                    │
│                                                                      │
│  server/chain.ts          schema, create, read, extend, harvest      │
│  data/registry.json       last known state of every page             │
│  data/ledger.json         every save: tx hash, blocks, timestamp     │
│  data/graveyard.json      tombstones, written when a page disappears │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  viem transport, relayer key from .env
┌───────────────────────────────▼──────────────────────────────────────┐
│  Arkiv (Rabdi testnet)                                               │
│                                                                      │
│  schema ghost-site-v1                                                │
│    slug str.indexed · section str · title str · dek str · author str  │
│    body bytes · slot u64.indexed                                     │
│                                                                      │
│  every entity: readonly + permissionlessExtension, fixed at creation │
└──────────────────────────────────────────────────────────────────────┘
```

Three facts shape the whole design:

- **Reads are free, writes cost GLM.** The UI can poll aggressively, the relayer must be economical.
- **Expiry lives on chain, not in a database column.** The moment a record expires, every query stops returning it. There is no soft delete to undo.
- **Flags are immutable after creation.** "No operation changes them afterwards, so an entity is whatever it was created as for life." That is why the pages cannot be edited even by whoever owns the key.

---

## Data model

```ts
export const GhostPages = defineSchema("ghost-site-v1", {
  slug: str().indexed(),   // route key
  section: str(),          // PREMISE, FIELD NOTES, NOTICE
  title: str(),
  dek: str(),              // one line standfirst
  author: str(),
  body: bytes(),           // long prose, see note below
  slot: u64().indexed(),   // publication order
});
```

Two constraints worth knowing before you extend this:

- `str()` columns are capped at 256 bytes, so page bodies live in `bytes()` and are encoded with `TextEncoder`.
- Only indexed columns can be sorted, so `slot: u64()` exists purely to give the index a stable order. It also has to be a branded value, `u64(BigInt(n))`, or the SDK throws `SchemaMismatchError`.

---

## Code

### Creating a page

The write path is three positional arguments: schema, values, options. Options carry the two flags that make the whole concept work.

```ts
const { client } = requireWallet();

await client.createEntity(
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
  {
    expiration: ExpirationTime.fromDays(input.days ?? 7),
    flags: { readonly: true, permissionlessExtension: true },
  } as any,
);
```

### Extending a page

Extension always moves forward. The engine will not accept an earlier expiry, so the target is computed from `max(current, now)` rather than from the current expiry alone.

```ts
const target = BigInt(Math.max(currentExpiresBlock, block) + Number(DAY_BLOCKS * 2n));

await client.extendEntity({
  entityKey,
  expiration: ExpirationTime.atBlock(target),
} as any);
```

`DAY_BLOCKS = 43_200n` because Rabdi produces a block every two seconds. Time on this chain is measured in blocks, and every clock in the UI is derived from the block number rather than from `Date.now()`.

### Reading the index

```ts
const res = await publicClient
  .select({ $key: true, $owner: true, $expiresAt: true, slug: true, /* … */ })
  .from(GhostPages)
  .orderBy(desc("slot"))
  .limit(100)
  .fetch();

const pages = res.entities.map((r) => ({
  slug: String(r.slug?.value ?? ""),
  entityKey: String(r.$key ?? ""),
  expiresAt: Number(r.$expiresAt ?? 0),
}));
```

Column values arrive boxed as `{ value }`, and the meta columns are `$key`, `$owner`, `$expiresAt`, `$createdAt`. `desc` comes from the subpath import `@arkiv-network/sdk/query`.

### The keep alive route

```ts
app.post("/api/keep", async (req, res) => {
  // one payment per IP per 15 seconds
  // resolve slug -> entityKey + current expiry from the cached state
  // extendPage(entityKey, expiresAt, liveBlock)
  // append to data/ledger.json so the boards have history
});
```

The relayer can only add time. It cannot create pages, change text, transfer ownership, or delete anything. If `.env` has no key the server still boots, serves reads, and returns a structured `setupIssue` so the UI can show setup instructions instead of a broken page.

---

## Repo layout

```
server/chain.ts             env loading, schema, create, read, extend, tombstones
server/index.ts             express routes, 6s cache, shaping, rate limit
scripts/content.ts          the seven seed pages, lifetimes in blocks
scripts/seed.ts             idempotent publisher, --dry to preview
src/lib/core.ts             types, fetch helpers, formatters
src/lib/useGhost.ts         polling hook, live block, hash routing
src/components/chrome.tsx   topbar, nav, marquee, footer
src/components/home.tsx     hero, index, decay meters, boards, graveyard
src/components/record.tsx   single page, keep button, tombstone view
src/index.css               the entire design system
public/fonts/               self hosted woff2 + fonts.css
scripts/qa/                 puppeteer layout, contrast and overflow audits
```

---

## Setup

You need Node 20+ and a funded Rabdi testnet wallet. This repo never generates a wallet for you.

```bash
npm install
cp .env.example .env
# PRIVATE_KEY=0x...        your own testnet key, funded at hub.arkiv.network/faucet
# ARKIV_ACCESS_KEY=...     optional
```

```bash
npm run seed -- --dry   # list what would be published, no writes
npm run seed            # publish the pages that are not on chain yet
npm run api             # relayer and read API on :8787
npm run dev             # vite on :5173, proxies /api
```

Production on one port:

```bash
npm run build && npm start     # http://localhost:8787
```

`npm run seed` is idempotent: it reads the live slugs first and only creates what is missing, so you can re-run it after adding a page to `scripts/content.ts`.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `PRIVATE_KEY` | for writes | Relayer signer. Never printed, never committed, never generated by the app. |
| `ARKIV_ACCESS_KEY` | no | DB chain access key, if you have one |
| `PORT` | no | Defaults to 8787 |

`.env` is gitignored. `data/` is gitignored because it is local state, not source.

---

## Forking and contributing

```bash
git clone <your fork> ghost-site && cd ghost-site
npm install
cp .env.example .env    # own key, own faucet claim
npm run seed -- --dry
npm run seed
npm run api & npm run dev
```

Ground rules that keep this honest:

1. **No generated keys.** Do not add scripts that mint wallets or addresses. If setup needs funding, say so in the UI, as `SetupBox` does.
2. **No fabricated chain data in the app.** The QA harness in `scripts/qa/` intercepts `/api/state` at the network layer for layout review only. Nothing fake reaches a real render.
3. **Reads stay free.** Do not put a paywall or auth in front of `/api/state`.
4. **The relayer stays constrained.** Only `extendEntity`. If a feature needs a broader signer, it needs a different design, not a wider key.

### Good first issues

- Replace the 6s poll with `watchEntityEvents` over a stream, so the death clock and the boards update on `onExpiryExtended` instead of on a timer.
- Make the seed corpus user authored: a form that publishes a page with a chosen lifetime, plus per page typography.
- Add a `npm run verify` script that re-reads every seeded entity and diffs it against `scripts/content.ts`, so a fork can prove its writes landed.
- Server side rendering for `/p/:slug`, so a dead page's tombstone has a real meta description when shared.

### Feature ideas

| Idea | Effort | Notes |
| --- | --- | --- |
| Resurrection | S | Create a new entity from a tombstone, with `revivedFrom` in the schema. The old one stays dead. |
| Extension auctions | M | Highest bid within a window sets the next expiry. Turns survival into a market. |
| NFT tombstone | M | Mint on death, metadata points at the entity key. Collectible grief. |
| Sponsor leaderboard | S | Aggregate `data/ledger.json` by address, not by page. |
| Expiry notification bot | S | Cron over `/api/state`, ping a channel before a page dies. |
| Per page themes | M | Section to typography and colour maps, author picks at publish time. |
| Multi chain | L | `rabdi` is one import. Abstract the chain module and deploy to a second network. |
| Public write API | M | Let a wallet connect and publish directly, keeping the relayer only for extensions. |

---

## Gotchas, learned the hard way

- `str()` caps at 256 bytes. Long prose needs `bytes()`.
- `u64` values must be branded: `u64(BigInt(n))`, not `BigInt(n)`.
- `createEntity` is positional: `(schema, values, options)`. There is an options object inside `options`, which is where `expiration` and `flags` live.
- Sort keys must be indexed columns, and query helpers live at `@arkiv-network/sdk/query`, not the SDK root.
- `http` comes from `viem`, not the Arkiv SDK. Mixing the two causes an ESM loader crash.
- Expired entities simply stop appearing in query results. There is no event to subscribe to for "this record is gone", which is why the relayer keeps `registry.json` and diffs it against every read.