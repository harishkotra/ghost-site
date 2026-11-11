/**
 * Publishes any seed page that is not already alive on chain.
 *
 *   npm run seed          publish
 *   npm run seed -- --dry  list what would be published
 *
 * Uses whatever key is in .env. It never creates a wallet.
 */
import { BLOCK_SECONDS, createPage, readLive, publicClient, setupIssue } from "../server/chain.js";
import { pages } from "./content.js";

const dry = process.argv.includes("--dry");

const live = await readLive();
const have = new Set(live.pages.map((p) => p.slug));
const pending = pages.filter((p) => !have.has(p.slug));

console.log(`chain has ${live.pages.length} live record(s) at block ${live.block}`);
for (const p of pages) {
  const days = (p.lifeBlocks * BLOCK_SECONDS) / 86_400;
  console.log(`  ${have.has(p.slug) ? "alive" : "queued"}  ${p.slug.padEnd(18)} ${days.toFixed(2)} days`);
}

if (pending.length === 0) {
  console.log("nothing to publish");
  process.exit(0);
}

if (setupIssue) {
  console.error(`\n${setupIssue.code}: ${setupIssue.message}`);
  process.exit(1);
}

if (dry) {
  console.log(`\ndry run: ${pending.length} page(s) would be published`);
  process.exit(0);
}

let slot = live.pages.reduce((m, p) => Math.max(m, p.slot), 0);
let made = 0;

for (const page of pending) {
  const block = Number(await publicClient.getBlockNumber());
  const days = (page.lifeBlocks * BLOCK_SECONDS) / 86_400;
  slot += 1;

  try {
    const out = await createPage({
      slug: page.slug,
      section: page.section,
      title: page.title,
      dek: page.dek,
      author: page.author,
      body: page.body,
      slot,
      days: Math.max(days, 0.001),
    });
    made += 1;
    console.log(
      `made   ${page.slug} → ${out.entityKey} · expiry block ${out.expiresAt} (+${Number(out.expiresAt) - block})`
    );
  } catch (err: any) {
    const msg = String(err?.shortMessage || err?.message || err);
    console.error(`fail   ${page.slug}: ${msg}`);
    if (/balance|funds|insufficient|Execution error without revert/i.test(msg)) {
      console.error("relayer has no GLM — fund the address in .env at https://hub.arkiv.network/faucet");
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1_400));
}

console.log(`\n${made} published, ${pending.length - made} left`);
process.exit(made === pending.length ? 0 : 1);
