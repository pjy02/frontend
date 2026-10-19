import { Slot } from "@radix-ui/react-slot";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { handoffOverlayFocus } from "@workspace/ui/hooks/use-overlay-focus";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAdminMotion } from "./motion-provider";

type MenuMode = "desktop" | "mobile";

type AdminActionMenuContextValue = {
  backLabel: string;
  close: () => void;
  mode: MenuMode;
  open: boolean;
  mobileDirection: 1 | -1;
  mobilePath: string[];
  setMobilePath: (path: string[]) => void;
  triggerRef: RefObject<HTMLElement | null>;
  rememberMobileScroll: RefObject<(() => void) | null>;
};

const AdminActionMenuContext =
  createContext<AdminActionMenuContextValue | null>(null);
const AdminActionMenuLevelContext = createContext<string[]>([]);

function useAdminActionMenuContext() {
  const context = useContext(AdminActionMenuContext);
  if (!context) {
    throw new Error(
      "Admin action menu primitives must be used within AdminActionMenu."
    );
  }
  return context;
}

function pathsEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

function pathStartsWith(path: string[], prefix: string[]) {
  return (
    path.length >= prefix.length &&
    prefix.every((segment, index) => segment === path[index])
  );
}

type AdminActionMenuProps = {
  backLabel?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: ReactNode;
  modal?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: ReactNode;
  trigger: ReactElement;
};

function AdminActionMenu({
  backLabel = "Back",
  children,
  className,
  defaultOpen = false,
  description,
  modal = false,
  onOpenChange,
  open: controlledOpen,
  title,
  trigger,
}: AdminActionMenuProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [mobileDirection, setMobileDirection] = useState<1 | -1>(1);
  const [mobilePath, setMobilePath] = useState<string[]>([]);
  const open = controlledOpen ?? internalOpen;
  const mode: MenuMode = isMobile ? "mobile" : "desktop";
  const triggerRef = useRef<HTMLElement>(null);
  const rememberMobileScroll = useRef<(() => void) | null>(null);

  const updateMobilePath = (nextPath: string[]) => {
    // Capture before React replaces the level and the browser clamps scrollTop.
    rememberMobileScroll.current?.();
    setMobileDirection(nextPath.length >= mobilePath.length ? 1 : -1);
    setMobilePath(nextPath);
  };

  const updateOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
      if (nextOpen) {
        setMobilePath([]);
        setMobileDirection(1);
      }
    },
    [controlledOpen, onOpenChange]
  );

  useEffect(() => {
    if (open) {
      setMobilePath([]);
    }
  }, [open]);

  const context = useMemo(
    () => ({
      backLabel,
      close: () => updateOpen(false),
      mode,
      open,
      mobileDirection,
      mobilePath,
      setMobilePath: updateMobilePath,
      triggerRef,
      rememberMobileScroll,
    }),
    [backLabel, mode, mobileDirection, mobilePath, open, updateOpen]
  );

  if (mode === "mobile") {
    return (
      <AdminActionMenuContext.Provider value={context}>
        <AdminActionMenuLevelContext.Provider value={[]}>
          <Drawer onOpenChange={updateOpen} open={open}>
            <AdminActionMenuTrigger>{trigger}</AdminActionMenuTrigger>
            <AdminMobileActionPanel
              className={className}
              description={description}
              title={title}
            >
              {children}
            </AdminMobileActionPanel>
          </Drawer>
        </AdminActionMenuLevelContext.Provider>
      </AdminActionMenuContext.Provider>
    );
  }

  return (
    <AdminActionMenuContext.Provider value={context}>
      <AdminActionMenuLevelContext.Provider value={[]}>
        <DropdownMenu modal={modal} onOpenChange={updateOpen} open={open}>
          <AdminActionMenuTrigger>{trigger}</AdminActionMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "admin-action-menu-content w-max min-w-40 max-w-[220px] rounded-[10px] p-1.5",
              className
            )}
            collisionPadding={8}
            data-admin-action-menu-level="root"
            onCloseAutoFocus={keepDialogFocus}
          >
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </AdminActionMenuLevelContext.Provider>
    </AdminActionMenuContext.Provider>
  );
}

function AdminActionMenuTrigger({ children }: { children: ReactElement }) {
  const { mode, triggerRef } = useAdminActionMenuContext();
  const trigger = <Slot ref={triggerRef}>{children}</Slot>;
  return mode === "mobile" ? (
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
  ) : (
    <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
  );
}

