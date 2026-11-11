export type SaveRow = { at: string; blocks: number; tx: string };

export type PageRow = {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  entityKey: string;
  owner: string;
  ownerShort: string | null;
  expiresAtBlock: number;
  createdAtBlock: number | null;
  remainingBlocks: number;
  remainingSeconds: number;
  lifetimeBlocks: number;
  decay: number;
  saves: number;
  lastSaver: string | null;
  saves24h: number;
  history: SaveRow[];
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
  lastSaverShort: string | null;
  entityKey: string;
  livedSeconds: number;
};

export type SetupIssue = { code: string; message: string } | null;

export type State = {
  ok: boolean;
  block: number;
  blockSeconds: number;
  now: string;
  relayer: string | null;
  hasKey: boolean;
  setupIssue: SetupIssue;
  stats: {
    alive: number;
    dead: number;
    saves: number;
    secondsGiven: number;
    soonest: { slug: string; title: string; seconds: number } | null;
  };
  pages: PageRow[];
  graveyard: Tomb[];
  loved: { slug: string; title: string; saves: number; alive: boolean }[];
  forgotten: { slug: string; title: string; saves: number; livedSeconds: number; alive: boolean }[];
};

export type RecordPayload =
  | { ok: true; block: number; blockSeconds: number; alive: true; page: PageRow & { body: string }; relayer: string | null }
  | { ok: true; block: number; blockSeconds: number; alive: false; tomb: Tomb }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ format */

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

export function splitSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  return { d: Math.floor(s / 86_400), h: Math.floor((s % 86_400) / 3_600), m: Math.floor((s % 3_600) / 60), s: s % 60 };
}

/** Big clock: days when there is room, otherwise hh:mm:ss. */
export function fmtClock(total: number) {
  const { d, h, m, s } = splitSeconds(total);
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function fmtSpan(total: number) {
  const { d, h, m, s } = splitSeconds(total);
  if (d > 1) return `${d} days`;
  if (d === 1) return `1 day ${h}h`;
  if (h >= 1) return `${h}h ${pad(m)}m`;
  if (m >= 1) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

export function fmtDate(input: string | number | null | undefined) {
  if (input == null) return "—";
  const d = typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const num = (n: number) => n.toLocaleString("en-US");

export const pct = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;

/* --------------------------------------------------------------------- api */

export async function fetchState(): Promise<State> {
  const res = await fetch("/api/state");
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "state unavailable");
  return json as State;
}

export async function fetchRecord(slug: string): Promise<RecordPayload> {
  const res = await fetch(`/api/page/${encodeURIComponent(slug)}`);
  return (await res.json()) as RecordPayload;
}

export async function keepAlive(slug: string) {
  const res = await fetch("/api/keep", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "extension failed");
  return json as { ok: true; txHash: string; addedBlocks: number; remainingSeconds: number; explorer: string };
}
