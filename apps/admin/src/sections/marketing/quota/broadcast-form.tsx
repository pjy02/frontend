import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Switch } from "@workspace/ui/components/switch";
import { Combobox } from "@workspace/ui/composed/combobox";
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import { Icon } from "@workspace/ui/composed/icon";
import {
  postMarketingQuotaCreate as createQuotaTask,
  postMarketingQuotaPreCount as queryQuotaTaskPreCount,
} from "@workspace/ui/services/admin/admin";
import { unitConversion } from "@workspace/ui/utils/unit-conversions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { Display } from "@/components/display";
import { useFormSafety } from "@/components/form-safety";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/settings-workspace";
import {
  EstimateStatus,
  useLatestEstimate,
} from "@/components/use-latest-estimate";
import { useSubscribe } from "@/stores/subscribe";

export default function QuotaBroadcastForm() {
  const { t } = useTranslation("marketing");

  // Define schema with internationalized error messages
  const quotaBroadcastSchema = z.object({
    subscribers: z
      .array(z.number())
      .min(1, t("pleaseSelectSubscribers", "Please select packages")),
    is_active: z.boolean(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    reset_traffic: z.boolean(),
    days: z.number().optional(),
    gift_type: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    gift_value: z.number().optional(),
  });

  type QuotaBroadcastFormData = z.infer<typeof quotaBroadcastSchema>;

  const form = useForm<QuotaBroadcastFormData>({
    resolver: zodResolver(quotaBroadcastSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      subscribers: [],
      is_active: true,
      start_time: "",
      end_time: "",
      reset_traffic: false,
      days: 0,
      gift_type: 1,
      gift_value: 0,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const safety = useFormSafety({
    form,
    open,
    onOpenChange: setOpen,
    review: true,
  });

  const { subscribes } = useSubscribe();

  // Calculate recipient count
  const calculateRecipients = async () => {
    try {
      const formData = form.getValues();
      let start_time = 0;
      let end_time = 0;

      if (formData.start_time) {
        start_time = new Date(formData.start_time).getTime();
      }

      if (formData.end_time) {
        end_time = new Date(formData.end_time).getTime();
      }

      const response = await queryQuotaTaskPreCount({
        subscribers: formData.subscribers,
        is_active: formData.is_active,
        start_time,
        end_time,
      });

      const count = response.data?.data?.count;
      if (typeof count !== "number" || !Number.isFinite(count))
        throw new Error("Recipient count unavailable");
      return count;
    } catch (error) {
      console.error("Failed to calculate recipients:", error);
      throw error;
    }
  };

  // Watch form values and recalculate recipients only when sheet is open
  const watchedValues = form.watch();

  const estimate = useLatestEstimate(
    JSON.stringify([
      watchedValues.subscribers,
      watchedValues.is_active,
      watchedValues.start_time,
      watchedValues.end_time,
    ]),
    open,
    calculateRecipients
  );

  const onSubmit = async (data: QuotaBroadcastFormData) => {
    setIsSubmitting(true);
    try {
      let start_time = 0;
      let end_time = 0;

      if (data.start_time) {
        start_time = Math.floor(new Date(data.start_time).getTime());
      }

      if (data.end_time) {
        end_time = Math.floor(new Date(data.end_time).getTime());
      }

      await createQuotaTask({
        subscribers: data.subscribers,
        is_active: data.is_active,
        start_time,
        end_time,
        reset_traffic: data.reset_traffic,
        days: data.days || 0,
        gift_type: data.gift_type,
        gift_value: data.gift_value || 0,
      });

      toast.success(
        t("quotaTaskCreatedSuccessfully", "Quota task created successfully")
      );
      await safety.completeSave();
    } catch (error) {
      console.error("Failed to create quota task:", error);
      toast.error(t("failedToCreateQuotaTask", "Failed to create quota task"));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet onOpenChange={safety.requestOpenChange} open={open}>
      <SheetTrigger asChild>
        <button
          className="flex w-full items-center justify-between text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" icon="mdi:gift" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t("quotaBroadcast", "Quota Distribution")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  "createAndSendQuotaTasks",
                  "Create and Distribute Quota Tasks"
                )}
              </p>
            </div>
          </div>
          <Icon className="size-6" icon="mdi:chevron-right" />
        </button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <SheetTitle>{t("createQuotaTask", "Create Quota Task")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100dvh-48px-36px-32px-env(safe-area-inset-top))] px-6">
          <Form {...form}>
            <form
              className="mt-4 space-y-6"
              id="quota-broadcast-form"
              onSubmit={safety.handleSubmit(onSubmit)}
            >
              {safety.summary}
              {/* Subscribers selection */}
              <FormField
                control={form.control}
                name="subscribers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("subscribers", "Packages")}</FormLabel>
                    <FormControl>
                      <Combobox
                        multiple={true}
                        onChange={field.onChange}
                        options={subscribes?.map((subscribe) => ({
                          value: subscribe.id!,
                          label: subscribe.name!,
                          children: (
                            <div>
                              <div>{subscribe.name}</div>
                              <div className="text-muted-foreground text-xs">
                                <Display
                                  type="traffic"
                                  value={subscribe.traffic || 0}
                                />{" "}
                                /{" "}
                                <Display
                                  type="currency"
                                  value={subscribe.unit_price || 0}
                                />
                              </div>
                            </div>
                          ),
                        }))}
                        placeholder={t(
                          "pleaseSelectSubscribers",
                          "Please select packages"
                        )}
                        value={field.value || []}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subscription count info and active status */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("validOnly", "Valid Only")}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          className="!mt-0 float-end"
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "selectValidSubscriptionsOnly",
                          "Select currently valid subscriptions only"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center border-l-4 border-l-primary bg-primary/10 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {t("subscriptionCount", "Subscription Count")}:{" "}
                  </span>
                  <span className="font-medium text-lg text-primary">
                    {estimate.data === undefined ? (
                      <EstimateStatus
                        error={estimate.error}
                        retry={estimate.retry}
                      />
                    ) : (
                      estimate.data.toLocaleString()
                    )}
                  </span>
                </div>
              </div>

              {/* Subscription validity period range */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          "subscriptionValidityStartDate",
                          "Subscription Validity Start Date"
                        )}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          step="1"
                          type="datetime-local"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "includeSubscriptionsValidAfter",
                          "Include subscriptions valid on or after this date"
                        )}
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(
                          "subscriptionValidityEndDate",
                          "Subscription Validity End Date"
                        )}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={field.onChange}
                          step="1"
                          type="datetime-local"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "includeSubscriptionsValidBefore",
                          "Include subscriptions valid on or before this date"
                        )}
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {/* Reset traffic */}
              <FormField
                control={form.control}
                name="reset_traffic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("resetTraffic", "Reset Traffic")}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        className="!mt-0 float-end"
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        "resetTrafficDescription",
                        "Whether to reset subscription used traffic"
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quota days */}
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("quotaDays", "Extend Expiration Days")}
                    </FormLabel>
                    <FormControl>
                      <EnhancedInput
                        min={1}
                        onValueChange={(value) =>
                          field.onChange(Number.parseInt(value, 10))
                        }
                        type="number"
                        value={field.value?.toString()}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        "numberOfDaysForTheQuota",
                        "Number of days to extend subscription expiration"
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gift configuration */}
              <FormField
                control={form.control}
                name="gift_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("giftType", "Gift Amount Type")}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        className="flex gap-4"
                        defaultValue={String(field.value)}
                        onValueChange={(value) => {
                          field.onChange(Number(value));
                          form.setValue("gift_value", 0);
                        }}
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="1" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {t("fixedAmount", "Fixed Amount")}
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="2" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {t("percentageAmount", "Percentage Amount")}
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gift amount based on type */}
              {form.watch("gift_type") === 1 && (
                <FormField
                  control={form.control}
                  name="gift_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("giftAmount", "Gift Amount")}</FormLabel>
                      <FormControl>
                        <EnhancedInput<number>
                          formatInput={(value) =>
                            unitConversion("centsToDollars", value)
                          }
                          formatOutput={(value) =>
                            unitConversion("dollarsToCents", value)
                          }
                          min={1}
                          onValueChange={(value) => field.onChange(value)}
                          placeholder={t("enterAmount", "Enter amount")}
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {form.watch("gift_type") === 2 && (
                <FormField
                  control={form.control}
                  name="gift_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("giftAmount", "Gift Amount")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          max={100}
                          min={1}
                          onValueChange={(value) => field.onChange(value)}
                          placeholder={t("enterPercentage", "Enter percentage")}
                          suffix="%"
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          "percentageAmountDescription",
                          "Gift percentage amount based on current package price"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
        </ScrollArea>
        <SheetFooter className="flex flex-row items-center justify-end gap-2 pt-3">
          <Button
            onClick={() => safety.requestOpenChange(false)}
            variant="outline"
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            disabled={
              isSubmitting ||
              !form.formState.isValid ||
              form.watch("subscribers").length === 0
            }
            form="quota-broadcast-form"
            loading={isSubmitting || safety.submitting}
            loadingLabel={t("components:actions.processing")}
            type="submit"
          >
            {t("createQuotaTask", "Create Quota Task")}
          </Button>
        </SheetFooter>
      </SheetContent>
      {safety.dialogs}
    </Sheet>
  );
}
