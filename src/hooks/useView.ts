import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { readView, viewUrl } from "../services/router";
import type { View } from "../services/router";

/**
 * The current view, kept in the URL (services/router.ts): `navigate` pushes a
 * history entry, the browser's back and forward buttons switch views, and
 * `viewLink` gives links that work with a plain click and with ctrl/middle
 * click (new tab).
 */
export function useView() {
  const [view, setView] = useState<View>(() => readView(window.location.search));

  useEffect(() => {
    const handlePopState = () => setView(readView(window.location.search));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextView: View, anchor?: string) {
    const url = viewUrl(window.location.href, nextView, anchor);
    if (nextView !== view || anchor) window.history.pushState(null, "", url);
    setView(nextView);
    window.setTimeout(() => {
      if (anchor) document.getElementById(anchor)?.scrollIntoView();
      else window.scrollTo({ top: 0 });
    });
  }

  function viewLink(nextView: View, anchor?: string) {
    const url = viewUrl(window.location.href, nextView, anchor);
    return {
      href: `${url.pathname}${url.search}${url.hash}`,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(nextView, anchor);
      },
    };
  }

  return { view, navigate, viewLink };
}