type AdminMobileActionPanelProps = {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
};

function AdminMobileActionPanel({
  children,
  className,
  description,
  title,
}: AdminMobileActionPanelProps) {
  const { reducedMotion, presets } = useAdminMotion();
  const mobileMenuLevelVariants = {
    animate: { opacity: 1, x: 0 },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction * -presets.menuExit.distance,
    }),
    initial: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction * presets.menuLevel.distance,
    }),
  };
  const context = useAdminActionMenuContext();
  const { mobileDirection, mobilePath, open } = context;
  const pathKey = mobilePath.join("/") || "root";
  const panelRef = useRef<HTMLDivElement>(null);
  const previousPath = useRef(mobilePath);
  const scrollPositions = useRef(new Map<string, number>());
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const remember = () => {
      if (panelRef.current)
        scrollPositions.current.set(pathKey, panelRef.current.scrollTop);
    };
    context.rememberMobileScroll.current = remember;
    return () => {
      context.rememberMobileScroll.current = null;
    };
  }, [context.rememberMobileScroll, pathKey]);

  useLayoutEffect(() => {
    if (!open) return;
    const level = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        "[data-admin-action-menu-current-level]"
      ) ?? []
    ).find(
      (element) => element.dataset.adminActionMenuCurrentLevel === pathKey
    );
    if (!level) return;
    const measure = () => setHeight(level.offsetHeight);
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(level);
    const panel = panelRef.current;
    if (panel) panel.scrollTop = scrollPositions.current.get(pathKey) ?? 0;
    return () => {
      observer?.disconnect();
    };
  }, [pathKey, open]);

  useEffect(() => {
    if (!open) {
      previousPath.current = [];
      scrollPositions.current.clear();
      return;
    }
    const returningTo =
      previousPath.current.length > mobilePath.length
        ? previousPath.current.slice(0, mobilePath.length + 1).join("/")
        : null;
    previousPath.current = mobilePath;
    const frame = window.requestAnimationFrame(() => {
      const selector =
        mobilePath.length > 0
          ? "[data-admin-action-menu-back]"
          : "[data-admin-action-menu-control]";
      const currentLevel = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          "[data-admin-action-menu-current-level]"
        ) ?? []
      ).find((level) => level.dataset.adminActionMenuCurrentLevel === pathKey);
      const returnedTrigger = returningTo
        ? Array.from(
            currentLevel?.querySelectorAll<HTMLElement>(
              "[data-admin-action-menu-sub-id]"
            ) ?? []
          ).find(
            (element) => element.dataset.adminActionMenuSubId === returningTo
          )
        : null;
      (
        returnedTrigger ?? currentLevel?.querySelector<HTMLElement>(selector)
      )?.focus({
        preventScroll: true,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobilePath.length, pathKey, open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && mobilePath.length === 0) {
      event.preventDefault();
      event.stopPropagation();
      context.close();
      return;
    }
    if (
      (event.key === "Escape" || event.key === "ArrowLeft") &&
      mobilePath.length > 0
    ) {
      event.preventDefault();
      event.stopPropagation();
      context.setMobilePath(mobilePath.slice(0, -1));
      return;
    }

    if (event.key === "ArrowRight") {
      const subTrigger = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-admin-action-menu-sub-trigger]"
      );
      if (subTrigger) {
        event.preventDefault();
        subTrigger.click();
      }
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    const currentLevel = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        "[data-admin-action-menu-current-level]"
      ) ?? []
    ).find(
      (element) => element.dataset.adminActionMenuCurrentLevel === pathKey
    );
    const controls = Array.from(
      currentLevel?.querySelectorAll<HTMLElement>(
        "[data-admin-action-menu-control]:not([disabled]):not([data-disabled=true])"
      ) ?? []
    );
    if (controls.length === 0) return;

    event.preventDefault();
    const currentIndex = controls.indexOf(
      document.activeElement as HTMLElement
    );
    let nextIndex = 0;
    if (event.key === "End") {
      nextIndex = controls.length - 1;
    } else if (event.key === "ArrowUp") {
      nextIndex = currentIndex <= 0 ? controls.length - 1 : currentIndex - 1;
    } else if (event.key === "ArrowDown") {
      nextIndex = currentIndex >= controls.length - 1 ? 0 : currentIndex + 1;
    }

    controls[nextIndex]?.focus({ preventScroll: true });
    controls[nextIndex]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <DrawerContent
      aria-hidden={!open || undefined}
      className={cn(
        "admin-action-menu-mobile max-h-[min(80dvh,40rem)] overflow-hidden rounded-t-[20px] border-x border-t pb-[env(safe-area-inset-bottom)] shadow-2xl",
        className
      )}
      data-slot="admin-mobile-action-panel"
      inert={!open}
      onCloseAutoFocus={keepDialogFocus}
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        if (mobilePath.length) context.setMobilePath(mobilePath.slice(0, -1));
        else context.close();
      }}
    >
      <div
        className="admin-action-menu-mobile-scroll min-h-0 overflow-y-auto overscroll-contain px-2 pb-2"
        onKeyDown={handleKeyDown}
        onScroll={(event) =>
          scrollPositions.current.set(pathKey, event.currentTarget.scrollTop)
        }
        ref={panelRef}
      >
        <motion.div
          animate={{ height: height || "auto" }}
          className="relative"
          initial={false}
          transition={presets.menuLevel.transition}
        >
          <AnimatePresence
            custom={mobileDirection}
            initial={false}
            mode="popLayout"
          >
            <MobileMenuLevel
              animate="animate"
              className="admin-action-menu-mobile-level"
              custom={mobileDirection}
              data-admin-action-menu-current-level={pathKey}
              exit="exit"
              initial={reducedMotion ? false : "initial"}
              key={pathKey}
              transition={presets.menuLevel.transition}
              variants={mobileMenuLevelVariants}
            >
              <AdminActionMenuContext.Provider value={context}>
                {mobilePath.length === 0 ? (
                  <DrawerHeader className="px-2 pt-3 pb-2 text-left">
                    <DrawerTitle className="font-medium text-base">
                      {title}
                    </DrawerTitle>
                    <DrawerDescription
                      className={cn(!description && "sr-only", "text-xs")}
                    >
                      {description ?? title}
                    </DrawerDescription>
                  </DrawerHeader>
                ) : null}
                {children}
              </AdminActionMenuContext.Provider>
            </MobileMenuLevel>
          </AnimatePresence>
        </motion.div>
      </div>
    </DrawerContent>
  );
}

