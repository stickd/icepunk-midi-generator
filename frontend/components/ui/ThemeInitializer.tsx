"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    function applyTheme() {
      const theme = localStorage.getItem("icepunk_theme") || "original";
      document.documentElement.setAttribute("data-theme", theme);
    }

    // Apply immediately on mount
    applyTheme();

    // Listen to custom theme change event
    window.addEventListener("icepunk-theme-change", applyTheme);
    
    // Listen to storage events (cross-tab sync)
    window.addEventListener("storage", (e) => {
      if (e.key === "icepunk_theme") {
        applyTheme();
      }
    });

    return () => {
      window.removeEventListener("icepunk-theme-change", applyTheme);
    };
  }, []);

  return null;
}

export default ThemeInitializer;
