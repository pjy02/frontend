"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@workspace/ui/lib/utils";
import {
  Children,
  type ComponentProps,
  type CSSProperties,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMotionProfile } from "./motion-profile";

const TabsStateContext = createContext<{
  value?: string;
  preserveContent: boolean;
}>({ preserveContent: false });

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  preserveContent = false,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root> & { preserveContent?: boolean }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value ?? internalValue;
  return (
    <TabsStateContext.Provider value={{ value: activeValue, preserveContent }}>
      <TabsPrimitive.Root
        className={cn("flex flex-col gap-2", className)}
        data-slot="tabs"
        defaultValue={defaultValue}
        onValueChange={(next) => {
          setInternalValue(next);
          onValueChange?.(next);
        }}
        value={value}
        {...props}
      />
    </TabsStateContext.Provider>
  );
}

function TabsList({
  className,
  children,
  style,
  ref,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  const tabCount = Math.max(Children.count(children), 1);
  const profile = useMotionProfile();
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!(list && profile)) return;
    let positioned = false;
    const update = () => {
      const active = list.querySelector<HTMLElement>(
        ':scope > [data-slot="tabs-trigger"][data-state="active"]'
      );
      if (!(active?.offsetWidth && list.offsetWidth)) {
        list.dataset.indicatorReady = "false";
        positioned = false;
        return;
      }
      // Offset geometry is independent of an opening Dialog's scale/translate.
      list.style.setProperty("--admin-tabs-x", `${active.offsetLeft}px`);
      list.style.setProperty("--admin-tabs-y", `${active.offsetTop}px`);
      list.style.setProperty("--admin-tabs-width", `${active.offsetWidth}px`);
      list.style.setProperty("--admin-tabs-height", `${active.offsetHeight}px`);
      list.dataset.indicatorReady = "true";
      list.dataset.indicatorAnimated = String(positioned);
      positioned = true;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "disabled", "hidden"],
      childList: true,
      characterData: true,
    });
    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resize?.observe(list);
    for (const trigger of list.querySelectorAll('[data-slot="tabs-trigger"]'))
      resize?.observe(trigger);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", update);
      delete list.dataset.indicatorReady;
      delete list.dataset.indicatorAnimated;
      for (const name of ["x", "y", "width", "height"])
        list.style.removeProperty(`--admin-tabs-${name}`);
    };
  }, [Boolean(profile)]);

  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground",
        className
      )}
      data-slot="tabs-list"
      ref={(element) => {
        listRef.current = element;
        if (typeof ref === "function") return ref(element);
        if (ref) ref.current = element;
      }}
      style={
        {
          "--admin-tabs-count": tabCount,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-medium text-foreground text-sm transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({
  className,
  value,
  forceMount,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  const context = useContext(TabsStateContext);
  const visited = useRef(false);
  const active = context.value === value;
  if (active) visited.current = true;
  // Explicit form-only opt-in: do not keep ordinary data tabs querying in the background.
  const retained = context.preserveContent && visited.current;
  return (
    <TabsPrimitive.Content
      className={cn("flex-1 outline-none", className)}
      data-slot="tabs-content"
      forceMount={forceMount || retained || undefined}
      hidden={retained ? !active : undefined}
      value={value}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