/** A newly opened confirmation owns focus; do not bounce through the menu trigger. */
function keepDialogFocus(event: Event) {
  if (
    document.querySelector(
      '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"]'
    )
  )
    event.preventDefault();
}

/** Exiting levels must not retain tabbable controls or respond to touch. */
function MobileMenuLevel(props: React.ComponentProps<typeof motion.div>) {
  const present = useIsPresent();
  return (
    <motion.div
      {...props}
      aria-hidden={!present || undefined}
      inert={!present}
    />
  );
}

function AdminActionMenuLabel({
  children,
  tooltip,
}: {
  children: ReactNode;
  tooltip?: ReactNode | false;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label) {
      return;
    }
    const update = () => setTruncated(label.scrollWidth > label.clientWidth);
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(label);
    return () => observer.disconnect();
  }, [children]);

  const label = (
    <span className="min-w-0 truncate" ref={labelRef}>
      {children}
    </span>
  );

  if (!truncated || tooltip === false) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent className="max-w-72" side="top" sideOffset={6}>
        {tooltip ?? children}
      </TooltipContent>
    </Tooltip>
  );
}

type AdminActionMenuItemProps = {
  asChild?: boolean;
  children: ReactNode;
  className?: string;
  closeOnSelect?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  onAction?: () => void | Promise<void>;
  trailing?: ReactNode;
  tooltip?: ReactNode | false;
  variant?: "default" | "destructive";
};

const itemClassName =
  "admin-action-menu-item grid min-h-9 w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[variant=destructive]:text-destructive";

