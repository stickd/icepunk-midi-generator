"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { submitContentReport, TOKEN_KEY } from "@/lib/api";
import { useDialogFocus } from "@/hooks/useDialogFocus";

type Props = { targetType: "GENERATED_PACK" | "UPLOAD"; targetId: string | number; isPublic: boolean };
const reasons = ["COPYRIGHT", "ILLEGAL_CONTENT", "HARASSMENT", "SPAM", "OTHER"];

function ReportDialog({ targetType, targetId, onClose }: Omit<Props, "isPublic"> & { onClose: () => void }) {
  const ref = useDialogFocus(onClose);
  const id = useId();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [noticeType, setNoticeType] = useState<"FORMAL_DSA" | "COMMUNITY">("FORMAL_DSA");
  const [reporterName, setReporterName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || state === "success") return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!reason || !goodFaith) { setError("Select a reason and confirm that the report is made in good faith."); setState("error"); return; }
    if (noticeType === "FORMAL_DSA" && (!reporterName.trim() || !contactEmail.trim())) { setError("A formal DSA notice requires your name and contact email."); setState("error"); return; }
    busy.current = true; setState("submitting"); setError("");
    try {
      const response = await submitContentReport({ targetType, targetId: String(targetId), category: reason, description: description.trim() || undefined, noticeType, reporterName: reporterName.trim() || undefined, contactEmail: contactEmail.trim() || undefined, goodFaith }, token);
      if (response.status !== 202) {
        throw new Error(response.status === 401 ? "Please log in to submit a report." : response.status === 429 ? "Too many reports. Please try again later." : response.status === 400 ? "Please check the reason and description." : "Unable to submit report. Please try again.");
      }
      const payload = await response.json() as { reportId: string }; setReceipt(payload.reportId); setState("success");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to submit report. Please try again."); setState("error"); }
    finally { busy.current = false; }
  }
  return createPortal(<div ref={element => { ref.current = element; }} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-xl">
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1420] p-6 text-ice-primary">
      <div className="flex justify-between"><h2 id={id}>Report content</h2><button type="button" onClick={onClose} aria-label="Close report">✕</button></div>
      {state === "success" ? <p role="status" className="mt-4">Report submitted. Reference: {receipt}{contactEmail.trim() ? " A confirmation was sent to your contact email." : " Keep this reference if you contact us about the report."}</p> : <form onSubmit={submit} className="mt-4 grid gap-4">
        <label>Reason<select required value={reason} onChange={event => setReason(event.target.value)} className="block w-full rounded border border-white/20 bg-[#0c1420] p-2"><option value="">Select a reason</option>{reasons.map(reason => <option key={reason} value={reason}>{reason.replaceAll("_", " ")}</option>)}</select></label>
        <label>Description (optional)<textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} className="block w-full rounded border border-white/20 bg-transparent p-2" /></label>
        <label className="flex gap-2"><input type="checkbox" checked={noticeType === "COMMUNITY"} onChange={event => setNoticeType(event.target.checked ? "COMMUNITY" : "FORMAL_DSA")} />Submit anonymously as a community report</label>
        {noticeType === "FORMAL_DSA" && <p className="text-sm text-ice-secondary">A formal DSA notice needs your name and contact email so we can confirm receipt and notify you of the decision.</p>}
        <label>Name{noticeType === "FORMAL_DSA" ? "" : " (optional)"}<input required={noticeType === "FORMAL_DSA"} maxLength={160} value={reporterName} onChange={event => setReporterName(event.target.value)} className="block w-full rounded border border-white/20 bg-transparent p-2" /></label>
        <label>Contact email{noticeType === "FORMAL_DSA" ? "" : " (optional)"}<input required={noticeType === "FORMAL_DSA"} type="email" maxLength={320} value={contactEmail} onChange={event => setContactEmail(event.target.value)} className="block w-full rounded border border-white/20 bg-transparent p-2" /></label>
        <label className="flex gap-2"><input required type="checkbox" checked={goodFaith} onChange={event => setGoodFaith(event.target.checked)} />I confirm in good faith that the information in this report is accurate and complete.</label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={state === "submitting"} className="rounded border border-white/20 p-2">{state === "submitting" ? "Submitting…" : "Submit report"}</button>
      </form>}
    </section>
  </div>, document.body);
}

export default function ReportAction(props: Props) {
  const [open, setOpen] = useState(false);
  if (!props.isPublic) return null;
  return <><button type="button" onClick={() => setOpen(true)}>Report</button>{open && <ReportDialog {...props} onClose={() => setOpen(false)} />}</>;
}
