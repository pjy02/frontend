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

const telegramSchema = z.object({
  enabled: z.boolean(),
  bot_token: z.string().optional(),
  enable_notify: z.boolean(),
  webhook_domain: z.string().optional(),
  // Stored as text because the panel round-trips this config as JSON; the
  // server parses it and disables every group feature when it is empty.
  group_chat_id: z
    .string()
    .optional()
    .refine((value) => !value?.trim() || /^-?\d+$/.test(value.trim()), {
      message: "Group chat id must be a number, e.g. -1001234567890",
    }),
});

type TelegramFormData = z.infer<typeof telegramSchema>;

export default function TelegramForm() {
  const { t } = useTranslation("auth-control");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getAuthMethodConfig", "telegram"],
    queryFn: async () => {
      const { data } = await getAuthMethodConfig({
        method: "telegram",
      });

      return requireReadData(data.data);
    },
    enabled: open,
  });

  const { data, refetch } = readQuery;
  const form = useForm<TelegramFormData>({
    resolver: zodResolver(telegramSchema),
    defaultValues: {
      enabled: false,
      bot_token: "",
      enable_notify: false,
      webhook_domain: "",
      group_chat_id: "",
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
      form.reset({
        enabled: data.enabled,
        bot_token: data.config?.bot_token || "",
        enable_notify: data.config?.enable_notify ?? false,
        webhook_domain: data.config?.webhook_domain || "",
        group_chat_id: data.config?.group_chat_id || "",
      });
    }
  }, [data, form]);

  async function onSubmit(values: TelegramFormData) {
    if (!readReady(readQuery)) return;
    setLoading(true);
    try {
      await updateAuthMethodConfig({
        ...data,
        enabled: values.enabled,
        config: {
          ...data?.config,
          bot_token: values.bot_token,
          enable_notify: values.enable_notify,
          webhook_domain: values.webhook_domain,
          group_chat_id: values.group_chat_id?.trim() || "",
        },
      } as API.UpdateAuthMethodConfigRequest);
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

  return (
    <Sheet onOpenChange={safety.requestOpenChange} open={open}>
      <SheetTrigger asChild>
        <button
          className="flex w-full items-center justify-between text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" icon="mdi:telegram" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("telegram.title", "Telegram Sign-In")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "telegram.description",
                  "Authenticate users with Telegram accounts"
                )}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{t("telegram.title", "Telegram Sign-In")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="telegram-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("telegram.enable", "Enable")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "telegram.enableDescription",
                          "When enabled, users can sign in with their Telegram account"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bot_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("telegram.botToken", "Bot Token")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="123456789:AAHn_xxxxxxxxxxxxxxxxxxxxxxxx"
                          type="password"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "telegram.botTokenDescription",
                          "Telegram Bot Token from @BotFather"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="webhook_domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("telegram.webhookDomain", "Webhook Domain")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="https://your-domain.com"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "telegram.webhookDomainDescription",
                          "Public HTTPS URL of this server. Leave empty to use long-polling."
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="group_chat_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("telegram.groupChatId", "Admin Group Chat ID")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="-1001234567890"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "telegram.groupChatIdDescription",
                          "Forum-enabled supergroup that carries notifications, tickets and live chat. The bot must be an administrator with the manage-topics permission. Leave empty to disable every group feature."
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_notify"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("telegram.enableNotify", "Enable Notifications")}
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
                          "telegram.enableNotifyDescription",
                          "Send order and expiry notifications to users via Telegram"
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
            form="telegram-form"
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
