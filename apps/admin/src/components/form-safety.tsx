import { useBlocker, useRouter } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { useEffect, useRef, useState } from "react";
import {
  type FieldErrors,
  type FieldValues,
  type Path,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormReturn,
  useWatch,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/** Names only: values, including credentials, never leave the form's memory. */
export function changedFormFields(
  baseline: unknown,
  current: unknown,
  prefix = ""
): string[] {
  if (Object.is(baseline, current)) return [];
  if (Array.isArray(baseline) || Array.isArray(current)) {
    if (
      !(Array.isArray(baseline) && Array.isArray(current)) ||
      baseline.length !== current.length
    )
      return [prefix];
    return [
      ...new Set(
        baseline.flatMap((value, index) =>
          changedFormFields(
            value,
            current[index],
            value && typeof value === "object" ? `${prefix}.${index}` : prefix
          )
        )
      ),
    ];
  }
  if (
    baseline &&
    current &&
    typeof baseline === "object" &&
    typeof current === "object"
  ) {
    const left = baseline as Record<string, unknown>;
    const right = current as Record<string, unknown>;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
      (key) =>
        changedFormFields(
          left[key],
          right[key],
          prefix ? `${prefix}.${key}` : key
        )
    );
  }
  return [prefix];
}

export function formErrorEntries(
  errors: unknown,
  prefix = ""
): { name: string; message: string }[] {
  if (!errors || typeof errors !== "object") return [];
  return Object.entries(errors).flatMap(([key, value]) => {
    if (!value || ["ref", "type", "types"].includes(key)) return [];
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value.message === "string")
      return [{ name, message: value.message }];
    return formErrorEntries(value as FieldErrors, name);
  });
}

function RouteBlocker({
  dirty,
  confirm,
}: {
  dirty: boolean;
  confirm: () => Promise<boolean>;
}) {
  useBlocker({
    shouldBlockFn: async () => dirty && !(await confirm()),
    enableBeforeUnload: false,
    disabled: !dirty,
  });
  return null;
}

function FormNavigationGuard(props: {
  dirty: boolean;
  confirm: () => Promise<boolean>;
}) {
  const router = useRouter({ warn: false });
  return router ? <RouteBlocker {...props} /> : null;
}

