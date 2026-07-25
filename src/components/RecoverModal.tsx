"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  KeyRound,
  LifeBuoy,
  ClipboardCheck,
  Copy,
  Check,
  Loader2,
  ShieldQuestion,
  Ticket,
  ArrowLeft,
  Search,
  UserSearch,
} from "lucide-react";
import { api } from "@/lib/api";

type Step = "choose" | "find" | "code" | "code-done" | "request" | "request-done" | "status";

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
      <code className="select-all break-all font-mono text-base tracking-wide text-white">{code}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — user can select manually */
          }
        }}
        className="glass-btn shrink-0 px-2.5 py-2"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-[#38d9a9]" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function RecoverModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [ticket, setTicket] = useState("");
  const [q, setQ] = useState({ approxCreated: "", recentExpense: "", recentAmount: "", payerName: "", budget: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [issuedTicket, setIssuedTicket] = useState("");
  const [statusResult, setStatusResult] = useState<string | null>(null);
  // "Find my space" helper state.
  const [findQuery, setFindQuery] = useState("");
  const [findPass, setFindPass] = useState("");
  const [findResults, setFindResults] = useState<string[] | null>(null);
  // Portal target — avoids being trapped by AuthCard's animated (transformed)
  // container, which otherwise breaks `position: fixed` on scroll.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reveal the found spaces once a search returns — they render below the button.
  useEffect(() => {
    if (findResults) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [findResults]);

  useEffect(() => {
    if (!open) {
      setStep("choose");
      setName("");
      setRecoveryCode("");
      setPassphrase("");
      setTicket("");
      setQ({ approxCreated: "", recentExpense: "", recentAmount: "", payerName: "", budget: "", note: "" });
      setLoading(false);
      setError(null);
      setNewCode("");
      setIssuedTicket("");
      setStatusResult(null);
      setFindQuery("");
      setFindPass("");
      setFindResults(null);
    }
  }, [open]);

  function back() {
    setError(null);
    setStep("choose");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.recover(name, recoveryCode, passphrase);
      setNewCode(res.recoveryCode);
      setStep("code-done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.requestReset(name, passphrase, q);
      setIssuedTicket(res.ticket);
      setStep("request-done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitFind(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFindResults(null);
    try {
      const res = await api.findSpace(findQuery, findPass || undefined);
      setFindResults(res.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function pickFoundName(picked: string) {
    setName(picked);
    setError(null);
    setStep("choose");
  }

  async function submitStatus(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatusResult(null);
    try {
      const res = await api.resetStatus(name, ticket);
      setStatusResult(res.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-[max(env(safe-area-inset-top),1rem)]"
          onClick={onClose}
        >
          <div className="glass-strong my-auto w-full max-w-md rounded-3xl p-5 sm:p-7" onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#ff6bd0]">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Recover access</h2>
                  <p className="text-xs text-white/50">Forgot your passphrase?</p>
                </div>
              </div>
              <button onClick={onClose} className="glass-btn px-2.5 py-2.5" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === "choose" && (
              <div className="space-y-3">
                {name && (
                  <p className="rounded-xl border border-[#38d9a9]/25 bg-[#38d9a9]/10 px-3 py-2 text-xs text-white/75">
                    Using space <strong className="text-white">{name}</strong> — now pick how to recover.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setStep("code")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <KeyRound className="h-5 w-5 text-[#38d9a9]" />
                  <span>
                    <span className="block text-sm font-medium">I have my recovery code</span>
                    <span className="block text-xs text-white/50">Reset instantly, no admin needed</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <ShieldQuestion className="h-5 w-5 text-[#ffd43b]" />
                  <span>
                    <span className="block text-sm font-medium">Request an admin reset</span>
                    <span className="block text-xs text-white/50">Answer a few questions to verify it&apos;s you</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep("status")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <Ticket className="h-5 w-5 text-[#7c8cff]" />
                  <span>
                    <span className="block text-sm font-medium">Check a request&apos;s status</span>
                    <span className="block text-xs text-white/50">Use the ticket code you were given</span>
                  </span>
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setStep("find")}
                    className="inline-flex items-center gap-1.5 text-xs text-white/55 underline-offset-2 transition hover:text-white/85 hover:underline"
                  >
                    <UserSearch className="h-3.5 w-3.5" /> Forgot your space name too?
                  </button>
                </div>
              </div>
            )}

            {step === "find" && (
              <form onSubmit={submitFind} className="space-y-3">
                <BackBtn onClick={back} />
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                  Type the first few characters of your space name (at least 4 — letters, numbers, anything). Don&apos;t
                  remember any of it? Enter your full passphrase instead and we&apos;ll find the matching space.
                </p>
                <Field label="First characters of the name" value={findQuery} onChange={setFindQuery} placeholder="e.g. rakt (min 4)" />
                <Field label="…or your passphrase" value={findPass} onChange={setFindPass} placeholder="your full passphrase" type="password" />
                {error && <ErrorBox msg={error} />}
                <SubmitBtn loading={loading} label="Search" />
                {findResults && (
                  <div ref={resultsRef} className="space-y-1.5 pt-1">
                    {findResults.length === 0 ? (
                      <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/60">
                        No matching space found. Try different letters or your exact passphrase.
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] uppercase tracking-wide text-white/40">Matches — tap to use</p>
                        {findResults.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => pickFoundName(m)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm transition hover:bg-white/10"
                          >
                            <span className="truncate font-medium text-white/90">{m}</span>
                            <Search className="h-3.5 w-3.5 shrink-0 text-white/40" />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </form>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} className="space-y-3">
                <BackBtn onClick={back} />
                <Field label="Space name" value={name} onChange={setName} placeholder="Your space name" />
                <Field label="Recovery code" value={recoveryCode} onChange={setRecoveryCode} placeholder="XXXX-XXXX-XXXX-XXXX" mono />
                <Field label="New passphrase" value={passphrase} onChange={setPassphrase} placeholder="min 6 characters" type="password" />
                {error && <ErrorBox msg={error} />}
                <SubmitBtn loading={loading} label="Reset passphrase" />
              </form>
            )}

            {step === "code-done" && (
              <div className="space-y-4">
                <p className="rounded-2xl border border-[#38d9a9]/30 bg-[#38d9a9]/10 px-4 py-3 text-sm text-white/80">
                  <ClipboardCheck className="mb-1 inline h-4 w-4 text-[#38d9a9]" /> Passphrase reset! Unlock your space
                  with your new passphrase.
                </p>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-white/60">Your new recovery code (save it — shown once):</p>
                  <CodeBox code={newCode} />
                </div>
                <button onClick={onClose} className="glass-btn-primary w-full justify-center py-3">
                  Done — back to unlock
                </button>
              </div>
            )}

            {step === "request" && (
              <form onSubmit={submitRequest} className="space-y-3">
                <BackBtn onClick={back} />
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                  An admin verifies these against your real data before approving. Fill what you remember.
                </p>
                <Field label="Space name" value={name} onChange={setName} placeholder="Your space name" />
                <Field label="New passphrase you want" value={passphrase} onChange={setPassphrase} placeholder="min 6 characters" type="password" />
                <Field label="Roughly when did you create it?" value={q.approxCreated} onChange={(v) => setQ({ ...q, approxCreated: v })} placeholder="e.g. July 2026" />
                <Field label="A recent expense title" value={q.recentExpense} onChange={(v) => setQ({ ...q, recentExpense: v })} placeholder="e.g. Petrol" />
                <Field label="A recent amount" value={q.recentAmount} onChange={(v) => setQ({ ...q, recentAmount: v })} placeholder="e.g. 435" />
                <Field label="A payer name you use" value={q.payerName} onChange={(v) => setQ({ ...q, payerName: v })} placeholder="e.g. Rak" />
                <Field label="Monthly budget (if set)" value={q.budget} onChange={(v) => setQ({ ...q, budget: v })} placeholder="e.g. 35000" />
                <Field label="Anything else to prove it's you" value={q.note} onChange={(v) => setQ({ ...q, note: v })} placeholder="optional" />
                {error && <ErrorBox msg={error} />}
                <SubmitBtn loading={loading} label="Submit request" />
              </form>
            )}

            {step === "request-done" && (
              <div className="space-y-4">
                <p className="rounded-2xl border border-[#7c8cff]/30 bg-[#7c8cff]/10 px-4 py-3 text-sm text-white/80">
                  Request submitted. Save this <strong>ticket code</strong> — it&apos;s the only way to check status and it&apos;s
                  shown once. Once an admin approves, unlock with the new passphrase you chose.
                </p>
                <CodeBox code={issuedTicket} />
                <button onClick={() => setStep("status")} className="glass-btn w-full justify-center py-2.5">
                  Check status now
                </button>
                <button onClick={onClose} className="glass-btn-primary w-full justify-center py-3">
                  Done
                </button>
              </div>
            )}

            {step === "status" && (
              <form onSubmit={submitStatus} className="space-y-3">
                <BackBtn onClick={back} />
                <Field label="Space name" value={name} onChange={setName} placeholder="Your space name" />
                <Field label="Ticket code" value={ticket} onChange={setTicket} placeholder="XXXX-XXXX-XXXX" mono />
                {error && <ErrorBox msg={error} />}
                <SubmitBtn loading={loading} label="Check status" />
                {statusResult && <StatusResult status={statusResult} />}
              </form>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ---------- small building blocks ---------- */

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/80">
      <ArrowLeft className="h-3.5 w-3.5" /> Back
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`glass-input text-sm ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <p className="rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-3 py-2 text-sm text-[#ffb3b3]">{msg}</p>;
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading} className="glass-btn-primary w-full justify-center py-3 disabled:opacity-60">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </button>
  );
}

function StatusResult({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: "⏳ Pending — an admin hasn't reviewed it yet. Check back later.", cls: "border-[#ffd43b]/30 bg-[#ffd43b]/10" },
    approved: { text: "✅ Approved! Unlock your space with the new passphrase you chose.", cls: "border-[#38d9a9]/30 bg-[#38d9a9]/10" },
    rejected: { text: "❌ Rejected. Submit a new request with more identifying details.", cls: "border-[#ff6b6b]/30 bg-[#ff6b6b]/10" },
    notfound: { text: "No request found for that space + ticket code.", cls: "border-white/15 bg-white/5" },
  };
  const s = map[status] ?? map.notfound;
  return <p className={`rounded-xl border px-3 py-2 text-sm text-white/80 ${s.cls}`}>{s.text}</p>;
}
