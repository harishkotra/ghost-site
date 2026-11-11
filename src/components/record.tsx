import { useEffect, useState } from "react";
import { fetchRecord, fmtClock, fmtDate, fmtSpan, num, pct } from "../lib/core";
import type { RecordPayload, Tomb } from "../lib/core";
import { Decay, KeepButton } from "./home";

type Toast = { text: string; tone?: "ok" | "err" } | null;

const short = (a: string | null | undefined) => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "—");

export function RecordPage({
  slug,
  liveBlock,
  onToast,
  navigate,
}: {
  slug: string;
  liveBlock: number;
  onToast: (t: Toast) => void;
  navigate: (to: string) => void;
}) {
  const [data, setData] = useState<RecordPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);

    async function load() {
      try {
        const next = await fetchRecord(slug);
        if (alive) setData(next);
      } catch (err: any) {
        if (alive) setError(String(err?.message || err));
      }
    }

    load();
    const id = window.setInterval(load, 9_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [slug]);

  if (error) {
    return (
      <div className="wrap section">
        <div className="errbox">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading">
        <span>Reading the entity from the database chain</span>
        <span className="label">{slug}</span>
      </div>
    );
  }

  if (!data.ok) {
    return (
      <div className="wrap section">
        <div className="errbox">{data.error}</div>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn--ghost" onClick={() => navigate("/")} type="button">
            Back to the index
          </button>
        </div>
      </div>
    );
  }

  if (!data.alive) {
    return <Tombstone tomb={data.tomb} navigate={navigate} />;
  }

  const page = data.page;
  const remainingSeconds = Math.max(0, (page.expiresAtBlock - liveBlock) * data.blockSeconds);
  const paras = (page.body || "").split(/\n{2,}/).filter(Boolean);

  return (
    <article className="wrap art">
      <a
        className="crumb"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        ← The index
      </a>
      <div className="art__grid">
        <div>
          <span className="label label--ink">{page.section}</span>
          <h1>{page.title}</h1>
          <p className="art__dek">{page.dek}</p>
          <div className="art__byline">
            <span>
              By <b>{page.author}</b>
            </span>
            <span>·</span>
            <span>
              Written once to <b>ghost-site-v1</b>
            </span>
            <span>·</span>
            <span>
              Entity <b>{short(page.entityKey)}</b>
            </span>
          </div>

          <div className="prose">
            {paras.map((p, i) => {
              if (p.startsWith("> ")) return <blockquote key={i}>{p.replace(/^> /, "")}</blockquote>;
              if (p.startsWith("- ")) {
                return (
                  <ul key={i}>
                    {p.split("\n").map((li, j) => (
                      <li key={j}>{li.replace(/^- /, "")}</li>
                    ))}
                  </ul>
                );
              }
              if (p.startsWith("## ")) return <h2 key={i}>{p.slice(3)}</h2>;
              return <p key={i}>{p}</p>;
            })}
          </div>
        </div>

        <div>
          <div className="clock">
            <div className="clock__head">
              <span className="label">Death clock</span>
              <span className="label">LIVE</span>
            </div>
            <div className="clock__body">
              <span className="clock__time" data-low={remainingSeconds < 86_400 ? "true" : undefined}>
                {fmtClock(remainingSeconds)}
              </span>
              <div className="clock__unit">until the record is deleted</div>
              <Decay
                value={page.decay}
                low={page.decay < 0.25}
                left={`${pct(page.decay)} of its life left`}
                right={`${page.saves} saves`}
              />
              <p className="clock__exp">
                Expiry block <b>{num(page.expiresAtBlock)}</b>
                <br />
                Current block <b>{num(Math.floor(liveBlock))}</b>
                <br />
                Lifetime <b>{fmtSpan(page.lifetimeBlocks * data.blockSeconds)}</b>
              </p>
              <div className="clock__act">
                <KeepButton
                  slug={page.slug}
                  size="md"
                  label="Keep this alive · +2 days"
                  onDone={onToast}
                />
              </div>
              <div className="clock__saves">
                <span>People who paid</span>
                <b>{page.saves}</b>
              </div>
              <p className="clock__note">
                Extensions are paid by this site's relayer, which can add time and nothing else. It cannot edit a
                character. Neither can the author.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="ledger">
        <div className="ledger__head">
          <span className="label label--ink">Ledger of extensions</span>
          <span className="label">{page.history.length} entries shown</span>
        </div>
        {page.history.length === 0 ? (
          <p className="ledger__empty">
            No extension has been paid yet. This record will die at block {num(page.expiresAtBlock)} unless someone
            decides otherwise.
          </p>
        ) : (
          <>
            <div className="lrow lrow--head">
              <span>When</span>
              <span>Transaction</span>
              <span>Added</span>
              <span style={{ textAlign: "right" }}>Blocks</span>
            </div>
            {page.history
              .slice()
              .reverse()
              .map((h) => (
                <div className="lrow" key={h.tx}>
                  <span>{fmtDate(h.at)}</span>
                  <a href={`https://explorer.arkiv.network/tx/${h.tx}`} target="_blank" rel="noreferrer">
                    {h.tx}
                  </a>
                  <span>{fmtSpan(h.blocks * data.blockSeconds)}</span>
                  <span className="lrow__amt">{num(h.blocks)}</span>
                </div>
              ))}
          </>
        )}
      </div>

      <div className="afterword">
        <p>
          <b>Why this page can't be fixed.</b> It was created with the <b>readonly</b> flag, so Arkiv refuses every
          write to its content for the rest of its life. If there is a typo, the typo is the record. The only mutable
          property is whether it keeps existing.
        </p>
      </div>
    </article>
  );
}