export function useFormSafety<T extends FieldValues>({
  form,
  open,
  onOpenChange,
  review = true,
}: {
  form: UseFormReturn<T>;
  open: boolean;
  onOpenChange: (open: boolean) => void | Promise<void>;
  review?: boolean;
}) {
  const { t } = useTranslation("components");
  const values = useWatch({ control: form.control });
  const changed = changedFormFields(
    form.formState.defaultValues || {},
    values
  ).filter(Boolean);
  const dirty = open && changed.length > 0;
  const anchor = useRef<HTMLDivElement>(null);
  const [confirmation, setConfirmation] = useState<"discard" | "review" | null>(
    null
  );
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const mounted = useRef(true);
  const openRef = useRef(open);
  openRef.current = open;
  const frames = useRef(new Set<number>());
  const confirmationFocus = useRef<HTMLElement | null>(null);
  const running = useRef(false);
  const closingApproved = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(false);
  const errors = formErrorEntries(form.formState.errors);
  const previousErrors = useRef(errors);
  if (errors.length) previousErrors.current = errors;
  const busy = submitting || form.formState.isSubmitting;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resolver.current?.(false);
      resolver.current = null;
      for (const frame of frames.current) cancelAnimationFrame(frame);
      frames.current.clear();
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);
  useEffect(() => {
    if (!open) {
      for (const frame of frames.current) cancelAnimationFrame(frame);
      frames.current.clear();
      resolver.current?.(false);
      resolver.current = null;
      setConfirmation(null);
      setFailure(false);
    }
  }, [open]);

  const decide = (accepted: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setConfirmation(null);
    resolve?.(accepted);
  };
  const ask = (kind: "discard" | "review") => {
    // A double click must not replace a pending navigation/submit resolver.
    if (resolver.current) return Promise.resolve(false);
    confirmationFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setConfirmation(kind);
    });
  };
  const confirmDiscard = async () => {
    // An approved save/discard may close a routed editor before state settles.
    // Read a ref here: the router can call the old render's blocker.
    if (closingApproved.current) return true;
    if (running.current || form.formState.isSubmitting) return false;
    if (!(await ask("discard"))) return false;
    form.reset();
    return true;
  };
  const requestOpenChange = async (next: boolean) => {
    if (next) return onOpenChange(true);
    if (running.current || form.formState.isSubmitting) return;
    if (!dirty || (await confirmDiscard())) await closeWithApproval();
  };
  const closeWithApproval = async () => {
    closingApproved.current = true;
    try {
      await onOpenChange(false);
    } finally {
      closingApproved.current = false;
    }
  };
  const completeSave = async () => {
    // Only call after the write succeeds. Keep submitted values as the baseline,
    // rather than clearing a still-visible form before navigation completes.
    form.reset(form.getValues());
    await closeWithApproval();
  };
  const root = () =>
    anchor.current?.closest('[role="dialog"]') ||
    anchor.current?.closest("form");
  const fieldElement = (name: string) =>
    Array.from(
      root()?.querySelectorAll<HTMLElement>("[data-form-field], [name]") || []
    ).find(
      (element) =>
        element.dataset.formField === name ||
        element.getAttribute("name") === name
    ) ||
    Array.from(
      root()?.querySelectorAll<HTMLElement>("[data-form-field-container]") || []
    ).find((element) => element.dataset.formFieldContainer === name);
  const fieldLabel = (name: string) => {
    const element = fieldElement(name);
    const label = element
      ?.closest('[data-slot="form-item"]')
      ?.querySelector('[data-slot="form-label"]');
    const parts = name.split(".");
    const group = parts[0]!;
    const title = label?.textContent?.trim();
    if (!/^\d+$/.test(parts[1] || ""))
      return title || t(`formSafety.fields.${group}`, group);
    const index = Number(parts[1]);
    const protocol =
      group === "protocols"
        ? form.getValues()[group]?.[index]?.type
        : undefined;
    const identifier = [
      "vmess",
      "vless",
      "trojan",
      "anytls",
      "shadowsocks",
      "hysteria",
      "hysteria2",
      "tuic",
      "naive",
      "socks",
      "http",
    ].includes(protocol)
      ? String(protocol).toUpperCase()
      : `#${index + 1}`;
    const leaf = parts.at(-1)!;
    return `${t(`formSafety.fields.${group}`, group)} · ${identifier}${parts.length > 2 ? ` · ${title || t(`formSafety.fields.${leaf}`, leaf)}` : ""}`;
  };
  const scheduleFocus = (work: () => void) => {
    const frame = requestAnimationFrame(() => {
      frames.current.delete(frame);
      if (mounted.current && openRef.current) work();
    });
    frames.current.add(frame);
  };
  const locate = (name: string) => {
    for (const frame of frames.current) cancelAnimationFrame(frame);
    frames.current.clear();
    const activate = (trigger: HTMLElement) => {
      if (trigger.dataset.slot === "tabs-trigger") {
        // Radix Tabs activates on keydown/mousedown, not synthetic .click().
        trigger.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        );
      } else trigger.click();
    };
    const reveal = (attempt = 0) => {
      let opening = false;
      for (const trigger of root()?.querySelectorAll<HTMLElement>(
        "[data-form-path]"
      ) || []) {
        const prefixes = trigger.dataset.formPath?.split(" ") || [];
        if (
          prefixes.some(
            (prefix) => name === prefix || name.startsWith(`${prefix}.`)
          ) &&
          !["active", "open"].includes(trigger.dataset.state || "")
        ) {
          activate(trigger);
          opening = true;
        }
      }
      const panel = fieldElement(name)?.closest(
        '[role="tabpanel"][data-state="inactive"]'
      );
      const triggerId = panel?.getAttribute("aria-labelledby");
      const tab = triggerId ? document.getElementById(triggerId) : null;
      if (tab) {
        activate(tab);
        opening = true;
      }
      // A parent can mount another collapsed section. Resolve it on the next commit.
      if (opening && attempt < 3)
        return scheduleFocus(() => reveal(attempt + 1));
      const target = fieldElement(name);
      if (target?.closest("[hidden], [inert]")) return;
      target?.scrollIntoView?.({ block: "center", behavior: "instant" });
      if (target) {
        const control = target.matches(
          "input,textarea,select,button,[tabindex],[contenteditable=true]"
        )
          ? target
          : target.querySelector<HTMLElement>(
              "input,textarea,select,button,[tabindex],[contenteditable=true]"
            );
        control?.focus({ preventScroll: true });
      } else form.setFocus(name as Path<T>);
    };
    scheduleFocus(() => reveal());
  };
  const handleSubmit =
    (submit: SubmitHandler<T>, invalid?: SubmitErrorHandler<T>) =>
    async (event?: React.BaseSyntheticEvent) => {
      event?.preventDefault();
      if (running.current) return;
      running.current = true;
      setSubmitting(true);
      setFailure(false);
      try {
        await form.handleSubmit(
          async (data, sourceEvent) => {
            if (review && !(await ask("review"))) return;
            await submit(data, sourceEvent);
          },
          async (validationErrors, sourceEvent) => {
            await invalid?.(validationErrors, sourceEvent);
            scheduleFocus(() =>
              anchor.current?.scrollIntoView?.({
                block: "start",
                behavior: "instant",
              })
            );
          }
        )(event);
      } catch {
        if (mounted.current) {
          setFailure(true);
          toast.error(
            t(
              "formSafety.saveFailed",
              "Save failed. Your input has been kept; please retry."
            )
          );
        }
      } finally {
        running.current = false;
        if (mounted.current) setSubmitting(false);
      }
    };
  const changes = [...new Set(changed.map(fieldLabel))];
  return {
    dirty,
    busy,
    canLeave: async () => {
      if (running.current || form.formState.isSubmitting) return false;
      return !dirty || (await confirmDiscard());
    },
    requestOpenChange,
    completeSave,
    handleSubmit,
    summary: (
      <div className="col-span-full" ref={anchor}>
        <div
          aria-hidden={errors.length === 0 || undefined}
          className="admin-form-summary-region grid"
          data-state={errors.length ? "visible" : "hidden"}
          inert={errors.length === 0}
        >
          <div className="min-h-0 overflow-hidden">
            {previousErrors.current.length > 0 && (
              <div
                className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
                role="alert"
                tabIndex={-1}
              >
                <p className="font-medium text-sm">
                  {t("formSafety.errors", "Please correct {{count}} fields", {
                    count: previousErrors.current.length,
                  })}
                </p>
                <ul className="mt-2 space-y-1">
                  {previousErrors.current.map(({ name, message }) => (
                    <li key={name}>
                      <button
                        className="min-h-11 text-left text-destructive text-sm underline underline-offset-4"
                        onClick={() => locate(name)}
                        type="button"
                      >
                        {fieldLabel(name)}: {message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        {failure && (
          <p className="mb-4 text-destructive text-sm" role="alert">
            {t(
              "formSafety.saveFailed",
              "Save failed. Your input has been kept; please retry."
            )}
          </p>
        )}
      </div>
    ),
    dialogs: (
      <>
        <FormNavigationGuard
          confirm={confirmDiscard}
          dirty={dirty || (open && busy)}
        />
        <AlertDialog
          onOpenChange={(next) => {
            if (!next) decide(false);
          }}
          open={confirmation !== null}
        >
          <AlertDialogContent
            className="max-h-[85dvh] overflow-y-auto"
            onCloseAutoFocus={(event) => {
              const target = confirmationFocus.current;
              if (!(target?.isConnected && openRef.current)) return;
              if (
                target.matches(":disabled") ||
                target.closest("[inert], [hidden]")
              )
                return;
              event.preventDefault();
              target.focus({ preventScroll: true });
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmation === "review"
                  ? t("formSafety.reviewTitle", "Review changes before saving")
                  : t("formSafety.discardTitle", "Discard unsaved changes?")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmation === "review"
                  ? t(
                      "formSafety.reviewHint",
                      "Only field names are shown. Passwords, keys and tokens are not displayed or stored as drafts."
                    )
                  : t(
                      "formSafety.discardHint",
                      "Leaving now will lose your unsaved input."
                    )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {confirmation === "review" && (
              <ul
                className="list-inside list-disc space-y-1 text-sm"
                data-form-change-summary
              >
                {(changes.length
                  ? changes
                  : [t("formSafety.noChanges", "No changed fields")]
                ).map((name) => (
                  <li className="break-words" key={name}>
                    {name}
                  </li>
                ))}
              </ul>
            )}
            <AlertDialogFooter>
              <Button autoFocus onClick={() => decide(false)} variant="outline">
                {t("formSafety.keepEditing", "Keep editing")}
              </Button>
              <Button
                onClick={() => decide(true)}
                variant={confirmation === "review" ? "default" : "destructive"}
              >
                {confirmation === "review"
                  ? t("formSafety.confirmSave", "Confirm save")
                  : t("formSafety.discard", "Discard changes")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    ),
  };
}
