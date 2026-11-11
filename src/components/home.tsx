import { useState } from "react";
import { fmtClock, fmtDate, fmtSpan, keepAlive, num, pct } from "../lib/core";
import type { State, Tomb } from "../lib/core";

/* ------------------------------------------------------------------- bits */

export function Decay({
  value,
  low,
  dead,
  left,
  right,
}: {
  value: number;
  low?: boolean;
  dead?: boolean;
  left: string;
  right: string;
}) {
  return (
    <div className="decay">
      <div className="decay__track">
        <div
          className="decay__fill"
          data-low={low ? "true" : undefined}
          data-dead={dead ? "true" : undefined}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
        {!dead && <div className="decay__ticks" />}
      </div>
      <div className="decay__read">
        <b>{left}</b>
        <span>{right}</span>
      </div>
    </div>
  );
}

type Toast = { text: string; tone?: "ok" | "err" } | null;

export function KeepButton({
  slug,
  size = "sm",
  onDone,
  label = "Keep this alive",
  disabled,
}: {
  slug: string;
  size?: "sm" | "md";
  onDone: (t: Toast) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    onDone({ text: "Signing an extension with the relayer…", tone: "ok" });
    try {
      const out = await keepAlive(slug);
      onDone({
        text: `+${Math.round(out.addedBlocks / 43_200)} days bought · ${out.txHash.slice(0, 10)}…`,
        tone: "ok",
      });
    } catch (err: any) {
      onDone({ text: String(err?.message || err), tone: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn ${size === "sm" ? "btn--sm" : ""} btn--coral irow__act`}
      onClick={pay}
      disabled={busy || disabled}
      type="button"
    >
      {busy ? "Paying…" : label}
    </button>
  );
}

/* ------------------------------------------------------------------- hero */

export function Hero({ state, liveBlock }: { state: State | null; liveBlock: number }) {
  return (
    <section className="wrap hero">
      <div className="hero__grid">
        <div>
          <div className="hero__kicker">
            <span className="label label--ink">Issue 001</span>
            <hr className="rule" />
            <span className="label">Published to Arkiv · expires in 7 days</span>
          </div>
          <h1 className="display">
            This website
            <br />
            is <em>dying</em>
          </h1>
          <p className="hero__sub">
            Every page here was written once and published to Arkiv with an expiry block. When the clock reaches zero
            the record is deleted from the database, not hidden. No backup, no archive, no "are you sure".
            <br />
            <br />
            You can't edit a word of it. You can only buy it more time.
          </p>
          <div className="hero__cta">
            <a
              className="btn btn--coral"
              href="#index"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("index")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Save a page
            </a>
            <a className="btn btn--ghost" href="/graveyard" onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/graveyard"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
              Visit the graveyard
            </a>
          </div>
          <div className="hero__meta">
            <span>Radius: Arkiv · Rabdi testnet</span>
            <span>
              Block time <b>{state?.blockSeconds ?? 2}s</b>
            </span>
            <span>
              Alive <b>{state?.stats.alive ?? 0}</b>
            </span>
            <span>
              Buried <b>{state?.stats.dead ?? 0}</b>
            </span>
            <a href="https://arkiv.network" target="_blank" rel="noreferrer">
              What is Arkiv?
            </a>
          </div>
        </div>
        <Vitals state={state} liveBlock={liveBlock} />
      </div>
    </section>
  );
}

function Vitals({ state, liveBlock }: { state: State | null; liveBlock: number }) {
  const soonest = state?.stats.soonest ?? null;
  const bars = [...(state?.pages ?? [])].sort((a, b) => a.remainingSeconds - b.remainingSeconds);
  return (
    <aside className="vitals" aria-label="Live state of the site">
      <div className="vitals__head">
        <span className="label">Vitals</span>
        <span className="label">Block {state ? num(Math.floor(liveBlock)) : "—"}</span>
      </div>
      <div className="vitals__body">
        <div className="vitals__value">
          <span className="vitals__num">{soonest ? fmtClock(soonest.seconds) : "—"}</span>
          <span className="vitals__unit">until first death</span>
        </div>
        <p className="vitals__cap">
          {soonest ? soonest.title : "Nothing is on chain yet"}
        </p>
        <div className="bars" aria-hidden="true">
          {bars.length === 0
            ? Array.from({ length: 7 }).map((_, i) => (
                <div className="bar-col" key={i}>
                  <div className="bar-fill" style={{ height: "6%" }} />
                </div>
              ))
            : bars.map((p) => {
                const h = Math.max(4, Math.min(100, p.decay * 100));
                return (
                  <div className="bar-col" key={p.slug} title={`${p.title} — ${fmtSpan(p.remainingSeconds)} left`}>
                    <div className="bar-fill" data-low={p.decay < 0.25 ? "true" : undefined} style={{ height: `${h}%` }} />
                  </div>
                );
              })}
        </div>
        <dl className="vitals__rows">
          <div className="vrow">
            <dt>Records alive</dt>
            <dd>{state?.stats.alive ?? 0} / 7</dd>
          </div>
          <div className="vrow">
            <dt>Records buried</dt>
            <dd className={(state?.stats.dead ?? 0) > 0 ? "alert" : undefined}>{state?.stats.dead ?? 0}</dd>
          </div>
          <div className="vrow">
            <dt>Extensions paid</dt>
            <dd>{state?.stats.saves ?? 0}</dd>
          </div>
          <div className="vrow">
            <dt>Time bought</dt>
            <dd>{fmtSpan(state?.stats.secondsGiven ?? 0)}</dd>
          </div>
          <div className="vrow">
            <dt>Write access</dt>
            <dd className={state?.hasKey ? undefined : "alert"}>{state?.hasKey ? "Relayer armed" : "No key in .env"}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ index */

export function IndexList({
  state,
  onToast,
  navigate,
}: {
  state: State | null;
  onToast: (t: Toast) => void;
  navigate: (to: string) => void;
}) {
  const pages = state?.pages ?? [];
  return (
    <section className="wrap section" id="index">
      <div className="section__head">
        <div>
          <span className="label">The index</span>
          <h2 className="h2">Seven pages, one clock each</h2>
        </div>
        <p className="section__aside">
          Sorted by least time remaining. Click a title to read it before it goes. <b>Nobody can edit it back.</b>
        </p>
      </div>

      <div className="index">
        {pages.length === 0 && (
          <p className="ledger__empty">
            Nothing is on chain yet. Put a funded Rabdi key in <code>.env</code> and run <code>npm run seed</code> —
            the seven pages get published with a seven day expiry.
          </p>
        )}
        {pages.map((p, i) => (
          <article className="irow" key={p.slug}>
            <span className="irow__num">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <a
                className="irow__title"
                href={`/p/${p.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/p/${p.slug}`);
                }}
              >
                {p.title}
              </a>
              <p className="irow__dek">{p.dek}</p>
            </div>
            <span className="irow__sec">{p.section}</span>
            <div className="irow__decay">
              <Decay
                value={p.decay}
                low={p.decay < 0.25}
                left={fmtClock(p.remainingSeconds)}
                right={`${pct(p.decay)} left`}
              />
            </div>
            <div className="irow__saves">
              {p.saves} <span>saved</span>
            </div>
            <KeepButton slug={p.slug} onDone={onToast} />
          </article>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- graveyard */

export function Graveyard({ state, navigate }: { state: State | null; navigate: (to: string) => void }) {
  const tombs = state?.graveyard ?? [];
  return (
    <section className="grave">
      <div className="wrap section" id="graveyard">
        <div className="grave__head">
          <div>
            <span className="label">The graveyard</span>
            <h2 className="h2">What the chain deleted</h2>
          </div>
          <p className="grave__note">
            These records passed their expiry block. Arkiv dropped them from the database. The tombstones are this
            site's own index of what used to be there — the bytes are gone, the proof of them is not.
          </p>
        </div>

        {tombs.length === 0 ? (
          <p className="grave__empty">
            Empty. Nothing has died yet. That is the point of the premise: a website with an expiry date is a promise
            that this will not stay empty.
          </p>
        ) : (
          tombs.map((t: Tomb) => (
            <button
              key={t.slug}
              className="grow"
              style={{ background: "none", border: 0, width: "100%", textAlign: "left", color: "inherit" }}
              onClick={() => navigate(`/p/${t.slug}`)}
              type="button"
            >
              <span className="grow__cross">†</span>
              <div>
                <h3 className="grow__title">{t.title}</h3>
                <span className="grow__meta">
                  Died {fmtDate(t.diedAt)} · lived {fmtSpan(t.livedSeconds)}
                </span>
              </div>
              <span className="grow__stat">
                <b>{t.saves}</b>
                people saved it
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- boards */

export function Boards({ state }: { state: State | null }) {
  const loved = state?.loved ?? [];
  const forgotten = state?.forgotten ?? [];
  return (
    <section className="wrap section" id="boards">
      <div className="section__head">
        <div>
          <span className="label">Two boards</span>
          <h2 className="h2">Most loved &amp; most forgotten</h2>
        </div>
        <p className="section__aside">
          One board counts the money people spent keeping a page alive. The other counts how fast a page died with
          nobody noticing. <b>Arkiv can answer both.</b>
        </p>
      </div>
      <div className="boards">
        <div className="board">
          <h3>Most loved</h3>
          <p>Ranked by extensions paid by strangers.</p>
          {loved.length === 0 ? (
            <p className="board__empty">No extensions paid yet. Every page is currently unloved in the technical sense.</p>
          ) : (
            loved.map((l, i) => (
              <div className="brow" key={l.slug}>
                <span className="brow__n">{String(i + 1).padStart(2, "0")}</span>
                <span className="brow__t">{l.title}</span>
                <span className="brow__v">{l.saves} ×</span>
              </div>
            ))
          )}
        </div>
        <div className="board">
          <h3>Most forgotten</h3>
          <p>Shortest life, fewest people who noticed.</p>
          {forgotten.length === 0 ? (
            <p className="board__empty">Nobody has been forgotten yet. The graveyard is still empty.</p>
          ) : (
            forgotten.map((f, i) => (
              <div className="brow" key={f.slug}>
                <span className="brow__n">{String(i + 1).padStart(2, "0")}</span>
                <span className="brow__t">{f.title}</span>
                <span className="brow__v">{fmtSpan(f.livedSeconds)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- method */

export function Method({ state }: { state: State | null }) {
  const blocksToDays = (n: number) => Math.round(n / 43_200);
  return (
    <section className="wrap section" id="method">
      <div className="section__head">
        <div>
          <span className="label">Method</span>
          <h2 className="h2">A page is an entity with a lease</h2>
        </div>
        <p className="section__aside">
          Arkiv stores queryable, time-scoped entities. The scope is not metadata — it is the record's whole life.
        </p>
      </div>

      <div className="method__grid">
        <div className="mcell">
          <span className="mcell__num">01</span>
          <h3>It is written once</h3>
          <p>
            Each page is one entity with a schema. The prose is bytes, the slug and slot are queryable columns. The
            entity is created <code>readonly</code>, so no operation changes its content for the rest of its life.
          </p>
          <pre className="code">
{`defineSchema("ghost-site-v1", {
  slug: str().indexed(),
  body: bytes(),
  slot: u64().indexed(),
});

flags: { readonly: true }`}
          </pre>
        </div>
        <div className="mcell">
          <span className="mcell__num">02</span>
          <h3>Expiry is the product</h3>
          <p>
            Every entity carries an expiry block. Not a soft flag a job cleans up later — the expiry. Past it, the
            record stops existing. This site just makes the clock visible.
          </p>
          <pre className="code">
{`ExpirationTime.fromDays(7)
// ${num(state?.block ?? 513_103 + 302_400)} + 302,400 blocks`}
          </pre>
        </div>
        <div className="mcell">
          <span className="mcell__num">03</span>
          <h3>Anyone can extend, nobody can own</h3>
          <p>
            Pages are created with <code>permissionlessExtension</code>. A stranger can push the expiry block forward
            without owning the record, and with zero ability to touch what it says.
          </p>
          <pre className="code">
{`extendEntity({ entityKey, expiration })

// +${blocksToDays(Number(2 * 43_200))} days per save
// ${state?.stats.saves ?? 0} saves so far`}
          </pre>
        </div>
      </div>

      <div className="why">
        <div>
          <span className="label">Why this demo</span>
          <h3>Every other website is a lie about permanence.</h3>
        </div>
        <div>
          <p>
            Pages rot silently. Links die. Domains expire. The web pretends otherwise because nothing in the stack
            makes the end visible.
          </p>
          <p>
            Arkiv makes lifetime a first class property of a record, so a website can be built where{" "}
            <b>the countdown is real</b>, deletion is enforced by the database, and keeping something alive is a
            payment anyone can make on someone else's behalf.
          </p>
        </div>
      </div>
    </section>
  );
}
