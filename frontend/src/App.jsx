import { useEffect, useRef, useState } from "react";
import seed from "./seed.json";
import { setSound as audioSet, toll, wail, setPulse } from "./audio.js";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const KIND = { EBS_VOLUME: "Buried volume", ELASTIC_IP: "Wandering address", STOPPED_EC2: "Sleeping server" };
const VERB = { EBS_VOLUME: "Snapshot and banish", ELASTIC_IP: "Release the spirit", STOPPED_EC2: "Banish" };
const EYES = [
  { l: "5%", t: "34%", d: "3s" }, { l: "91%", t: "52%", d: "13s" }, { l: "10%", t: "80%", d: "22s" },
  { l: "86%", t: "18%", d: "31s" }, { l: "50%", t: "94%", d: "40s" },
];
// AWS bills in USD. Amounts are converted to rupees at a fixed approximate rate for display.
const RATE = Number(import.meta.env.VITE_USD_INR) || 88;
let CUR = "INR"; // set from state at the top of App() so every amount follows the switch
const money = (usd) =>
  CUR === "USD"
    ? usd.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : (usd * RATE).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const rupeeText = (t = "") => t.replace(/\$(\d[\d,]*(?:\.\d+)?)/g, (_, n) => money(Number(n.replace(/,/g, ""))));
const GATE_CSS = `
.gate{position:fixed;inset:0;z-index:30;background:#050506;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:24px}
.gate h1{font-family:"Pirata One","IM Fell English",serif;font-weight:400;font-size:clamp(56px,12vw,120px);line-height:.95;margin:0;color:#eee6d0;text-shadow:0 0 40px rgba(196,20,31,.6);animation:flicker 5s infinite}
.gate h1 span{color:#c4141f}
.gate p{max-width:44ch;font-style:italic;color:#c9c1ad;margin:0;font-size:20px}
.gate .row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:8px}
`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function useTween(target) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let id;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1100);
      const cur = start + (target - start) * (1 - Math.pow(1 - p, 3));
      from.current = cur;
      setV(cur);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return v;
}

