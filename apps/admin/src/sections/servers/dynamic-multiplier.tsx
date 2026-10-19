"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { ArrayInput } from "@workspace/ui/composed/dynamic-Inputs";
import { Icon } from "@workspace/ui/composed/icon";
import {
  getSystemGetNodeMultiplier as getNodeMultiplier,
  postSystemSetNodeMultiplier as setNodeMultiplier,
} from "@workspace/ui/services/admin/admin";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useFormSafety } from "@/components/form-safety";
import {
  ReadBoundary,
  readReady,
  requireReadData,
} from "@/components/read-boundary";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/settings-workspace";

export default function DynamicMultiplier() {
  const { t } = useTranslation("servers");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useForm<{ periods: API.TimePeriod[] }>({
    defaultValues: { periods: [] },
  });
  const safety = useFormSafety({
    form,
    open,
    onOpenChange: setOpen,
    review: true,
  });
  const timeSlots = form.watch("periods");
  const setTimeSlots = (periods: API.TimePeriod[]) =>
    form.setValue("periods", periods, { shouldDirty: true });

  const readQuery = useQuery({
    queryKey: ["getNodeMultiplier"],
    queryFn: async () => {
      const { data } = await getNodeMultiplier();
      return (requireReadData(data.data)?.periods ?? []) as API.TimePeriod[];
    },
    enabled: open,
  });
  const { data: periodsResp, refetch: refetchPeriods } = readQuery;

  useEffect(() => {
    if (periodsResp && !safety.dirty && !safety.busy) {
      form.reset({ periods: periodsResp });
    }
  }, [periodsResp]);

  async function savePeriods() {
    if (!readReady(readQuery)) return;
    setSaving(true);
    try {
      await setNodeMultiplier({ periods: timeSlots });
      toast.success(t("server_config.saveSuccess", "Saved successfully"));
      await safety.completeSave();
      refetchPeriods();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onOpenChange={safety.requestOpenChange} open={open}>
      <SheetTrigger asChild>
        <button
          aria-label={t(
            "server_config.dynamic_multiplier",
            "Dynamic multiplier"
          )}
          className="w-full rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          type="button"
        >
          <Card className="admin-server-shortcut h-full">
            <CardContent className="admin-server-shortcut__content">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon
                      className="h-5 w-5 text-primary"
                      icon="mdi:clock-time-eight"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {t(
                        "server_config.dynamic_multiplier",
                        "Dynamic multiplier"
                      )}
                    </p>
                    <p className="truncate text-muted-foreground text-sm">
                      {t(
                        "server_config.dynamic_multiplier_desc",
                        "Define time slots and multipliers to adjust traffic accounting."
                      )}
                    </p>
                  </div>
                </div>
                <Icon className="size-6" icon="mdi:chevron-right" />
              </div>
            </CardContent>
          </Card>
        </button>
      </SheetTrigger>

      <SheetContent className="w-[600px] max-w-full md:max-w-3xl" size="md">
        <SheetHeader>
          <SheetTitle>
            {t("server_config.dynamic_multiplier", "Dynamic multiplier")}
          </SheetTitle>
          <SheetDescription>
            {t(
              "server_config.dynamic_multiplier_desc",
              "Define time slots and multipliers to adjust traffic accounting."
            )}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          {safety.summary}
          <ReadBoundary configuration query={readQuery}>
            <fieldset className="min-w-0 space-y-4 pt-4" disabled={safety.busy}>
              <ArrayInput<API.TimePeriod>
                fields={[
                  {
                    name: "start_time",
                    prefix: t("server_config.fields.start_time", "Start time"),
                    type: "time",
                    step: "1",
                  },
                  {
                    name: "end_time",
                    prefix: t("server_config.fields.end_time", "End time"),
                    type: "time",
                    step: "1",
                  },
                  {
                    name: "multiplier",
                    prefix: t("server_config.fields.multiplier", "Multiplier"),
                    type: "number",
                    placeholder: "0",
                  },
                ]}
                onChange={setTimeSlots}
                resetOnEmpty
                value={timeSlots}
              />
            </fieldset>
          </ReadBoundary>
        </ScrollArea>

        <SheetFooter className="flex-row justify-between pt-3">
          <Button
            disabled={!readReady(readQuery) || safety.busy}
            onClick={() => form.reset({ periods: periodsResp || [] })}
            variant="outline"
          >
            {t("server_config.fields.reset", "Reset")}
          </Button>
          <div className="flex gap-2">
            <Button
              disabled={safety.busy}
              onClick={() => safety.requestOpenChange(false)}
              variant="outline"
            >
              {t("actions.cancel", "Cancel")}
            </Button>
            <Button
              disabled={!readReady(readQuery) || safety.busy}
              loading={saving || safety.submitting}
              loadingLabel={t("components:actions.processing")}
              onClick={safety.handleSubmit(savePeriods)}
            >
              {t("actions.save", "Save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
      {safety.dialogs}
    </Sheet>
  );
}
