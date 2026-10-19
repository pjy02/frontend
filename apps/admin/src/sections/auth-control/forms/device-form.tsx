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
  getAuthMethodConfig,
  putAuthMethodConfig as updateAuthMethodConfig,
} from "@workspace/ui/services/admin/admin";
import { uid } from "radash";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useFormSafety } from "@/components/form-safety";
import {
  ReadBoundary,
  readReady,
  requireReadData,
} from "@/components/read-boundary";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/settings-workspace";

const deviceSchema = z.object({
  id: z.number(),
  method: z.string(),
  enabled: z.boolean(),
  config: z
    .object({
      show_ads: z.boolean().optional(),
      only_real_device: z.boolean().optional(),
      enable_security: z.boolean().optional(),
      security_secret: z.string().optional(),
    })
    .optional(),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

export default function DeviceForm() {
  const { t } = useTranslation("auth-control");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getAuthMethodConfig", "device"],
    queryFn: async () => {
      const { data } = await getAuthMethodConfig({
        method: "device",
      });
      return requireReadData(data.data);
    },
    enabled: open,
  });

  const { data, refetch } = readQuery;
  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      id: 0,
      method: "device",
      enabled: false,
      config: {
        show_ads: false,
        only_real_device: false,
        enable_security: false,
        security_secret: "",
      },
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

  async function onSubmit(values: DeviceFormData) {
    if (!readReady(readQuery)) return;
    setLoading(true);
    try {
      await updateAuthMethodConfig(values as API.UpdateAuthMethodConfigRequest);
      toast.success(t("common.saveSuccess", "Saved successfully"));
      refetch();
      form.reset(form.getValues());
      setOpen(false);
    } catch (_error) {
      toast.error(t("common.saveFailed", "Save failed"));
    } finally {
      setLoading(false);
    }
  }

  function generateSecurityKey() {
    const id = uid(32).toLowerCase();
    const formatted = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    form.setValue("config.security_secret", formatted);
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
              <Icon className="h-5 w-5 text-primary" icon="mdi:devices" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("device.title", "Device Sign-In")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("device.description", "Authenticate users with device")}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{t("device.title", "Device Sign-In")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="device-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("device.enable", "Enable")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "device.enableDescription",
                          "When enabled, users can sign in with device"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.show_ads"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("device.showAds", "Show Ads")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "device.showAdsDescription",
                          "When enabled, ads will be shown"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.only_real_device"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          "device.blockVirtualMachine",
                          "Block Virtual Machine"
                        )}
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
                          "device.blockVirtualMachineDescription",
                          "Block virtual machine login, only allow real device"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.enable_security"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("device.enableSecurity", "Enable Security")}
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
                          "device.enableSecurityDescription",
                          "When enabled, application requests must carry communication key"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.security_secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("device.communicationKey", "Communication Key")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="e.g., 12345678-1234-1234-1234-123456789abc"
                          suffix={
                            <div className="flex h-9 items-center text-nowrap bg-muted px-3">
                              <Icon
                                className="size-4 cursor-pointer"
                                icon="mdi:dice-multiple"
                                onClick={generateSecurityKey}
                              />
                            </div>
                          }
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "device.communicationKeyDescription",
                          "The key used for secure communication between application and server"
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
            form="device-form"
            loading={loading || safety.submitting}
            loadingLabel={t("components:actions.processing")}
            type="submit"
          >
            {t("common.save", "Save")}
          </Button>
        </SheetFooter>
      </SheetContent>
      {safety.dialogs}
    </Sheet>
  );
}
