import { useCallback, useEffect, useRef, useState } from "react";
import { fetchState, type State } from "./core";

export function useGhost() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await fetchState();
      setState(next);
      setError(null);
      setFetchedAt(Date.now());
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const poll = window.setInterval(load, 6_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load]);

  /** Block height is the only honest clock here: chain advances, wall clock drifts. */
  const liveBlock = state
    ? state.block + Math.max(0, (now - fetchedAt) / 1000) / state.blockSeconds
    : 0;

  return { state, error, reload: load, liveBlock };
}

export type Route =
  | { kind: "home" }
  | { kind: "record"; slug: string }
  | { kind: "graveyard" };

function parse(pathname: string): Route {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/graveyard") return { kind: "graveyard" };
  const m = p.match(/^\/p\/([^/]+)$/);
  if (m) return { kind: "record", slug: decodeURIComponent(m[1]) };
  return { kind: "home" };
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (to === window.location.pathname) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (opts?.replace) window.history.replaceState({}, "", to);
    else window.history.pushState({}, "", to);
    setRoute(parse(to));
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (route.kind === "home" && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) el.scrollIntoView({ block: "start" });
    }
  }, [route]);

  return { route, navigate };
}
