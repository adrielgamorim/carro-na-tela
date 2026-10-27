import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import "./ShareLinkButton.css";

/** Copies the current URL, which carries the consultation (services/consultaUrl.ts). */
export function ShareLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button type="button" className="share-link" onClick={copy} aria-live="polite">
      {state === "copied" ? <Check size={13} /> : <Link2 size={13} />}
      {state === "copied"
        ? "Link copiado"
        : state === "failed"
          ? "Copie o endereço da página"
          : "Copiar link da consulta"}
    </button>
  );
}