function AdminActionMenuItem({
  asChild = false,
  children,
  className,
  closeOnSelect = true,
  disabled = false,
  icon,
  loading = false,
  loadingLabel,
  onAction,
  trailing,
  tooltip,
  variant = "default",
}: AdminActionMenuItemProps) {
  const { mode, mobilePath, triggerRef } = useAdminActionMenuContext();
  const levelPath = useContext(AdminActionMenuLevelContext);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const { t } = useTranslation("components");
  const running = useRef(false);
  const mounted = useRef(false);
  const [pending, setPending] = useState(false);
  const busy = loading || pending;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const runAction = async () => {
    if (running.current || disabled || busy || !onAction) return;
    running.current = true;
    handoffOverlayFocus(triggerRef.current);
    try {
      const result = onAction();
      if (result && typeof result.then === "function") {
        if (mounted.current) setPending(true);
        await result;
      }
    } catch {
      // A closed menu must not swallow a pending operation's failure feedback.
      toast.error(
        t(
          "error.unknown",
          "An error occurred in the system, please try again later."
        )
      );
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  };

  if (mode === "mobile" && !pathsEqual(mobilePath, levelPath)) {
    return null;
  }

  const itemContent = (label: ReactNode) => (
    <>
      <span
        aria-hidden="true"
        className="flex size-5 items-center justify-center text-muted-foreground [&_svg]:size-4"
      >
        {busy ? <LoaderCircle className="animate-spin" /> : icon}
      </span>
      <AdminActionMenuLabel tooltip={tooltip}>{label}</AdminActionMenuLabel>
      <span className="flex min-w-0 items-center justify-end text-muted-foreground text-xs [&_svg]:size-4">
        {trailing}
      </span>
    </>
  );

  const child =
    asChild && isValidElement<{ children?: ReactNode }>(children)
      ? cloneElement(children, undefined, itemContent(children.props.children))
      : null;
  const isDisabled = disabled || busy;
  const busyLabel = loadingLabel ?? t("actions.processing", "Processing");
  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchMovedRef.current = false;
  };
  const handleTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!(start && touch)) return;
    if (
      Math.abs(touch.clientX - start.x) > 8 ||
      Math.abs(touch.clientY - start.y) > 8
    ) {
      touchMovedRef.current = true;
    }
  };

  if (mode === "desktop") {
    return (
      <DropdownMenuItem
        aria-busy={busy || undefined}
        aria-label={busy ? busyLabel : undefined}
        asChild={asChild}
        className={cn(itemClassName, className)}
        disabled={isDisabled}
        onSelect={async (event) => {
          if (!closeOnSelect) {
            event.preventDefault();
          }
          if (!isDisabled) {
            await runAction();
          }
        }}
        variant={variant}
      >
        {child ?? itemContent(children)}
      </DropdownMenuItem>
    );
  }

  const Comp = asChild ? Slot : "button";
  const mobileItem = (
    <Comp
      aria-busy={busy || undefined}
      aria-disabled={isDisabled || undefined}
      aria-label={busy ? busyLabel : undefined}
      className={cn(
        itemClassName,
        "min-h-11 hover:bg-accent focus-visible:bg-accent",
        variant === "destructive" &&
          "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10",
        className
      )}
      data-admin-action-menu-control
      data-disabled={isDisabled || undefined}
      data-slot="admin-action-menu-item"
      data-variant={variant}
      disabled={asChild ? undefined : isDisabled}
      onClick={async (event) => {
        if (touchMovedRef.current || isDisabled || running.current) {
          event.preventDefault();
          event.stopPropagation();
          touchMovedRef.current = false;
          return;
        }
        if (!isDisabled) {
          await runAction();
        }
      }}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      type={asChild ? undefined : "button"}
    >
      {child ?? itemContent(children)}
    </Comp>
  );

  return closeOnSelect && !isDisabled ? (
    <DrawerClose asChild>{mobileItem}</DrawerClose>
  ) : (
    mobileItem
  );
}

type AdminActionMenuGroupProps = {
  children: ReactNode;
  className?: string;
  label?: ReactNode;
};

