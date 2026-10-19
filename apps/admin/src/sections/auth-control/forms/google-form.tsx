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

const googleSchema = z.object({
  id: z.number(),
  method: z.string().default("google").optional(),
  enabled: z.boolean().default(false).optional(),
  config: z
    .object({
      client_id: z.string().optional(),
      client_secret: z.string().optional(),
    })
    .optional(),
});

type GoogleFormData = z.infer<typeof googleSchema>;

export default function GoogleForm() {
  const { t } = useTranslation("auth-control");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getAuthMethodConfig", "google"],
    queryFn: async () => {
      const { data } = await getAuthMethodConfig({
        method: "google",
      });
      return requireReadData(data.data);
    },
    enabled: open,
  });

  const { data, refetch } = readQuery;
  const form = useForm<GoogleFormData>({
    resolver: zodResolver(googleSchema),
    defaultValues: {
      id: 0,
      method: "google",
      enabled: false,
      config: {
        client_id: "",
        client_secret: "",
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

  async function onSubmit(values: GoogleFormData) {
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

  return (
    <Sheet onOpenChange={safety.requestOpenChange} open={open}>
      <SheetTrigger asChild>
        <button
          className="flex w-full items-center justify-between text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" icon="mdi:google" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("google.title", "Google Sign-In")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "google.description",
                  "Authenticate users with Google accounts"
                )}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{t("google.title", "Google Sign-In")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="google-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("google.enable", "Enable")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "google.enableDescription",
                          "When enabled, users can sign in with their Google account"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("google.clientId", "Client ID")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="123456789-abc123def456.apps.googleusercontent.com"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "google.clientIdDescription",
                          "Google OAuth Client ID, available from Google Cloud Console"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="config.client_secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("google.clientSecret", "Client Secret")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          type="password"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "google.clientSecretDescription",
                          "Google OAuth Client Secret, available from Google Cloud Console"
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
            form="google-form"
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
