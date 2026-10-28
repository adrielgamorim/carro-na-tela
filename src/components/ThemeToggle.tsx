import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import "./ThemeToggle.css";

// Light or dark theme. Until the user picks one, the page follows the system;
// a pick is kept in localStorage and applied as data-theme on <html> (also by
// index.html, before the first paint). The colors are light-dark() tokens in
// src/index.css, so the attribute is all the CSS needs.

type Theme = "light" | "dark";

const storageKey = "carro-na-tela:tema";
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const pageColors: Record<Theme, string> = { light: "#f1f4f1", dark: "#111714" };

function chosenTheme(): Theme | null {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // The browser's bar color follows the chosen theme, not the system's.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = pageColors[theme];
  }
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Storage may be blocked; the theme still applies for this visit.
  }
}

/** Button in the top bar that switches between the light and dark themes. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => chosenTheme() ?? (systemDark() ? "dark" : "light"));

  // Without a pick, follow the system when it changes.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!chosenTheme()) setTheme(query.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Usar tema escuro" : "Usar tema claro";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
