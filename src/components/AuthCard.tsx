"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Lock, Sparkles, User, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Mode = "unlock" | "create";

export default function AuthCard({ onAuthed }: { onAuthed: (name: string) => void }) {
  const [mode, setMode] = useState<Mode>("unlock");
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === "create"
          ? await api.register(name, passphrase)
          : await api.login(name, passphrase);
      onAuthed(res.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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
            placeholder="Space name (e.g. Raktim & Sagorica)"
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

      <p className="mt-5 text-center text-xs text-white/45">
        Your passphrase is hashed and never stored in plain text. Keep it safe —
        it is the only way back into your space.
      </p>
    </motion.div>
  );
}
