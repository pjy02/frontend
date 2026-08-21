import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

interface PageHeaderProps
  extends Omit<React.ComponentProps<"header">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("admin-page-header", className)} {...props}>
      <div className="admin-page-header__copy">
        {eyebrow ? (
          <div className="admin-page-header__eyebrow">{eyebrow}</div>
        ) : null}
        <h1 className="admin-page-header__title">{title}</h1>
        {description ? (
          <p className="admin-page-header__description">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="admin-page-header__actions">{actions}</div>
      ) : null}
    </header>
  );
}