export default function App() {
  const [ghosts, setGhosts] = useState([]);
  const [mode, setMode] = useState("demo");
  const [busy, setBusy] = useState(null);
  const [fading, setFading] = useState(null);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState("");
  const [sound, setSoundOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cur, setCur] = useState("INR");
  CUR = cur;
  const [entered, setEntered] = useState(false);

  // The click on the gate is what lets the browser play sound
  function enter(withSound) {
    setEntered(true);
    if (withSound) {
      setSoundOn(true);
      audioSet(true);
    }
  }
  const live = mode === "live" && !!API;

  async function toggleSound() {
    const next = !sound;
    setSoundOn(next);
    await audioSet(next);
  }

  useEffect(() => {
    const move = (e) => {
      const s = document.documentElement.style;
      s.setProperty("--x", e.clientX + "px");
      s.setProperty("--y", e.clientY + "px");
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  async function load() {
    if (!live) return setGhosts(seed.map((g) => ({ ...g })));
    try {
      const r = await fetch(`${API}/findings`);
      if (!r.ok) throw new Error();
      setGhosts((await r.json()).findings);
    } catch {
      setToast("The API is silent. Showing demo spirits instead.");
      setMode("demo");
    }
  }
  useEffect(() => { load(); }, [mode]);

  const haunting = ghosts.filter((g) => g.status === "HAUNTING");
  const banished = ghosts.filter((g) => g.status === "EXORCISED");
  const waste = haunting.reduce((s, g) => s + Number(g.monthly_cost), 0);
  const saved = banished.reduce((s, g) => s + Number(g.monthly_cost), 0);
  const shownWaste = useTween(waste);
  const shownSaved = useTween(saved);

  useEffect(() => {
    const ms = waste > 0 ? Math.max(650, 1400 - waste * 7) : null;
    setPulse(ms);
    document.documentElement.style.setProperty("--beat", (ms || 2600) + "ms");
  }, [waste]);

  async function summon() {
    setScanning(true);
    setToast("");
    try {
      if (live) {
        const r = await fetch(`${API}/scan`, { method: "POST" });
        if (!r.ok) throw new Error("The scanner would not wake.");
        setToast("The scanner is awake. Spirits are arriving…");
        await sleep(8000);
        await load();
        setToast("");
      } else {
        setGhosts([]);
        await sleep(1200);
        for (const g of seed) {
          setGhosts((a) => [...a, { ...g }]);
          await sleep(450);
        }
      }
    } catch (e) {
      setToast(e.message);
    } finally {
      setScanning(false);
    }
  }

  async function exorcise(g) {
    setToast("");
    setBusy({ id: g.id, step: g.type === "EBS_VOLUME" ? "Taking EBS snapshot…" : "Checking the binding…" });
    try {
      if (live) {
        const r = await fetch(`${API}/exorcise/${encodeURIComponent(g.id)}`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "The spirit resists.");
        if (d.status === "DRY_RUN") {
          setToast(d.note);
          return;
        }
      } else {
        await sleep(1000);
      }
      setBusy({ id: g.id, step: "Banishing spirit…" });
      await sleep(500);
      setFading(g.id);
      setFlash(true);
      toll();
      wail();
      await sleep(1100);
      setGhosts((all) => all.map((x) => (x.id === g.id ? { ...x, status: "EXORCISED" } : x)));
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(null);
      setFading(null);
      setFlash(false);
    }
  }

  return (
    <>
      {!entered && (
        <div className="gate" role="dialog" aria-label="Enter Exorcist.exe">
          <style>{GATE_CSS}</style>
          <h1>Exorcist<span>.exe</span></h1>
          <p>Your AWS account is haunted. Headphones recommended: this place has sound.</p>
          <div className="row">
            <button className="rite" autoFocus onClick={() => enter(true)}>Enter, with sound</button>
            <button className="summon" onClick={() => enter(false)}>Enter in silence</button>
          </div>
        </div>
      )}
      <div className="fog" aria-hidden="true" />
      <div className="drips" aria-hidden="true">
        {[7, 19, 33, 52, 68, 81, 93].map((l, i) => <span key={l} style={{ left: l + "%", animationDelay: i * 1.7 + "s" }} />)}
      </div>
      {EYES.map((e, i) => (
        <div key={i} className="eyes" aria-hidden="true" style={{ left: e.l, top: e.t, animationDelay: e.d }}><i /><i /></div>
      ))}
      <div className="pulse" aria-hidden="true" />
      <div className="lantern" aria-hidden="true" />
      <div className={"flash" + (flash ? " on" : "")} aria-hidden="true" />

      <button className="sound" onClick={toggleSound} aria-pressed={sound}>
        {sound ? "Turn sound off" : "Turn sound on"}
      </button>

      <main>
        <header className="hero">
          <h1 data-text="Exorcist.exe">Exorcist<span>.exe</span></h1>
          <p className="lede">Your AWS account is haunted. Dead resources are still billing you. Find them, hear their stories, and send them on.</p>
          <div className="meters">
            <div className="meter bleed">
              <b>{money(shownWaste)}<small> / month</small></b>
              <span>bleeding from your account</span>
            </div>
            <div className="meter rest">
              <b>{money(shownSaved)}<small> / month</small></b>
              <span>laid to rest ({money(shownSaved * 12)} a year)</span>
            </div>
          </div>
        </header>

        <section aria-labelledby="h-haunting">
          <div className="bar">
            <h2 id="h-haunting">{haunting.length} {haunting.length === 1 ? "spirit" : "spirits"} still haunting</h2>
            <div className="mode" role="group" aria-label="Data source">
              <button className={live ? "" : "on"} aria-pressed={!live} onClick={() => setMode("demo")}>
                <i /> Haunted demo realm
              </button>
              <button className={live ? "on live" : ""} aria-pressed={live} disabled={!API} title={API ? "" : "Set VITE_API_URL to connect your AWS account"} onClick={() => setMode("live")}>
                <i /> Live AWS account
              </button>
            </div>
          </div>
          <div className="actions">
            <button className="summon" onClick={summon} disabled={scanning || busy !== null}>
              {scanning ? "Summoning the spirits…" : "Summon spirits now (scan AWS)"}
            </button>
            <div className="mode" role="group" aria-label="Currency">
              <button className={cur === "INR" ? "on" : ""} aria-pressed={cur === "INR"} onClick={() => setCur("INR")}>₹ Rupees</button>
              <button className={cur === "USD" ? "on" : ""} aria-pressed={cur === "USD"} onClick={() => setCur("USD")}>$ Dollars</button>
            </div>
            <p className="toast" role="status" aria-live="polite">{toast}</p>
          </div>

          {haunting.length === 0 && ghosts.length > 0 && (
            <p className="quiet">The house is silent. Nothing is haunting your account.</p>
          )}

          <ul className="ledger">
            {haunting.map((g) => (
              <li key={g.id} className={"ghost" + (fading === g.id ? " banishing" : "")}>
                <div className="body">
                  <h3>{KIND[g.type] || g.type}</h3>
                  <p className="rid">{g.resource_id} <i>{g.details}</i></p>
                  <p className="story">{rupeeText(g.ghost_story)}</p>
                </div>
                <div className="side">
                  <div className="cost">{money(Number(g.monthly_cost))}<small>per month</small></div>
                  <div className={"seal " + g.risk.toLowerCase()} title="Danger of deleting this resource">
                    {g.risk === "HIGH" ? "May hold buried data" : g.risk === "MEDIUM" ? "Check before banishing" : "Safe to banish"}
                  </div>
                  <button className="rite" disabled={busy !== null || scanning} onClick={() => exorcise(g)}>
                    {busy && busy.id === g.id ? busy.step : VERB[g.type] || "Banish"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {banished.length > 0 && (
          <section className="rested" aria-labelledby="h-rest">
            <h2 id="h-rest">Laid to rest</h2>
            <ul>
              {banished.map((g) => (
                <li key={g.id}>
                  <s>{KIND[g.type]} {g.resource_id}</s>
                  <span>{money(Number(g.monthly_cost))} a month, recovered</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer>
          {cur === "INR"
            ? <>Costs are estimates from us-east-1 list prices, shown in rupees at about ₹{RATE} per US dollar. AWS bills in US dollars. </>
            : "Costs are estimates from us-east-1 list prices, in US dollars. "}
          Volumes are snapshotted before deletion.
        </footer>
      </main>
    </>
  );
}
