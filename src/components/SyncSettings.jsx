import React, { useState } from "react";
import { Cloud, Download } from "lucide-react";
import { C, MONO } from "../lib/theme";
import { getAppKey, setAppKey, startAuth, finishAuthWithCode, disconnect, isConnected } from "../sync/dropbox.ts";
import { DATA_BUDGET, FOLDER_BUDGET } from "../sync/archive.ts";

const btn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, cursor: "pointer" };
const solid = { ...btn, background: C.amber, color: C.onAccent, border: "none", fontWeight: 700 };
const input = { width: "100%", boxSizing: "border-box", background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.ink, fontFamily: MONO };

export const ago = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const mb = (n) => (n < 1e6 ? `${Math.round(n / 1000)} KB` : `${(n / 1e6).toFixed(1)} MB`);

/** Dropbox status, connect / disconnect, size meter. */
export default function SyncSettings({ sync, onExportAll }) {
  const [key, setKey] = useState(getAppKey());
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [msg, setMsg] = useState("");
  const connected = isConnected();

  const connect = async (manual) => {
    try {
      if (key.trim() !== getAppKey()) setAppKey(key);
      const url = await startAuth(manual);
      if (manual) {
        window.open(url, "_blank");
        setShowCode(true);
      } else {
        window.location.href = url;
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  const submitCode = async () => {
    try {
      await finishAuthWithCode(code);
      setCode("");
      setShowCode(false);
      sync.refreshConnection();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const u = sync.usage;
  const bar = (used, cap) => (
    <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${Math.min(100, (used / cap) * 100)}%`, height: "100%", background: used / cap >= 0.7 ? C.pr : C.cyan }} />
    </div>
  );

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
        <Cloud size={16} color={connected ? C.good : C.muted} /> Dropbox sync
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 4, overflowWrap: "anywhere" }}>
        {!connected && "Not connected. Your history lives only on this phone."}
        {connected && sync.state === "syncing" && "Syncing…"}
        {connected && sync.state === "idle" && (sync.lastSync ? `Synced ${ago(sync.lastSync)}.` : "Connected.")}
        {connected && sync.state === "offline" && "Offline. Changes will sync when you're back online."}
        {connected && sync.state === "error" && `Sync problem: ${sync.error}`}
      </div>

      {!connected ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {!getAppKey() && <input style={input} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Dropbox app key" />}
          <button style={solid} onClick={() => connect(false)} disabled={!key.trim()}>Connect Dropbox</button>
          {!showCode ? (
            <button style={{ ...btn, border: "none", color: C.muted, fontSize: 12 }} onClick={() => connect(true)}>Sign-in didn't come back? Use a code</button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <input style={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code Dropbox shows" />
              <button style={btn} onClick={submitCode} disabled={!code.trim()}>Finish connecting</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ ...btn, flex: 1 }} onClick={sync.syncNow}>Sync now</button>
          <button style={{ ...btn, flex: 1, color: C.bad }} onClick={() => { disconnect(); sync.refreshConnection(); }}>Disconnect</button>
        </div>
      )}
      {msg && <div style={{ color: C.bad, fontSize: 12, marginTop: 8, overflowWrap: "anywhere" }}>{msg}</div>}

      {connected && u && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>History file</span><span style={{ fontFamily: MONO }}>{mb(u.dataBytes)} / {mb(DATA_BUDGET)}</span></div>
          {bar(u.dataBytes, DATA_BUDGET)}
          {u.folderBytes > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span>Whole Dropbox folder</span><span style={{ fontFamily: MONO }}>{mb(u.folderBytes)} / {mb(FOLDER_BUDGET)}</span></div>
              {bar(u.folderBytes, FOLDER_BUDGET)}
            </>
          )}
          {u.warning && <div style={{ color: C.pr, marginTop: 8 }}>{u.warning}</div>}
          <div style={{ marginTop: 8 }}>Old workouts roll up automatically when the file gets large; full detail stays in Dropbox.</div>
          <button style={{ ...btn, marginTop: 8, width: "100%" }} onClick={onExportAll}><Download size={14} /> Export everything (incl. archive)</button>
        </div>
      )}
    </div>
  );
}
