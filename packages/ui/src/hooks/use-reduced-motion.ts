import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getPreference() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(QUERY).matches
    : false;
}

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(getPreference);

  useEffect(() => {
    if (!window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia(QUERY);
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}
