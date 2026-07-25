"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Lock, Sparkles, User, Eye, EyeOff, Copy, Check, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import RecoverModal from "./RecoverModal";

type Mode = "unlock" | "create";

export default function AuthCard({ onAuthed }: { onAuthed: (name: string) => void }) {
  const [mode, setMode] = useState<Mode>("unlock");
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  // After a successful sign-up we show the one-time recovery code before
  // entering the space, so the owner can save it.
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        const res = await api.register(name, passphrase);
        setCreated({ name: res.name, code: res.recoveryCode });
      } else {
        const res = await api.login(name, passphrase);
        onAuthed(res.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // One-time recovery-code screen shown right after creating a space.
  if (created) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-strong w-full max-w-md rounded-4xl p-7 sm:p-8"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#38d9a9] to-[#7c8cff] shadow-glow">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Save your recovery code</h2>
            <p className="text-sm text-white/60">Space “{created.name}” is ready.</p>
          </div>
        </div>

        <p className="mb-3 rounded-2xl border border-[#ffd43b]/30 bg-[#ffd43b]/10 px-4 py-3 text-sm text-white/80">
          This is the <strong>only</strong> way to reset your passphrase yourself if you forget it.
          It&apos;s shown <strong>once</strong> and stored only as a hash — save it somewhere safe now.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
          <code className="select-all break-all font-mono text-base tracking-wide text-white">{created.code}</code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(created.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked — user can select manually */
              }
            }}
            className="glass-btn shrink-0 px-2.5 py-2"
            aria-label="Copy recovery code"
          >
            {copied ? <Check className="h-4 w-4 text-[#38d9a9]" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <button
          onClick={() => onAuthed(created.name)}
          className="glass-btn-primary mt-5 w-full justify-center py-3"
        >
          I&apos;ve saved it — continue
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-strong w-full max-w-md rounded-4xl p-7 sm:p-8"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#ff6bd0] shadow-glow">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Create your space" : "Unlock your space"}
          </h2>
          <p className="text-sm text-white/60">
            {mode === "create"
              ? "Pick a name & passphrase to keep your expenses private."
              : "Enter your space name & passphrase to continue."}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
        {(["unlock", "create"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "rounded-xl py-2 text-sm font-medium transition",
              mode === m ? "bg-white/20 text-white shadow-glass-sm" : "text-white/60 hover:text-white"
            )}
          >
            {m === "unlock" ? "Unlock" : "Create new"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className="glass-input pl-11"
            placeholder="Space name (e.g. Raktim's Space)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className="glass-input pl-11 pr-11"
            type={show ? "text" : "password"}
            placeholder="Passphrase (min 6 characters)"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/50 hover:text-white"
            aria-label={show ? "Hide passphrase" : "Show passphrase"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-sm text-red-100">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="glass-btn-primary w-full">
          <Sparkles className="h-4 w-4" />
          {loading
            ? "Please wait…"
            : mode === "create"
              ? "Create & continue"
              : "Unlock"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setRecoverOpen(true)}
          className="text-xs text-white/55 underline-offset-2 transition hover:text-white/85 hover:underline"
        >
          Forgot your passphrase?
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-white/45">
        Your passphrase is hashed and never stored in plain text. At sign-up you
        also get a one-time recovery code — keep it safe.
      </p>

      <RecoverModal open={recoverOpen} onClose={() => setRecoverOpen(false)} />
    </motion.div>
  );
}
