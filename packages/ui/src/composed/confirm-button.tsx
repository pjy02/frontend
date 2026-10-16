"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { useMotionProfile } from "@workspace/ui/components/motion-profile";
import { Check, LoaderCircle } from "lucide-react";
import type React from "react";
import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmationButtonProps {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  cancelText?: string;
  confirmText?: string;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}

export const ConfirmButton: React.FC<ConfirmationButtonProps> = ({
  trigger,
  title,
  description,
  onConfirm,
  cancelText,
  confirmText,
  restoreFocusRef,
}) => {
  const { t } = useTranslation("components");
  const successHold = useMotionProfile()?.presets.successHold.durationMs ?? 420;
  const mounted = useRef(false);
  const running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  useEffect(() => {
    if (!open || status !== "success") return;
    const finish = () => {
      setOpen(false);
      setStatus("idle");
    };
    if (!successHold) return finish();
    const timer = setTimeout(finish, successHold);
    return () => clearTimeout(timer);
  }, [open, status, successHold]);

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (running.current || status !== "idle") return;
    running.current = true;
    setStatus("loading");
    try {
      await onConfirm();
      if (!mounted.current) return;
      setStatus("success");
    } catch {
      if (mounted.current) setStatus("idle");
    } finally {
      running.current = false;
    }
  };

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (running.current || status === "loading") return;
        setOpen(nextOpen);
        if (!nextOpen) setStatus("idle");
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!restoreFocusRef?.current) return;
          event.preventDefault();
          restoreFocusRef.current.focus({ preventScroll: true });
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={status !== "idle"}>
            {cancelText ?? t("actions.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={status === "loading" || undefined}
            className="admin-confirm-action"
            data-status={status}
            disabled={status !== "idle"}
            onClick={handleConfirm}
          >
            <span className="admin-confirm-action__label">
              {confirmText ?? t("actions.confirm", "Confirm")}
            </span>
            <span aria-live="polite" className="admin-confirm-action__status">
              {status === "loading" ? (
                <LoaderCircle className="animate-spin" />
              ) : status === "success" ? (
                <Check />
              ) : null}
              <span className="sr-only">
                {status === "loading"
                  ? t("actions.processing", "Processing")
                  : status === "success"
                    ? t("actions.completed", "Completed")
                    : ""}
              </span>
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