function Tombstone({ tomb, navigate }: { tomb: Tomb; navigate: (to: string) => void }) {
  const said = String(tomb.body || "").split(/\n{2,}/).filter(Boolean).slice(0, 2);
  return (
    <div className="tomb">
      <div className="wrap">
        <div className="tomb__grid">
          <div>
            <div className="tomb__cross">†</div>
            <span className="label label--ink">{tomb.section || "Unsectioned"}</span>
            <h1>{tomb.title}</h1>
            <p className="tomb__note">
              This record reached its expiry block and was deleted from Arkiv. What you are reading is this site's
              tombstone: a local note that it existed, what it said at the end, and how many people cared.
            </p>
            {said.length > 0 && (
              <div className="tomb__note" style={{ borderLeft: "1px solid rgba(241,241,246,.2)", paddingLeft: 16 }}>
                {said.map((p: string, i: number) => (
                  <p key={i} style={{ margin: "0 0 10px", textDecoration: "line-through", opacity: 0.75 }}>
                    {p}
                  </p>
                ))}
              </div>
            )}
            <div className="tomb__cta">
              <button className="btn" onClick={() => navigate("/")} type="button">
                Save something else
              </button>
              <button className="btn btn--ghost" style={{ color: "rgba(241,241,246,.8)", borderColor: "rgba(241,241,246,.3)" }} onClick={() => navigate("/graveyard")} type="button">
                The graveyard
              </button>
            </div>
          </div>
          <div className="tomb__cert">
            <span className="label">Certificate of deletion</span>
            <div className="cert-row">
              <span>Born</span>
              <b>{fmtDate(tomb.bornAt)}</b>
            </div>
            <div className="cert-row">
              <span>Died</span>
              <b>{fmtDate(tomb.diedAt)}</b>
            </div>
            <div className="cert-row">
              <span>Lived</span>
              <b>{fmtSpan(tomb.livedSeconds)}</b>
            </div>
            <div className="cert-row">
              <span>Extensions</span>
              <b>{tomb.saves}</b>
            </div>
            <div className="cert-row">
              <span>Last saver</span>
              <b>{short(tomb.lastSaver)}</b>
            </div>
            <div className="cert-row">
              <span>Entity</span>
              <b>{short(tomb.entityKey)}</b>
            </div>
            <div className="cert-row">
              <span>Schema</span>
              <b>ghost-site-v1</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
