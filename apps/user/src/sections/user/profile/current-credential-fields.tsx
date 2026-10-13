"use client";

import { Button } from "@workspace/ui/components/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { AreaCodeSelect } from "@workspace/ui/composed/area-code-select";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import SendCode from "@/sections/auth/send-code";

// The backend asks for the current password when the account has one and
// otherwise for a security code sent to the bound address. The client cannot
// tell which, so the password is the default and the code is opt-in.
export type VerifyBy = "password" | "code";

interface CurrentCredentialFieldsProps {
  /** The form field that carries the current password. */
  passwordName: "password" | "old_password";
  verifyBy?: VerifyBy;
  onVerifyByChange?: (verifyBy: VerifyBy) => void;
  /** Security codes must go to the currently bound address, not the replacement. */
  email?: string;
  mobile?: string;
  disabled?: boolean;
  /** Guidance for OAuth/device-only accounts without a bound address. */
  hint?: string;
}

export default function CurrentCredentialFields({
  passwordName,
  verifyBy = "password",
  onVerifyByChange,
  email,
  mobile,
  disabled,
  hint,
}: CurrentCredentialFieldsProps) {
  const { t } = useTranslation("profile");
  const { control, setValue, clearErrors, watch } = useFormContext();

  const switchTo = (next: VerifyBy) => {
    setValue(passwordName, "");
    setValue("current_code", "");
    clearErrors([passwordName, "current_code"]);
    onVerifyByChange?.(next);
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      {verifyBy === "code" && (email || mobile) ? (
        <>
          {!email && mobile && (
            <>
              <p className="text-muted-foreground text-sm">
                {t(
                  "currentCredential.currentMobile",
                  "Enter the full current phone number ({{mobile}}), not the new number.",
                  { mobile }
                )}
              </p>
              <div className="flex">
                <FormField
                  control={control}
                  name="current_area_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <AreaCodeSelect
                          className="w-32 rounded-r-none border-r-0"
                          onChange={(value) => {
                            if (value.phone) field.onChange(value.phone);
                          }}
                          simple
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="current_mobile"
                  render={({ field }) => (
                    <FormItem className="min-w-0 flex-1">
                      <FormControl>
                        <Input
                          className="rounded-l-none"
                          disabled={disabled}
                          placeholder={t(
                            "currentCredential.mobile",
                            "Current phone number"
                          )}
                          type="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
          <FormField
            control={control}
            name="current_code"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex gap-2">
                    <Input
                      autoComplete="one-time-code"
                      disabled={disabled}
                      placeholder={t(
                        "currentCredential.code",
                        "Code sent to {{email}}",
                        { email: email || mobile }
                      )}
                      type="text"
                      {...field}
                    />
                    <SendCode
                      disabled={disabled}
                      params={
                        email
                          ? { email, type: 2 }
                          : {
                              telephone: watch("current_mobile"),
                              telephone_area_code: watch("current_area_code"),
                              type: 2,
                            }
                      }
                      type={email ? "email" : "phone"}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      ) : (
        <FormField
          control={control}
          name={passwordName}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  autoComplete="current-password"
                  disabled={disabled}
                  placeholder={t(
                    "currentCredential.password",
                    "Current password"
                  )}
                  type="password"
                  {...field}
                />
              </FormControl>
              {!(email || mobile) && hint && (
                <FormDescription>{hint}</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {(email || mobile) && (
        <Button
          className="h-auto max-w-full whitespace-normal p-0 text-left"
          disabled={disabled}
          onClick={() => switchTo(verifyBy === "code" ? "password" : "code")}
          size="sm"
          type="button"
          variant="link"
        >
          {verifyBy === "code"
            ? t("currentCredential.usePassword", "Use your current password")
            : t(
                "currentCredential.useCode",
                "No password set? Verify with a code sent to {{email}}",
                { email: email || mobile }
              )}
        </Button>
      )}
    </fieldset>
  );
}
