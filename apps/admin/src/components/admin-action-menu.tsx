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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowLeft, ChevronRight, LoaderCircle } from "lucide-react";
import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type MenuMode = "desktop" | "mobile";

type AdminActionMenuContextValue = {
  backLabel: string;
  mode: MenuMode;
  mobilePath: string[];
  setMobilePath: (path: string[]) => void;
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
  const [mobilePath, setMobilePath] = useState<string[]>([]);
  const open = controlledOpen ?? internalOpen;
  const mode: MenuMode = isMobile ? "mobile" : "desktop";

  const updateOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setMobilePath([]);
    }
  };

  useEffect(() => {
    if (!open) {
      setMobilePath([]);
    }
  }, [open]);

  const context = useMemo(
    () => ({ backLabel, mode, mobilePath, setMobilePath }),
    [backLabel, mode, mobilePath]
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
              "admin-action-menu-content w-max min-w-40 max-w-56 rounded-[10px] p-1.5",
              className
            )}
            collisionPadding={8}
          >
            {children}
          </DropdownMenuContent>
        </DropdownMenu>
      </AdminActionMenuLevelContext.Provider>
    </AdminActionMenuContext.Provider>
  );
}

function AdminActionMenuTrigger({ children }: { children: ReactElement }) {
  const { mode } = useAdminActionMenuContext();
  return mode === "mobile" ? (
    <DrawerTrigger asChild>{children}</DrawerTrigger>
  ) : (
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
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
  const { mobilePath } = useAdminActionMenuContext();
  const isRoot = mobilePath.length === 0;

  return (
    <DrawerContent
      className={cn(
        "admin-action-menu-mobile max-h-[min(80dvh,40rem)] overflow-hidden rounded-t-[20px] border-x border-t pb-[env(safe-area-inset-bottom)] shadow-2xl",
        className
      )}
      data-slot="admin-mobile-action-panel"
    >
      <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2">
        {isRoot ? (
          <DrawerHeader className="px-2 pt-3 pb-2 text-left">
            <DrawerTitle className="font-medium text-base">{title}</DrawerTitle>
            <DrawerDescription
              className={cn(!description && "sr-only", "text-xs")}
            >
              {description ?? title}
            </DrawerDescription>
          </DrawerHeader>
        ) : null}
        <div
          className="admin-action-menu-mobile-level"
          data-depth={mobilePath.length}
        >
          {children}
        </div>
      </div>
    </DrawerContent>
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
  onAction?: () => void | Promise<void>;
  trailing?: ReactNode;
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
  onAction,
  trailing,
  variant = "default",
}: AdminActionMenuItemProps) {
  const { mode, mobilePath } = useAdminActionMenuContext();
  const levelPath = useContext(AdminActionMenuLevelContext);

  if (mode === "mobile" && !pathsEqual(mobilePath, levelPath)) {
    return null;
  }

  const itemContent = (label: ReactNode) => (
    <>
      <span
        aria-hidden="true"
        className="flex size-5 items-center justify-center text-muted-foreground [&_svg]:size-4"
      >
        {loading ? <LoaderCircle className="animate-spin" /> : icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex min-w-0 items-center justify-end text-muted-foreground text-xs [&_svg]:size-4">
        {trailing}
      </span>
    </>
  );

  const child =
    asChild && isValidElement<{ children?: ReactNode }>(children)
      ? cloneElement(children, undefined, itemContent(children.props.children))
      : null;
  const isDisabled = disabled || loading;

  if (mode === "desktop") {
    return (
      <DropdownMenuItem
        aria-busy={loading || undefined}
        asChild={asChild}
        className={cn(itemClassName, className)}
        disabled={isDisabled}
        onSelect={async (event) => {
          if (!closeOnSelect) {
            event.preventDefault();
          }
          if (!isDisabled) {
            await onAction?.();
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
      aria-busy={loading || undefined}
      className={cn(
        itemClassName,
        "min-h-11 hover:bg-accent focus-visible:bg-accent",
        variant === "destructive" &&
          "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10",
        className
      )}
      data-disabled={isDisabled || undefined}
      data-slot="admin-action-menu-item"
      data-variant={variant}
      disabled={asChild ? undefined : isDisabled}
      onClick={async () => {
        if (!isDisabled) {
          await onAction?.();
        }
      }}
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
  const { backLabel, mode, mobilePath, setMobilePath } =
    useAdminActionMenuContext();
  const parentPath = useContext(AdminActionMenuLevelContext);
  const ownPath = [...parentPath, id ?? generatedId];

  if (mode === "desktop") {
    return (
      <AdminActionMenuLevelContext.Provider value={ownPath}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={cn(itemClassName, className)}
            disabled={disabled}
          >
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center text-muted-foreground [&_svg]:size-4"
            >
              {icon}
            </span>
            <span className="min-w-0 truncate">{label}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            className="admin-action-menu-content w-max min-w-40 max-w-56 rounded-[10px] p-1.5"
            collisionPadding={8}
            sideOffset={4}
          >
            {children}
          </DropdownMenuSubContent>
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
        <span className="min-w-0 truncate">{label}</span>
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

function AdminActionMenuDangerItem(
  props: Omit<AdminActionMenuItemProps, "variant">
) {
  return <AdminActionMenuItem {...props} variant="destructive" />;
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
