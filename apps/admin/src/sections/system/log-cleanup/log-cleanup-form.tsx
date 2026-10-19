import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Switch } from "@workspace/ui/components/switch";
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import { Icon } from "@workspace/ui/composed/icon";
import {
  getLogSetting,
  postLogSetting as updateLogSetting,
} from "@workspace/ui/services/admin/admin";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { z } from "zod";
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
import { logCleanupSchema } from "@/utils/admin-form-contracts";

type LogCleanupFormData = z.infer<ReturnType<typeof logCleanupSchema>>;

export default function LogCleanupForm() {
  const { t } = useTranslation("system");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getLogSetting"],
    queryFn: async () => {
      const { data } = await getLogSetting();
      return requireReadData(data.data);
    },
    enabled: open,
  });

  const { data, refetch } = readQuery;
  const form = useForm<LogCleanupFormData>({
    resolver: zodResolver(
      logCleanupSchema(
        t("logCleanup.minimumDays", "Keep logs for at least 7 whole days.")
      )
    ),
    defaultValues: {
      auto_clear: false,
      clear_days: 30,
    },
  });
  const safety = useFormSafety({
    form,
    open,
    onOpenChange: setOpen,
    review: true,
  });

  useEffect(() => {
    if (data && !safety.dirty && !safety.busy) {
      form.reset(data);
    }
  }, [data, form]);

  async function onSubmit(values: LogCleanupFormData) {
    if (!readReady(readQuery)) return;
    setLoading(true);
    try {
      await updateLogSetting(values as API.LogSetting);
      toast.success(t("common.saveSuccess", "Save Successful"));
      refetch();
      form.reset(form.getValues());
      setOpen(false);
    } catch (_error) {
      toast.error(t("common.saveFailed", "Save Failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet onOpenChange={safety.requestOpenChange} open={open}>
      <SheetTrigger asChild>
        <button
          className="flex w-full items-center justify-between text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" icon="mdi:delete-sweep" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("logCleanup.title", "Log Cleanup Settings")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "logCleanup.description",
                  "Configure automatic log cleanup rules and retention period"
                )}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>
            {t("logCleanup.title", "Log Cleanup Settings")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t(
              "logCleanup.description",
              "Configure automatic log cleanup rules and retention period"
            )}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="log-cleanup-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                {data && data.clear_days < 7 && (
                  <p
                    className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                    role="alert"
                  >
                    {t(
                      "logCleanup.legacyRetention",
                      "The saved retention is {{days}} days. The backend now requires at least 7 days; choose a new value before saving. The saved value has not been changed.",
                      { days: data.clear_days }
                    )}
                  </p>
                )}
                <FormField
                  control={form.control}
                  name="auto_clear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("logCleanup.autoClear", "Enable Auto Cleanup")}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "logCleanup.autoClearDescription",
                          "When enabled, the system will automatically clear expired log records"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clear_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("logCleanup.clearDays", "Retention Days")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          min={7}
                          onValueChange={(value) =>
                            field.onChange(Number(value))
                          }
                          placeholder={t(
                            "logCleanup.clearDaysPlaceholder",
                            "Enter retention days"
                          )}
                          step={1}
                          type="number"
                          value={field.value?.toString()}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "logCleanup.clearDaysDescription",
                          "Number of days to retain logs; logs older than this will be cleaned up"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </ReadBoundary>
        </ScrollArea>
        <SheetFooter className="flex-row justify-end gap-2 pt-3">
          <Button
            disabled={loading}
            onClick={() => safety.requestOpenChange(false)}
            variant="outline"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            disabled={loading || !readReady(readQuery)}
            form="log-cleanup-form"
            loading={loading || safety.submitting}
            loadingLabel={t("components:actions.processing")}
            type="submit"
          >
            {t("common.save", "Save Settings")}
          </Button>
        </SheetFooter>
      </SheetContent>
      {safety.dialogs}
    </Sheet>
  );
}
