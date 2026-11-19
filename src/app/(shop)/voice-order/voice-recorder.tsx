"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Square, RotateCcw } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { createVoiceOrder } from "./actions";

const MAX_SECONDS = 180;

type Addr = { id: string; label: string; area: string; address_line: string; is_default: boolean };

function pickMime(): { mime: string; ext: string } {
  const options = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  for (const o of options) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) return o;
  return { mime: "", ext: "webm" };
}

/** Big, simple recorder: tap to speak your list, listen back, send. */
export function VoiceRecorder({ userId, addresses }: { userId: string; addresses: Addr[] }) {
  const [state, setState] = useState<"idle" | "recording" | "ready" | "sending" | "sent">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? "");
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fmt = useRef(pickMime());
  const url = blob ? URL.createObjectURL(blob) : null;

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const r = new MediaRecorder(stream, fmt.current.mime ? { mimeType: fmt.current.mime } : undefined);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setBlob(new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] }));
        setState("ready");
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Please allow the microphone to record. Or call us instead.");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }

  async function send() {
    if (!blob) return;
    setState("sending");
    setError(null);
    try {
      const type = blob.type || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await createBrowserSupabase()
        .storage.from("voice-orders")
        .upload(path, blob, { contentType: ext === "m4a" ? "audio/mp4" : type });
      if (upErr) throw upErr;
      const res = await createVoiceOrder({ audioPath: path, durationSeconds: seconds, addressId: addressId || null, note });
      if (!res.ok) {
        setError(res.error ?? "Could not send.");
        setState("ready");
        return;
      }
      setState("sent");
    } catch {
      setError("Could not send the recording. Please check your internet and try again.");
      setState("ready");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-6 text-center">
        <p className="text-xl font-bold">Thank you! We got your voice order.</p>
        <p className="text-base">We will listen to it and call you to confirm the items and price.</p>
        <Link href="/" className="mt-2 flex h-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          Back to shop
        </Link>
      </div>
    );
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6">
        {state === "recording" ? (
          <button
            type="button"
            onClick={stop}
            className="flex size-32 items-center justify-center rounded-full bg-destructive text-white shadow-lg"
            aria-label="Stop recording"
          >
            <Square className="size-12" fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={state === "sending"}
            className="flex size-32 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg disabled:opacity-60"
            aria-label={blob ? "Record again" : "Start recording"}
          >
            {blob ? <RotateCcw className="size-12" /> : <Mic className="size-14" />}
          </button>
        )}
        <p className="text-lg font-semibold" aria-live="polite">
          {state === "recording"
            ? `Recording… ${mmss} (tap to stop)`
            : blob
              ? "Listen below, or tap to record again"
              : "Tap the microphone and say your items"}
        </p>
        {state === "recording" && <p className="text-sm text-muted-foreground">Up to 3 minutes</p>}
        {url && state !== "recording" && <audio controls src={url} className="w-full" />}
      </div>

      {addresses.length > 0 ? (
        <label className="flex flex-col gap-1 text-base font-semibold">
          Deliver to
          <select
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            className="h-12 rounded-xl border-2 bg-background px-3 text-base"
          >
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.address_line}, {a.area}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="rounded-xl bg-muted p-3 text-base">
          No saved address yet.{" "}
          <Link href="/account/addresses/new?next=/voice-order" className="font-semibold text-primary">
            Add your address
          </Link>{" "}
          or say it in the recording.
        </p>
      )}

      <label className="flex flex-col gap-1 text-base font-semibold">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. call me after 5 pm"
          className="rounded-xl border-2 bg-background p-3 text-base font-normal"
        />
      </label>

      {error && (
        <p role="alert" className="text-base font-medium text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={!blob || state !== "ready"}
        className="h-14 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send voice order"}
      </button>
    </div>
  );
}
