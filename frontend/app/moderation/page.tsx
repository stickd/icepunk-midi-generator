"use client";
import { useEffect, useState } from "react";
import { TOKEN_KEY } from "@/lib/api";
type Decision = { id: string; target_id: string; status: string; decision_reason: string | null; moderation_action: string; appealed_at: string | null };
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";
export default function ModerationPage() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [message, setMessage] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setMessage("Sign in to view moderation decisions."); return; }
    fetch(api + "/reports/mine", { headers: { Authorization: "Bearer " + token }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); setRows(await response.json()); setMessage(""); })
      .catch(() => { if (!controller.signal.aborted) setMessage("Could not load decisions. Please sign in and try again."); });
    return () => controller.abort();
  }, []);
  async function appeal(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") ?? "").trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const response = await fetch(api + "/reports/" + id + "/appeal", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem(TOKEN_KEY) }, body: JSON.stringify({ text }) });
      if (!response.ok) throw new Error();
      setRows(rows => rows.map(row => row.id === id ? { ...row, status: "REVIEWING", appealed_at: new Date().toISOString() } : row));
      setMessage("Appeal submitted.");
    } catch { setMessage("Appeal could not be submitted. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl p-8 text-ice-primary">
    <h1>Moderation decisions</h1>
    <p role="status">{message}</p>
    {!message && !rows.length && <p>No restrictions to review.</p>}
    {rows.map(row => <section key={row.id} className="my-6 rounded border p-4">
      <h2>Content {row.target_id}</h2><p>{row.moderation_action === "HIDE" ? "Hidden from the community" : "Restriction lifted"} · {row.status}</p>
      <p>{row.decision_reason || "Contact support for the reason for this decision."}</p>{row.moderation_action !== "HIDE" ? <p>You may publish your content again.</p> : row.appealed_at ? <p>Your appeal has been submitted.</p> : <form onSubmit={event => appeal(event, row.id)}>
        <label>Why should this decision be reviewed?<textarea name="text" required maxLength={2000} className="block w-full bg-transparent border p-2" /></label>
        <button disabled={busy} type="submit">Submit appeal</button>
      </form>}
    </section>)}
  </main>;
}
