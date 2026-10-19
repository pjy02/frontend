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
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import { Icon } from "@workspace/ui/composed/icon";
import {
  getSystemCurrencyConfig as getCurrencyConfig,
  putSystemCurrencyConfig as updateCurrencyConfig,
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

// Constants
const EXCHANGE_RATE_HOST_URL = "https://exchangerate.host";

const currencySchema = z.object({
  access_key: z.string().optional(),
  currency_unit: z.string().min(1),
  currency_symbol: z.string().min(1),
});

type CurrencyFormData = z.infer<typeof currencySchema>;

export default function CurrencyConfig() {
  const { t } = useTranslation("system");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getCurrencyConfig"],
    queryFn: async () => {
      const { data } = await getCurrencyConfig();
      return requireReadData(data.data);
    },
    enabled: open, // Only request data when the modal is open
  });

  const { data, refetch } = readQuery;
  const form = useForm<CurrencyFormData>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      access_key: "",
      currency_unit: "USD",
      currency_symbol: "$",
    },
  });
  const safety = useFormSafety({ form, open, onOpenChange: setOpen });

  useEffect(() => {
    if (data && !safety.dirty && !safety.busy) {
      form.reset(data);
    }
  }, [data, form]);

  async function onSubmit(values: CurrencyFormData) {
    if (!readReady(readQuery)) return;
    setLoading(true);
    try {
      await updateCurrencyConfig(values as API.CurrencyConfig);
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
              <Icon className="h-5 w-5 text-primary" icon="mdi:currency-usd" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("currency.title", "Currency Configuration")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "currency.description",
                  "Configure currency units, symbols, and exchange rate API settings"
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
            {t("currency.title", "Currency Configuration")}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <ReadBoundary configuration query={readQuery}>
            <Form {...form}>
              <form
                className="space-y-2 pt-4"
                id="currency-form"
                onSubmit={safety.handleSubmit(onSubmit)}
              >
                {safety.summary}
                <FormField
                  control={form.control}
                  name="access_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("currency.accessKey", "API Key")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder={t(
                            "currency.accessKeyPlaceholder",
                            "Enter API key"
                          )}
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "currency.accessKeyDescription",
                          "Free exchange rate API key provided by {{url}}",
                          {
                            url: EXCHANGE_RATE_HOST_URL,
                          }
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("currency.currencyUnit", "Currency Unit")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder={t(
                            "currency.currencyUnitPlaceholder",
                            "USD"
                          )}
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "currency.currencyUnitDescription",
                          "Used for display purposes only; changing this will affect all currency units in the system"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency_symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("currency.currencySymbol", "Currency Symbol")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          placeholder={t(
                            "currency.currencySymbolPlaceholder",
                            "$"
                          )}
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "currency.currencySymbolDescription",
                          "Used for display purposes only; changing this will affect all currency units in the system"
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
            form="currency-form"
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
