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
import type React from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmationButtonProps {
  trigger: ReactNode;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  cancelText?: string;
  confirmText?: string;
}

export const ConfirmButton: React.FC<ConfirmationButtonProps> = ({
  trigger,
  title,
  description,
  onConfirm,
  cancelText,
  confirmText,
}) => {
  const { t } = useTranslation("components");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {cancelText ?? t("actions.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmText ?? t("actions.confirm", "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
