"use client";

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
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { putV1PublicUserPassword as updateUserPassword } from "@workspace/ui/services/user/user";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useGlobalStore } from "@/stores/global";
import { Logout } from "@/utils/common";
import CurrentCredentialFields, {
  type VerifyBy,
} from "./current-credential-fields";

export default function ChangePassword() {
  const { t } = useTranslation("profile");
  const { user } = useGlobalStore();
  const mobile = user?.auth_methods?.find(
    (auth) => auth.auth_type === "mobile"
  )?.auth_identifier;
  const email = user?.auth_methods?.find(
    (auth) => auth.auth_type === "email"
  )?.auth_identifier;
  const [verifyBy, setVerifyBy] = useState<VerifyBy>("password");
  const pending = useRef(false);
  const FormSchema = z
    .object({
      old_password: z.string().optional(),
      current_code: z.string().optional(),
      current_area_code: z.string().optional(),
      current_mobile: z.string().optional(),
      password: z.string().min(6),
      repeat_password: z.string(),
    })
    .refine((data) => data.password === data.repeat_password, {
      message: t("accountSettings.passwordMismatch", "Passwords do not match"),
      path: ["repeat_password"],
    });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      old_password: "",
      current_code: "",
      current_area_code: "1",
      current_mobile: "",
      password: "",
      repeat_password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (pending.current || !user) return;
    // OAuth/device-only accounts can set a first password without a code.
    const credential = verifyBy === "code" ? "current_code" : "old_password";
    if ((email || mobile) && !data[credential]) {
      form.setError(credential, {
        message:
          verifyBy === "code"
            ? t("currentCredential.codeRequired", "Enter the verification code")
            : t(
                "currentCredential.passwordRequired",
                "Enter your current password"
              ),
      });
      return;
    }
    pending.current = true;
    try {
      const response = await updateUserPassword({
        password: data.password,
        old_password:
          verifyBy === "password" ? data.old_password || undefined : undefined,
        current_code:
          verifyBy === "code" ? data.current_code || undefined : undefined,
      });
      // The change ends every session of the account, this one included.
      toast.success(
        t("currentCredential.signInAgain", "Updated. Please sign in again.")
      );
      const bindings = response.data.data?.third_party_bindings;
      if (bindings?.length)
        toast.warning(
          t(
            "currentCredential.bindingsRemain",
            "Third-party sign-in remains connected: {{providers}}. Review Connected Accounts and remove any unfamiliar bindings after signing in again.",
            { providers: bindings.join(", ") }
          ),
          { duration: 20_000 }
        );
      Logout();
    } catch {
      // Keep all fields for retry; the request layer reports the error.
    } finally {
      pending.current = false;
    }
  }

  return (
    <Card className="min-w-80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {t("accountSettings.accountSettings", "Password Settings")}
          <Button
            aria-busy={form.formState.isSubmitting}
            disabled={form.formState.isSubmitting || !user}
            form="password-form"
            size="sm"
            type="submit"
          >
            {t("accountSettings.updatePassword", "Update Password")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4"
            id="password-form"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <CurrentCredentialFields
              disabled={form.formState.isSubmitting}
              email={email}
              hint={
                mobile
                  ? undefined
                  : t(
                      "currentCredential.firstPassword",
                      "Leave empty when setting your first password."
                    )
              }
              mobile={mobile}
              onVerifyByChange={setVerifyBy}
              passwordName="old_password"
              verifyBy={verifyBy}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={t(
                        "accountSettings.newPassword",
                        "New Password"
                      )}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="repeat_password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={t(
                        "accountSettings.repeatNewPassword",
                        "Repeat New Password"
                      )}
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
