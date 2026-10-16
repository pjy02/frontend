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
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import { UploadImage } from "@workspace/ui/composed/upload-image";
import { putUserBasic as updateUserBasicInfo } from "@workspace/ui/services/admin/admin";
import { unitConversion } from "@workspace/ui/utils/unit-conversions";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as z from "zod";
import { useFormSafety } from "@/components/form-safety";
import { useGlobalStore } from "@/stores/global";
import {
  buildBasicInfoUpdate,
  referralPercentageSchema,
} from "@/utils/admin-form-contracts";

const basicInfoSchema = z.object({
  avatar: z.string().optional(),
  balance: z.number().optional(),
  commission: z.number().optional(),
  gift_amount: z.number().optional(),
  refer_code: z.string().optional(),
  referer_id: z.number().optional(),
  referral_percentage: referralPercentageSchema(),
  only_first_purchase: z.boolean().optional(),
  is_admin: z.boolean().optional(),
  password: z.string().optional(),
  enable: z.boolean(),
});

type BasicInfoValues = z.infer<typeof basicInfoSchema>;

function initialUserValues(user: API.User): BasicInfoValues {
  return {
    avatar: user.avatar,
    balance: user.balance,
    commission: user.commission,
    gift_amount: user.gift_amount,
    refer_code: user.refer_code,
    referer_id: user.referer_id,
    referral_percentage: user.referral_percentage,
    only_first_purchase: user.only_first_purchase,
    is_admin: user.is_admin,
    enable: user.enable,
  };
}

export function BasicInfoForm({
  user,
  refetch,
  onLeaveGuardChange,
}: {
  user: API.User;
  refetch: () => Promise<unknown>;
  onLeaveGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
}) {
  const { t } = useTranslation("user");
  const saveInFlight = useRef(false);
  const localizedSchema = basicInfoSchema.extend({
    referral_percentage: referralPercentageSchema(
      t(
        "referralPercentageInvalid",
        "Referral percentage must be between 0 and 100."
      )
    ),
  });

  const { common } = useGlobalStore();
  const { currency } = common;

  const form = useForm<BasicInfoValues>({
    resolver: zodResolver(localizedSchema),
    defaultValues: initialUserValues(user),
  });
  const { isDirty, isSubmitting } = form.formState;
  const safety = useFormSafety({
    form,
    open: true,
    onOpenChange: () => {
      /* The owning profile controls its workspace. */
    },
  });
  useEffect(() => {
    onLeaveGuardChange?.(safety.canLeave);
    return () => onLeaveGuardChange?.(null);
  }, [onLeaveGuardChange, safety.canLeave]);
  useEffect(() => {
    if (!(isDirty || isSubmitting)) {
      form.reset(initialUserValues(user));
    }
  }, [user, form.reset, isDirty, isSubmitting]);

  async function onSubmit(data: BasicInfoValues) {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    try {
      await updateUserBasicInfo(
        buildBasicInfoUpdate(
          {
            user_id: user.id,
            telegram: user.telegram,
            ...data,
          },
          form.formState.defaultValues ?? {}
        )
      );
      form.reset(data);
      toast.success(t("updateSuccess", "Updated successfully"));
      await refetch();
    } catch {
      // The request layer reports the failure; keep the edited values for retry.
    } finally {
      saveInFlight.current = false;
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={safety.handleSubmit(onSubmit)}>
        {safety.summary}
        <fieldset className="min-w-0" disabled={form.formState.isSubmitting}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("basicInfoTitle", "Basic Info")}</CardTitle>
              <Button
                loading={form.formState.isSubmitting}
                loadingLabel={t("saving", "Saving...")}
                size="sm"
                type="submit"
              >
                {t("save", "Save")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="enable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-x-2">
                    <FormLabel>
                      {t("accountEnable", "Account Enable")}
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
                name="is_admin"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-x-2">
                    <FormLabel>{t("administrator", "Administrator")}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("balance", "Balance")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          formatInput={(value) =>
                            unitConversion("centsToDollars", value)
                          }
                          formatOutput={(value) =>
                            unitConversion("dollarsToCents", value)
                          }
                          min={0}
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                          prefix={currency?.currency_symbol ?? "$"}
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("commission", "Commission")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          formatInput={(value) =>
                            unitConversion("centsToDollars", value)
                          }
                          formatOutput={(value) =>
                            unitConversion("dollarsToCents", value)
                          }
                          min={0}
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                          prefix={currency?.currency_symbol ?? "$"}
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gift_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("giftAmount", "Gift Amount")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          formatInput={(value) =>
                            unitConversion("centsToDollars", value)
                          }
                          formatOutput={(value) =>
                            unitConversion("dollarsToCents", value)
                          }
                          min={0}
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                          prefix={currency?.currency_symbol ?? "$"}
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="refer_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("referralCode", "Referral Code")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("referrerUserId", "Referrer User ID")}
                      </FormLabel>
                      <FormControl>
                        <EnhancedInput
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                          type="number"
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="referral_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("referralPercentage", "Referral Percentage")}
                    </FormLabel>
                    <FormControl>
                      <EnhancedInput
                        max={100}
                        min={0}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        suffix="%"
                        type="number"
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="only_first_purchase"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-x-2">
                    <FormLabel>
                      {t("onlyFirstPurchase", "First Purchase Only")}
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
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("avatar", "Avatar")}</FormLabel>
                    <FormControl>
                      <EnhancedInput
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        suffix={
                          <UploadImage
                            className="h-9 rounded-none border-none bg-muted px-2"
                            onChange={(value) =>
                              form.setValue("avatar", value as string, {
                                shouldDirty: true,
                              })
                            }
                            returnType="base64"
                          />
                        }
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("password", "Password")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          "passwordPlaceholder",
                          "Enter new password"
                        )}
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </fieldset>
      </form>
      {safety.dialogs}
    </Form>
  );
}
