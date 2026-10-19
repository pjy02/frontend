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

const facebookSchema = z.object({
  enabled: z.boolean(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
});

type FacebookFormData = z.infer<typeof facebookSchema>;

export default function FacebookForm() {
  const { t } = useTranslation("auth-control");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getAuthMethodConfig", "facebook"],
    queryFn: async () => {
      const { data } = await getAuthMethodConfig({
        method: "facebook",
      });
      return requireReadData(data.data);
    },
    enabled: open,
  });

  const { data, refetch } = readQuery;
  const form = useForm<FacebookFormData>({
    resolver: zodResolver(facebookSchema),
    defaultValues: {
      enabled: false,
      client_id: "",
      client_secret: "",
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
        client_id: data.config?.client_id || "",
        client_secret: data.config?.client_secret || "",
      });
    }
  }, [data, form]);

  async function onSubmit(values: FacebookFormData) {
    if (!readReady(readQuery)) return;
    setLoading(true);
    try {
      await updateAuthMethodConfig({
        ...data,
        enabled: values.enabled,
        config: {
          ...data?.config,
          client_id: values.client_id,
          client_secret: values.client_secret,
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
              <Icon className="h-5 w-5 text-primary" icon="mdi:facebook" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("facebook.title", "Facebook Sign-In")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "facebook.description",
                  "Authenticate users with Facebook accounts"
                )}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{t("facebook.title", "Facebook Sign-In")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="facebook-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("facebook.enable", "Enable")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "facebook.enableDescription",
                          "When enabled, users can sign in with their Facebook account"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("facebook.clientId", "App ID")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="1234567890123456"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "facebook.clientIdDescription",
                          "Facebook App ID, available from Facebook Developer Portal"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("facebook.clientSecret", "App Secret")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="1234567890abcdef1234567890abcdef"
                          type="password"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "facebook.clientSecretDescription",
                          "Facebook App Secret, available from Facebook Developer Portal"
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
            form="facebook-form"
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
