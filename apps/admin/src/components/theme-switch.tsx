import { ThemeSwitch } from "@workspace/ui/composed/theme-switch";
import { useAdminThemeTransition } from "./theme-transition-provider";

export function AdminThemeSwitch() {
  return <ThemeSwitch onThemeSelect={useAdminThemeTransition()} />;
}
