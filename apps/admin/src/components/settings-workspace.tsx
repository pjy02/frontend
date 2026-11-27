"use client";

import { useRouter } from "@tanstack/react-router";
import { Icon } from "@workspace/ui/composed/icon";
import { cn } from "@workspace/ui/lib/utils";
import {
  type ComponentProps,
  type ComponentType,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  WorkspaceDialog,
  WorkspaceDialogClose,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";

type OpenChangeHandler = (open: boolean) => unknown;

export interface SettingsWorkspaceNavItem {
  id: string;
  title: string;
  description?: string;
  icon: string;
  component: ComponentType;
}

export interface SettingsWorkspaceGroup {
  id: string;
  title: string;
  description?: string;
  items: SettingsWorkspaceNavItem[];
}

interface SettingsWorkspaceContextValue {
  activeItem: SettingsWorkspaceNavItem | null;
  registerHandlers: (open: boolean, handler: OpenChangeHandler) => void;
  clearHandlers: () => void;
  consumePendingSwitch: () => boolean;
}

const SettingsWorkspaceContext =
  createContext<SettingsWorkspaceContextValue | null>(null);

function readUrlTab(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("tab");
}

function writeUrlTab(id: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("tab") === id) return;
  url.searchParams.set("tab", id);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

export function SettingsWorkspaceShell({
  groups,
  defaultId,
  directoryLabel = "Settings directory",
  className,
}: {
  groups: SettingsWorkspaceGroup[];
  defaultId?: string;
  directoryLabel?: string;
  className?: string;
}) {
  const router = useRouter({ warn: false });
  const allItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );
  const validIds = useMemo(
    () => new Set(allItems.map((item) => item.id)),
    [allItems]
  );
  const fallbackId =
    defaultId && validIds.has(defaultId) ? defaultId : (allItems[0]?.id ?? "");

  const [activeId, setActiveId] = useState<string>(() => {
    const initial = readUrlTab();
    return initial && validIds.has(initial) ? initial : fallbackId;
  });

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const activeOpenRef = useRef(false);
  const activeCloseRef = useRef<OpenChangeHandler | null>(null);
  const pendingSwitchRef = useRef<string | null>(null);
  const switchTimerRef = useRef<number | null>(null);

  const clearSwitchTimer = useCallback(() => {
    if (switchTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearSwitchTimer, [clearSwitchTimer]);

  const commitActiveId = useCallback((nextId: string) => {
    activeIdRef.current = nextId;
    setActiveId(nextId);
    writeUrlTab(nextId);
  }, []);

  const registerHandlers = useCallback(
    (open: boolean, handler: OpenChangeHandler) => {
      activeOpenRef.current = open;
      activeCloseRef.current = handler;
    },
    []
  );

  const clearHandlers = useCallback(() => {
    activeOpenRef.current = false;
    activeCloseRef.current = null;
  }, []);

  const consumePendingSwitch = useCallback(() => {
    const nextId = pendingSwitchRef.current;
    if (!nextId) return false;
    pendingSwitchRef.current = null;
    clearSwitchTimer();
    commitActiveId(nextId);
    return true;
  }, [clearSwitchTimer, commitActiveId]);

  const requestSelect = useCallback(
    async (nextId: string) => {
      if (!validIds.has(nextId) || nextId === activeIdRef.current) return;
      const closeHandler = activeCloseRef.current;
      if (!(closeHandler && activeOpenRef.current)) {
        pendingSwitchRef.current = null;
        commitActiveId(nextId);
        return;
      }

      pendingSwitchRef.current = nextId;
      clearSwitchTimer();
      await closeHandler(false);

      if (typeof window !== "undefined") {
        switchTimerRef.current = window.setTimeout(() => {
          switchTimerRef.current = null;
          if (pendingSwitchRef.current === nextId && activeOpenRef.current) {
            pendingSwitchRef.current = null;
            writeUrlTab(activeIdRef.current);
          }
        }, 60);
      }
    },
    [clearSwitchTimer, commitActiveId, validIds]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromUrl = () => {
      const nextTab = readUrlTab();
      if (nextTab && validIds.has(nextTab) && nextTab !== activeIdRef.current) {
        requestSelect(nextTab);
      }
    };
    window.addEventListener("popstate", syncFromUrl);
    const unsubscribe = router?.subscribe?.("onResolved", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      unsubscribe?.();
    };
  }, [requestSelect, router, validIds]);

  const activeItem =
    allItems.find((item) => item.id === activeId) ??
    allItems.find((item) => item.id === fallbackId) ??
    allItems[0] ??
    null;

  const contextValue = useMemo<SettingsWorkspaceContextValue>(
    () => ({
      activeItem,
      registerHandlers,
      clearHandlers,
      consumePendingSwitch,
    }),
    [activeItem, registerHandlers, clearHandlers, consumePendingSwitch]
  );

  const ActiveComponent = activeItem?.component;

  return (
    <SettingsWorkspaceContext.Provider value={contextValue}>
      <div className={cn("admin-settings-workspace", className)}>
        <nav aria-label={directoryLabel} className="admin-settings-sidebar">
          {groups.map((group) => (
            <div className="admin-settings-sidebar__group" key={group.id}>
              <div className="admin-settings-sidebar__group-label">
                {group.title}
              </div>
              <div className="admin-settings-sidebar__list">
                {group.items.map((item) => {
                  const isActive = activeItem?.id === item.id;
                  return (
                    <button
                      aria-current={isActive ? "page" : undefined}
                      className="admin-settings-sidebar__item"
                      data-active={isActive ? "true" : undefined}
                      key={item.id}
                      onClick={() => {
                        requestSelect(item.id);
                      }}
                      type="button"
                    >
                      <Icon
                        className="admin-settings-sidebar__icon"
                        icon={item.icon}
                      />
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="admin-settings-workspace__content">
          {ActiveComponent ? <ActiveComponent key={activeItem.id} /> : null}
        </div>
      </div>
    </SettingsWorkspaceContext.Provider>
  );
}

function InlineSheet({
  open = false,
  onOpenChange,
  children,
}: ComponentProps<typeof WorkspaceDialog>) {
  const inline = useContext(SettingsWorkspaceContext);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!inline) return;
    return () => {
      inline.clearHandlers();
    };
  }, [inline]);

  useEffect(() => {
    if (!inline) return;
    inline.registerHandlers(Boolean(open), (next) =>
      onOpenChangeRef.current?.(next)
    );
  }, [inline, open]);

  useEffect(() => {
    if (!inline || open) return;
    if (inline.consumePendingSwitch()) return;
    onOpenChangeRef.current?.(true);
  }, [inline, open]);

  return <>{children}</>;
}

export function Sheet(props: ComponentProps<typeof WorkspaceDialog>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return <InlineSheet {...props} />;
  }
  return <WorkspaceDialog {...props} />;
}

export function SheetTrigger(
  props: ComponentProps<typeof WorkspaceDialogTrigger>
) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return null;
  }
  return <WorkspaceDialogTrigger {...props} />;
}

export function SheetClose({
  children,
  ...props
}: ComponentProps<typeof WorkspaceDialogClose>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return <>{children}</>;
  }
  return <WorkspaceDialogClose {...props}>{children}</WorkspaceDialogClose>;
}

export function SheetContent({
  className,
  children,
  size,
  showCloseButton: _showCloseButton,
  onOpenAutoFocus: _onOpenAutoFocus,
  onCloseAutoFocus: _onCloseAutoFocus,
  onEscapeKeyDown: _onEscapeKeyDown,
  onPointerDownOutside: _onPointerDownOutside,
  onInteractOutside: _onInteractOutside,
  ...props
}: ComponentProps<typeof WorkspaceDialogContent>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return (
      <div
        className={cn("admin-settings-pane", className)}
        data-slot="settings-inline-pane"
        {...props}
      >
        {children}
      </div>
    );
  }
  return (
    <WorkspaceDialogContent className={className} size={size} {...props}>
      {children}
    </WorkspaceDialogContent>
  );
}

