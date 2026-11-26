import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

export interface SettingsAnchorItem {
  id: string;
  label: React.ReactNode;
  count?: number;
}

export function SettingsAnchorNav({
  items,
  className,
}: {
  items: SettingsAnchorItem[];
  className?: string;
}) {
  return (
    <nav className={cn("admin-settings-nav", className)}>
      {items.map((item) => (
        <a
          className="admin-settings-nav__link"
          href={`#${item.id}`}
          key={item.id}
        >
          <span>{item.label}</span>
          {item.count !== undefined ? (
            <span className="admin-settings-nav__count">{item.count}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

interface SettingsSectionProps
  extends Omit<React.ComponentProps<"section">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  columns?: 1 | 2;
  count?: number;
}

export function SettingsSection({
  title,
  description,
  columns = 2,
  count,
  className,
  children,
  ...props
}: SettingsSectionProps) {
  return (
    <section className={cn("admin-settings-section", className)} {...props}>
      <header className="admin-settings-section__header">
        <div className="min-w-0 flex-1">
          <h2 className="admin-settings-section__title">{title}</h2>
          {description ? (
            <p className="admin-settings-section__description">{description}</p>
          ) : null}
        </div>
        {count !== undefined ? (
          <span aria-hidden="true" className="admin-settings-section__count">
            {count}
          </span>
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
