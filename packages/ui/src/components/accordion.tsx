"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { usePresenceInert } from "../hooks/use-presence-inert";

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b last:border-b-0", className)}
      data-slot="accordion-item"
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  trailing,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  /** Independent controls must be siblings of the expand button, never nested. */
  trailing?: React.ReactNode;
}) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left font-medium text-sm outline-none transition-all hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        data-slot="accordion-trigger"
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
      {trailing && (
        <span className="flex shrink-0 items-center pr-4">{trailing}</span>
      )}
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  const contentRef = usePresenceInert(ref);
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      data-slot="accordion-content"
      ref={contentRef}
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
