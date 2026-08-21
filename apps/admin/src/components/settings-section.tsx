import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

interface SettingsSectionProps
  extends Omit<React.ComponentProps<"section">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  columns?: 1 | 2;
}

export function SettingsSection({
  title,
  description,
  columns = 2,
  className,
  children,
  ...props
}: SettingsSectionProps) {
  return (
    <section className={cn("admin-settings-section", className)} {...props}>
      <header className="admin-settings-section__header">
        <h2 className="admin-settings-section__title">{title}</h2>
        {description ? (
          <p className="admin-settings-section__description">{description}</p>
        ) : null}
      </header>
      <div className="admin-settings-section__grid" data-columns={columns}>
        {children}
      </div>
    </section>
  );
}

export function SettingsItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("admin-settings-item", className)} {...props} />;
}
