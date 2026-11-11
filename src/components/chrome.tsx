import { fmtClock, num, pct } from "../lib/core";
import type { State } from "../lib/core";
import type { Route } from "../lib/useGhost";

type NavProps = { state: State | null; route: Route; navigate: (to: string) => void };

const short = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

export function Topbar({ state, liveBlock }: { state: State | null; liveBlock: number }) {
  const soonest = state?.stats.soonest?.seconds ?? null;
  return (
    <div className="topbar">
      <div className="wrap topbar__in">
        <span>ARKIV · RABDI TESTNET</span>
        <span className="topbar__mid">
          {state
            ? `RECORD ${num(Math.floor(liveBlock))} · ${
                soonest != null ? `NEXT DEATH IN ${fmtClock(soonest)}` : "NOTHING IS DYING YET"
              }`
            : "CONNECTING TO THE DATABASE CHAIN"}
        </span>
        <span className="topbar__right">
          <i className={state?.hasKey ? "pulse" : "pulse"} aria-hidden="true" />
          {state ? (state.hasKey ? `RELAYER ${short(state.relayer)}` : "RELAYER NOT CONFIGURED") : "RELAYER UNKNOWN"}
        </span>
      </div>
    </div>
  );
}

const LINKS = [
  { label: "Index", to: "/#index", rotAfter: 99 },
  { label: "Graveyard", to: "/graveyard", rotAfter: 4 },
  { label: "Method", to: "/#method", rotAfter: 2 },
];

export function Nav({ state, route, navigate }: NavProps) {
  const dead = state?.stats.dead ?? 0;
  return (
    <header className="nav">
      <div className="wrap nav__in">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <i className="brand__mark" aria-hidden="true" />
          Ghost Site
          <span className="brand__tag">AN ARKIV EXPERIMENT</span>
        </a>
        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) => {
            const rotten = dead >= l.rotAfter;
            return (
              <a
                key={l.label}
                href={l.to}
                aria-current={route.kind === "graveyard" && l.to === "/graveyard" ? "page" : undefined}
                style={
                  rotten
                    ? { textDecoration: "line-through", opacity: 0.32, pointerEvents: "none" }
                    : undefined
                }
                title={rotten ? "This link died with the site." : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  if (rotten) return;
                  navigate(l.to.replace("/#", "/#"));
                  if (l.to.startsWith("/#")) {
                    const id = l.to.slice(2);
                    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60);
                  }
                }}
              >
                {l.label}
              </a>
            );
          })}
          <a
            className="btn btn--sm"
            href="/#index"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
              window.setTimeout(() => document.getElementById("index")?.scrollIntoView({ behavior: "smooth" }), 60);
            }}
          >
            Keep one alive
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Marquee({ state }: { state: State | null }) {
  const items: string[] = [];
  if (state) {
    for (const p of [...state.pages].sort((a, b) => a.remainingSeconds - b.remainingSeconds).slice(0, 6)) {
      items.push(`${p.title} — ${fmtClock(p.remainingSeconds)} LEFT — ${p.saves} SAVED IT`);
    }
    items.push(`BURIED RECORDS: ${state.stats.dead}`);
    items.push("THE GRAVEYARD IS NOT A METAPHOR");
    items.push(`TOTAL PAID TO KEEP THIS SITE ALIVE: ${state.stats.saves} TRANSACTIONS`);
  }
  if (items.length === 0) items.push("NOTHING HAS BEEN PUBLISHED YET — RUN npm run seed");

  const Seq = ({ keyPrefix }: { keyPrefix: string }) => (
    <div className="marquee__seq" aria-hidden={keyPrefix === "b" ? "true" : undefined}>
      {items.map((t, i) => (
        <span key={`${keyPrefix}-${i}`}>
          <i>/</i> {t}
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee">
      <div className="marquee__track">
        <Seq keyPrefix="a" />
        <Seq keyPrefix="b" />
      </div>
    </div>
  );
}

export function Footer({ state }: { state: State | null }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__top">
          <div>
            <span className="brand">
              <i className="brand__mark" aria-hidden="true" />
              Ghost Site
            </span>
            <p className="foot__blurb">
              Seven pages, written once, published to Arkiv with a seven day expiry. Every visitor can pay to push a
              page's expiry block forward. Nobody, including the author, can change a word after it is written.
            </p>
          </div>
          <div className="foot__col">
            <h4>This site</h4>
            <a href="/#index">The index</a>
            <a href="/graveyard">The graveyard</a>
            <a href="/#method">How it works</a>
          </div>
          <div className="foot__col">
            <h4>Arkiv</h4>
            <a href="https://arkiv.network" target="_blank" rel="noreferrer">
              arkiv.network
            </a>
            <a href="https://docs.arkiv.network" target="_blank" rel="noreferrer">
              Documentation
            </a>
            <a href="https://hub.arkiv.network/faucet" target="_blank" rel="noreferrer">
              Testnet faucet
            </a>
          </div>
          <div className="foot__col">
            <h4>Elsewhere</h4>
            <a href="https://harishkotra.me" target="_blank" rel="noreferrer">
              harishkotra.me
            </a>
            <a href="https://dailybuild.xyz" target="_blank" rel="noreferrer">
              dailybuild.xyz
            </a>
            <a href="https://x.com/harikotra" target="_blank" rel="noreferrer">
              @harikotra
            </a>
          </div>
        </div>
        <div className="foot__bot">
          <span>
            Built By Harish Kotra ·{" "}
            <a href="https://harishkotra.me" target="_blank" rel="noreferrer">
              harishkotra.me
            </a>{" "}
            · Checkout my other builds ·{" "}
            <a href="https://dailybuild.xyz" target="_blank" rel="noreferrer">
              dailybuild.xyz
            </a>
          </span>
          <span>
            RELAYER {state?.hasKey ? short(state.relayer) : "OFFLINE"} · BLOCK {state ? num(state.block) : "—"} ·{" "}
            {state ? `${pct((state.stats.alive + state.stats.dead) / 7)} OF THE SITE STILL EXISTS` : "SYNCING"}
          </span>
        </div>
      </div>
    </footer>
  );
}
