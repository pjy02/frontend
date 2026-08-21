"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

type WorkspaceDialogSize = "md" | "lg" | "xl";

const sizeClassName: Record<WorkspaceDialogSize, string> = {
  md: "sm:max-w-3xl",
  lg: "sm:max-w-5xl",
  xl: "sm:max-w-7xl",
};

export const WorkspaceDialog = Dialog;
export const WorkspaceDialogTrigger = DialogTrigger;
export const WorkspaceDialogClose = DialogClose;
export const WorkspaceDialogTitle = DialogTitle;
export const WorkspaceDialogDescription = DialogDescription;

export function WorkspaceDialogContent({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  size?: WorkspaceDialogSize;
}) {
  return (
    <DialogContent
      className={cn(
        "admin-workspace-dialog flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[min(92dvh,960px)]",
        sizeClassName[size],
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn(
        "admin-workspace-dialog__header shrink-0 border-b px-5 py-4 pr-14 sm:px-7 sm:py-5 sm:pr-16",
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "admin-workspace-dialog__body min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6",
        className
      )}
      {...props}
    />
  );
}

export function WorkspaceDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        "admin-workspace-dialog__footer shrink-0 border-t px-5 py-4 sm:px-7",
        className
      )}
      {...props}
    />
  );
}
