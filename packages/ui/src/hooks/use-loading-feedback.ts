import { useEffect, useState } from "react";

/** Visual threshold only. Never delays a lock, result, promise or successful close. */
export function useLoadingFeedback(loading: boolean, delay: number) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!loading || delay === 0) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);
  return loading && (delay === 0 || visible);
}