function AdminActionMenuGroup({
  children,
  className,
  label,
}: AdminActionMenuGroupProps) {
  const { mode, mobilePath } = useAdminActionMenuContext();
  const levelPath = useContext(AdminActionMenuLevelContext);

  if (mode === "mobile") {
    if (!pathStartsWith(mobilePath, levelPath)) {
      return null;
    }
    if (!pathsEqual(mobilePath, levelPath)) {
      return <>{children}</>;
    }
    return (
      <div
        className={cn("space-y-0.5", className)}
        data-slot="admin-action-menu-group"
      >
        {label ? (
          <div className="px-2.5 pt-2 pb-1 font-medium text-muted-foreground text-xs">
            {label}
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <DropdownMenuGroup className={className}>
      {label ? (
        <DropdownMenuLabel className="px-2.5 pt-2 pb-1 text-muted-foreground text-xs">
          {label}
        </DropdownMenuLabel>
      ) : null}
      {children}
    </DropdownMenuGroup>
  );
}

function AdminActionMenuSeparator({ className }: { className?: string }) {
  const { mode, mobilePath } = useAdminActionMenuContext();
  const levelPath = useContext(AdminActionMenuLevelContext);

  if (mode === "mobile") {
    return pathsEqual(mobilePath, levelPath) ? (
      <div
        className={cn("mx-2 my-1 h-px bg-border", className)}
        data-slot="admin-action-menu-separator"
        role="separator"
      />
    ) : null;
  }
  return <DropdownMenuSeparator className={cn("mx-1", className)} />;
}

type AdminActionMenuSubProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  id?: string;
  label: ReactNode;
};

function AdminActionMenuSub({
  children,
  className,
  disabled = false,
  icon,
  id,
  label,
}: AdminActionMenuSubProps) {
  const generatedId = useId();
  const [subOpen, setSubOpen] = useState(false);
  const subTrigger = useRef<HTMLDivElement>(null);
  const { backLabel, mode, mobilePath, setMobilePath } =
    useAdminActionMenuContext();
  const parentPath = useContext(AdminActionMenuLevelContext);
  const ownPath = [...parentPath, id ?? generatedId];

  if (mode === "desktop") {
    return (
      <AdminActionMenuLevelContext.Provider value={ownPath}>
        <DropdownMenuSub onOpenChange={setSubOpen} open={subOpen}>
          <DropdownMenuSubTrigger
            className={cn(itemClassName, className)}
            disabled={disabled}
            ref={subTrigger}
          >
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center text-muted-foreground [&_svg]:size-4"
            >
              {icon}
            </span>
            <AdminActionMenuLabel>{label}</AdminActionMenuLabel>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              className="admin-action-menu-content w-max min-w-40 max-w-[220px] rounded-[10px] p-1.5"
              collisionPadding={8}
              data-admin-action-menu-level="sub"
              onEscapeKeyDown={(event) => {
                // Radix's default Escape closes the entire root menu. Admin
                // hierarchies instead return one level, just like the mobile panel.
                event.preventDefault();
                event.stopPropagation();
                setSubOpen(false);
                subTrigger.current?.focus({ preventScroll: true });
              }}
              sideOffset={4}
            >
              {children}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </AdminActionMenuLevelContext.Provider>
    );
  }

  if (pathsEqual(mobilePath, parentPath)) {
    return (
      <button
        className={cn(
          itemClassName,
          "min-h-11 hover:bg-accent focus-visible:bg-accent",
          className
        )}
        data-admin-action-menu-control
        data-admin-action-menu-sub-id={ownPath.join("/")}
        data-admin-action-menu-sub-trigger
        disabled={disabled}
        onClick={() => setMobilePath(ownPath)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </span>
        <AdminActionMenuLabel>{label}</AdminActionMenuLabel>
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </button>
    );
  }

  if (!pathStartsWith(mobilePath, ownPath)) {
    return null;
  }

  return (
    <AdminActionMenuLevelContext.Provider value={ownPath}>
      {pathsEqual(mobilePath, ownPath) ? (
        <section
          className="admin-action-menu-mobile-sub"
          data-slot="admin-action-menu-sub"
        >
          <div className="sticky top-0 z-10 flex min-h-12 items-center gap-2 border-b bg-background/95 px-1 py-1 backdrop-blur">
            <button
              aria-label={backLabel}
              className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              data-admin-action-menu-back
              data-admin-action-menu-control
              onClick={() => setMobilePath(parentPath)}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
            <DrawerTitle className="min-w-0 flex-1 truncate font-medium text-base">
              {label}
            </DrawerTitle>
            <DrawerDescription className="sr-only">{label}</DrawerDescription>
          </div>
          <div className="pt-1">{children}</div>
        </section>
      ) : (
        children
      )}
    </AdminActionMenuLevelContext.Provider>
  );
}

function AdminActionMenuDangerItem({
  separated = true,
  ...props
}: Omit<AdminActionMenuItemProps, "variant"> & { separated?: boolean }) {
  return (
    <>
      {separated ? <AdminActionMenuSeparator /> : null}
      <AdminActionMenuItem {...props} variant="destructive" />
    </>
  );
}

export {
  AdminActionMenu,
  AdminActionMenuDangerItem,
  AdminActionMenuGroup,
  AdminActionMenuItem,
  AdminActionMenuSeparator,
  AdminActionMenuSub,
  AdminActionMenuTrigger,
  AdminMobileActionPanel,
};
export type { AdminActionMenuItemProps, AdminActionMenuProps };
