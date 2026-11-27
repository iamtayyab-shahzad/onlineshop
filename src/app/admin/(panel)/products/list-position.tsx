"use client";

import { useEffect } from "react";

const KEY = "admin-products-last-opened";

/**
 * Brings the admin back to the product they opened, instead of the top of the list.
 * Links marked `data-remember="<product id>"` save that id when tapped; when the list shows
 * again (← Back or the browser's back button), it scrolls to that row and highlights it briefly.
 */
export function ListPosition() {
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      // storage blocked: the list simply opens at the top
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = id
      ? requestAnimationFrame(() => {
          const row = document.getElementById(`p-${id}`);
          if (!row) return;
          row.scrollIntoView({ block: "center" });
          row.classList.add("bg-primary/10");
          timer = setTimeout(() => row.classList.remove("bg-primary/10"), 2500);
        })
      : 0;

    const remember = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("[data-remember]");
      const value = link?.getAttribute("data-remember");
      if (!value) return;
      try {
        sessionStorage.setItem(KEY, value);
      } catch {
        // ignore
      }
    };
    document.addEventListener("click", remember, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener("click", remember, true);
    };
  }, []);
  return null;
}