export function SheetHeader({
  className,
  children,
  ...props
}: ComponentProps<typeof WorkspaceDialogHeader>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return (
      <header
        className={cn("admin-settings-pane__header", className)}
        {...props}
      >
        {children}
        {inline.activeItem?.description ? (
          <p className="admin-settings-pane__description">
            {inline.activeItem.description}
          </p>
        ) : null}
      </header>
    );
  }
  return (
    <WorkspaceDialogHeader className={className} {...props}>
      {children}
    </WorkspaceDialogHeader>
  );
}

export function SheetTitle({
  className,
  children,
  asChild: _asChild,
  ...props
}: ComponentProps<typeof WorkspaceDialogTitle>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return (
      <h2 className={cn("admin-settings-pane__title", className)} {...props}>
        {children}
      </h2>
    );
  }
  return (
    <WorkspaceDialogTitle className={className} {...props}>
      {children}
    </WorkspaceDialogTitle>
  );
}

export function SheetDescription({
  className,
  children,
  asChild: _asChild,
  ...props
}: ComponentProps<typeof WorkspaceDialogDescription>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    if (className?.includes("sr-only")) {
      return null;
    }
    return (
      <p
        className={cn("admin-settings-pane__description", className)}
        {...props}
      >
        {children}
      </p>
    );
  }
  return (
    <WorkspaceDialogDescription className={className} {...props}>
      {children}
    </WorkspaceDialogDescription>
  );
}

export function SheetFooter({
  className,
  children,
  ...props
}: ComponentProps<typeof WorkspaceDialogFooter>) {
  const inline = useContext(SettingsWorkspaceContext);
  if (inline) {
    return (
      <footer
        className={cn("admin-settings-pane__footer", className)}
        {...props}
      >
        {children}
      </footer>
    );
  }
  return (
    <WorkspaceDialogFooter className={className} {...props}>
      {children}
    </WorkspaceDialogFooter>
  );
}
