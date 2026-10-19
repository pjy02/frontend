import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form";
import { Switch } from "@workspace/ui/components/switch";
import { putUserNotify as updateUserNotifySetting } from "@workspace/ui/services/admin/admin";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as z from "zod";
import { type FormLeaveGuard, useFormSafety } from "@/components/form-safety";

const notifySettingsSchema = z.object({
  enable_balance_notify: z.boolean(),
  enable_login_notify: z.boolean(),
  enable_subscribe_notify: z.boolean(),
  enable_trade_notify: z.boolean(),
});

type NotifySettingsValues = z.infer<typeof notifySettingsSchema>;

export function NotifySettingsForm({
  user,
  refetch,
  open = true,
  onLeaveGuardChange,
}: {
  user: API.User;
  refetch: () => Promise<unknown>;
  open?: boolean;
  onLeaveGuardChange?: (guard: FormLeaveGuard | null) => void;
}) {
  const { t } = useTranslation("user");

  const form = useForm<NotifySettingsValues>({
    resolver: zodResolver(notifySettingsSchema),
    defaultValues: {
      enable_balance_notify: user.enable_balance_notify,
      enable_login_notify: user.enable_login_notify,
      enable_subscribe_notify: user.enable_subscribe_notify,
      enable_trade_notify: user.enable_trade_notify,
    },
  });
  const safety = useFormSafety({
    form,
    open,
    navigationGuard: !onLeaveGuardChange,
    onOpenChange: () => {
      /* Profile owns the workspace. */
    },
  });
  useEffect(() => {
    onLeaveGuardChange?.(safety.canLeave);
    return () => onLeaveGuardChange?.(null);
  }, [onLeaveGuardChange, safety.canLeave]);
  useEffect(() => {
    if (safety.dirty || safety.busy || safety.syncFailed || !open) return;
    form.reset({
      enable_balance_notify: user.enable_balance_notify,
      enable_login_notify: user.enable_login_notify,
      enable_subscribe_notify: user.enable_subscribe_notify,
      enable_trade_notify: user.enable_trade_notify,
    });
  }, [user, open]);

  async function onSubmit(data: NotifySettingsValues) {
    await updateUserNotifySetting({
      ...data,
      user_id: user.id,
    });
    form.reset(data);
    toast.success(t("updateSuccess", "Updated successfully"));
    await safety.synchronize(refetch);
  }

  return (
    <Form {...form}>
      <form onSubmit={safety.handleSubmit(onSubmit)}>
        {safety.summary}
        <fieldset
          className="min-w-0"
          disabled={safety.busy || safety.syncFailed}
        >
          <Card className="admin-user-profile-section">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {t("notifySettingsTitle", "Notify Settings")}
              </CardTitle>
              <Button loading={safety.submitting} size="sm" type="submit">
                {t("save", "Save")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="enable_balance_notify"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-x-2">
                      <FormLabel>
                        {t("balanceNotifications", "Balance Notifications")}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_login_notify"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-x-2">
                      <FormLabel>
                        {t("loginNotifications", "Login Notifications")}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_subscribe_notify"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-x-2">
                      <FormLabel>
                        {t(
                          "subscriptionNotifications",
                          "Subscription Notifications"
                        )}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_trade_notify"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-x-2">
                      <FormLabel>
                        {t("tradeNotifications", "Trade Notifications")}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </fieldset>
      </form>
      {safety.dialogs}
    </Form>
  );
}
