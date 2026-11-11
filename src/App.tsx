import { useCallback, useEffect, useState } from "react";
import { Footer, Marquee, Nav, Topbar } from "./components/chrome";
import { Boards, Graveyard, Hero, IndexList, Method } from "./components/home";
import { RecordPage } from "./components/record";
import { useGhost, useRoute } from "./lib/useGhost";

type Toast = { text: string; tone?: "ok" | "err" } | null;

function SetupBox({
  issue,
  hasKey,
  alive,
}: {
  issue: { code: string; message: string } | null;
  hasKey: boolean;
  alive: number;
}) {
  if (hasKey && alive > 0) return null;
  return (
    <div className="wrap" style={{ paddingTop: 22 }}>
      <div className="errbox">
        <b>{hasKey ? "Relayer armed, nothing published yet." : "The relayer has no key."}</b>
        <br />
        {issue?.message ?? "Put a funded Rabdi testnet private key in .env, then run npm run seed."}
        <br />
        <br />
        <code>cp .env.example .env</code> → <code>PRIVATE_KEY=0x…</code> → fund it at{" "}
        <a href="https://hub.arkiv.network/faucet" target="_blank" rel="noreferrer">
          hub.arkiv.network/faucet
        </a>{" "}
        → <code>npm run seed</code>
      </div>
    </div>
  );
}

export default function App() {
  const { state, error, reload, liveBlock } = useGhost();
  const { route, navigate } = useRoute();
  const [toast, setToast] = useState<Toast>(null);

  const pushToast = useCallback((t: Toast) => setToast(t), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5_200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (toast?.tone !== "err") reload();
  }, [toast, reload]);

  useEffect(() => {
    document.title =
      route.kind === "record"
        ? `Ghost Site · ${route.slug}`
        : state
          ? `Ghost Site · ${state.stats.alive} alive · ${state.stats.dead} buried`
          : "Ghost Site · an Arkiv experiment";
  }, [route, state]);

  return (
    <>
      <Topbar state={state} liveBlock={liveBlock} />
      <Nav state={state} route={route} navigate={navigate} />

      {route.kind === "home" && (
        <>
          <SetupBox issue={state?.setupIssue ?? null} hasKey={Boolean(state?.hasKey)} alive={state?.stats.alive ?? 0} />
          <Hero state={state} liveBlock={liveBlock} />
          <Marquee state={state} />
          {error && (
            <div className="wrap" style={{ paddingTop: 18 }}>
              <div className="errbox">API unreachable: {error}. Is the server on :8787 running?</div>
            </div>
          )}
          <IndexList state={state} onToast={pushToast} navigate={navigate} />
          <Graveyard state={state} navigate={navigate} />
          <Boards state={state} />
          <Method state={state} />
        </>
      )}

      {route.kind === "graveyard" && (
        <>
          <div className="wrap" style={{ paddingTop: 28 }}>
            <span className="label label--ink">The graveyard</span>
            <h1 className="h2" style={{ marginTop: 10 }}>
              Every record that ran out of time
            </h1>
          </div>
          <Graveyard state={state} navigate={navigate} />
          <Boards state={state} />
        </>
      )}

      {route.kind === "record" && (
        <RecordPage slug={route.slug} liveBlock={liveBlock} onToast={pushToast} navigate={navigate} />
      )}

      <Footer state={state} />

      {toast && (
        <div className={`toast ${toast.tone === "err" ? "toast--err" : ""}`} role="status">
          <b>{toast.tone === "err" ? "Failed" : "Paid"}</b>
          <span>{toast.text}</span>
        </div>
      )}
    </>
  );
}
