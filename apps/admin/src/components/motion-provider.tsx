import { useReducedMotion } from "@workspace/ui/hooks/use-reduced-motion";
import { MotionConfig } from "motion/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";

type AdminMotionContextValue = {
  reducedMotion: boolean;
};

const AdminMotionContext = createContext<AdminMotionContextValue | null>(null);

export function MotionProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const value = useMemo(() => ({ reducedMotion }), [reducedMotion]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = reducedMotion ? "reduced" : "full";
    return () => {
      delete root.dataset.motion;
    };
  }, [reducedMotion]);

  return (
    <AdminMotionContext.Provider value={value}>
      <MotionConfig
        reducedMotion={reducedMotion ? "always" : "never"}
        transition={{
          duration: reducedMotion ? 0 : 0.2,
          ease: [0.2, 0, 0, 1],
        }}
      >
        {children}
      </MotionConfig>
    </AdminMotionContext.Provider>
  );
}

export function useAdminMotion() {
  const context = useContext(AdminMotionContext);
  if (!context) {
    throw new Error("useAdminMotion must be used within MotionProvider.");
  }
  return context;
}
