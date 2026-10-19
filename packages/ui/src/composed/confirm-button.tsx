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
import { useLoadingFeedback } from "@workspace/ui/hooks/use-loading-feedback";
import { Check, LoaderCircle } from "lucide-react";
import type React from "react";
import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmationButtonProps {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm: () => unknown;
  cancelText?: string;
  confirmText?: string;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** Use brief only when this check is the single success signal (no duplicate Toast). */
  successFeedback?: "none" | "brief";
  errorText?: string;
}

export const ConfirmButton: React.FC<ConfirmationButtonProps> = ({
  trigger,
  title,
  description,
  onConfirm,
  cancelText,
  confirmText,
  restoreFocusRef,
  successFeedback,
  errorText,
}) => {
  const { t } = useTranslation("components");
  const profile = useMotionProfile();
  const feedback = successFeedback ?? (profile ? "none" : "brief");
  const successHold = profile?.presets.successHold.durationMs ?? 420;
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
  const [failed, setFailed] = useState(false);
  const loadingVisible = useLoadingFeedback(
    status === "loading",
    profile?.presets.loadingReveal.durationMs ?? 0
  );
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
    setFailed(false);
    setStatus("loading");
    try {
      const result = await onConfirm();
      if (result === false) throw new Error("Operation was not confirmed");
      if (!mounted.current) return;
      if (feedback === "none") {
        setOpen(false);
        setStatus("idle");
      } else setStatus("success");
    } catch {
      if (mounted.current) {
        setStatus("idle");
        setFailed(true);
      }
    } finally {
      running.current = false;
    }
  };

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (running.current || status === "loading") return;
        setOpen(nextOpen);
        if (!nextOpen) {
          setStatus("idle");
          setFailed(false);
        }
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!restoreFocusRef?.current?.isConnected) return;
          event.preventDefault();
          restoreFocusRef.current.focus({ preventScroll: true });
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {profile && failed && (
          <p className="text-destructive text-sm" role="alert">
            {errorText ??
              t(
                "actions.writeFailed",
                "The change was not confirmed. Your input is retained; retry when safe."
              )}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={status !== "idle"}>
            {cancelText ?? t("actions.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={status === "loading" || undefined}
            className="admin-confirm-action"
            data-status={status}
            data-visual-status={
              profile
                ? loadingVisible
                  ? "loading"
                  : status === "success"
                    ? "success"
                    : "idle"
                : status
            }
            disabled={status !== "idle"}
            onClick={handleConfirm}
          >
            <span className="admin-confirm-action__label">
              {confirmText ?? t("actions.confirm", "Confirm")}
            </span>
            <span aria-live="polite" className="admin-confirm-action__status">
              {loadingVisible ? (
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
