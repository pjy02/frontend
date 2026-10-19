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
  getSystemVerifyConfig as getVerifyConfig,
  putSystemVerifyConfig as updateVerifyConfig,
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

const verifySchema = z.object({
  turnstile_site_key: z.string().optional(),
  turnstile_secret: z.string().optional(),
  enable_register_verify: z.boolean().optional(),
  enable_login_verify: z.boolean().optional(),
  enable_reset_password_verify: z.boolean().optional(),
});

type VerifyFormData = z.infer<typeof verifySchema>;

export default function VerifyConfig() {
  const { t } = useTranslation("system");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getVerifyConfig"],
    queryFn: async () => {
      const { data } = await getVerifyConfig();
      return requireReadData(data.data);
    },
    enabled: open,
  });

  const { data, refetch } = readQuery;
  const form = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      turnstile_site_key: "",
      turnstile_secret: "",
      enable_register_verify: false,
      enable_login_verify: false,
      enable_reset_password_verify: false,
    },
  });
  const safety = useFormSafety({ form, open, onOpenChange: setOpen });

  useEffect(() => {
    if (data && !safety.dirty && !safety.busy) {
      form.reset(data);
    }
  }, [data, form]);

  async function onSubmit(values: VerifyFormData) {
    if (!readReady(readQuery)) return;
    setLoading(true);
    try {
      await updateVerifyConfig(values as API.VerifyConfig);
      toast.success(t("verify.saveSuccess", "Save Successful"));
      refetch();
      form.reset(form.getValues());
      setOpen(false);
    } catch (_error) {
      toast.error(t("verify.saveFailed", "Save Failed"));
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
              <Icon
                className="h-5 w-5 text-primary"
                icon="mdi:shield-check-outline"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("verify.title", "Security Verification")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "verify.description",
                  "Configure Turnstile CAPTCHA and verification settings"
                )}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{t("verify.title", "Security Verification")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="verify-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                <FormField
                  control={form.control}
                  name="turnstile_site_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("verify.turnstileSiteKey", "Turnstile Site Key")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder={t(
                            "verify.turnstileSiteKeyPlaceholder",
                            "Enter Turnstile site key"
                          )}
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "verify.turnstileSiteKeyDescription",
                          "Cloudflare Turnstile site key for frontend verification"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="turnstile_secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("verify.turnstileSecret", "Turnstile Secret Key")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder={t(
                            "verify.turnstileSecretPlaceholder",
                            "Enter Turnstile secret key"
                          )}
                          type="password"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "verify.turnstileSecretDescription",
                          "Cloudflare Turnstile secret key for backend verification"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_register_verify"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          "verify.enableRegisterVerify",
                          "Enable Verification on Registration"
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
                          "verify.enableRegisterVerifyDescription",
                          "When enabled, users must pass human verification during registration"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_login_verify"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          "verify.enableLoginVerify",
                          "Enable Verification on Login"
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
                          "verify.enableLoginVerifyDescription",
                          "When enabled, users must pass human verification during login"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enable_reset_password_verify"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          "verify.enablePasswordVerify",
                          "Enable Verification on Password Reset"
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
                          "verify.enablePasswordVerifyDescription",
                          "When enabled, users must pass human verification during password reset"
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
            form="verify-form"
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
