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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { AreaCodeSelect } from "@workspace/ui/composed/area-code-select";
import { Icon } from "@workspace/ui/composed/icon";
import {
  postV1PublicUserBindOauth as bindOAuth,
  getV1PublicUserBindTelegram as bindTelegram,
  postV1PublicUserUnbindOauth as unbindOAuth,
  postV1PublicUserUnbindTelegram as unbindTelegram,
  putV1PublicUserBindEmail as updateBindEmail,
  putV1PublicUserBindMobile as updateBindMobile,
} from "@workspace/ui/services/user/user";
import { useCountDown } from "ahooks";
import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import SendCode from "@/sections/auth/send-code";
import { useGlobalStore } from "@/stores/global";
import { Logout } from "@/utils/common";
import CurrentCredentialFields, {
  type VerifyBy,
} from "./current-credential-fields";

function EmailBindDialog({
  onSuccess,
  children,
}: {
  onSuccess: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("profile");
  const { user } = useGlobalStore();
  const current = user?.auth_methods?.find(
    (auth) => auth.auth_type === "email"
  )?.auth_identifier;
  const [open, setOpen] = useState(false);
  const [verifyBy, setVerifyBy] = useState<VerifyBy>("password");
  const pending = useRef(false);

  const formSchema = z.object({
    email: z.email("Email is required"),
    code: z.string().min(4, "Verification code is required"),
    password: z.string().optional(),
    current_code: z.string().optional(),
  });

  type EmailBindFormValues = z.infer<typeof formSchema>;

  const form = useForm<EmailBindFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      code: "",
      password: "",
      current_code: "",
    },
  });

  const onSubmit = async (values: EmailBindFormValues) => {
    if (pending.current || !user) return;
    const credential = verifyBy === "code" ? "current_code" : "password";
    if (current && !values[credential]) {
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
      await updateBindEmail({
        email: values.email,
        code: values.code,
        password:
          current && verifyBy === "password"
            ? values.password || undefined
            : undefined,
        current_code:
          current && verifyBy === "code"
            ? values.current_code || undefined
            : undefined,
      });
      // Replacing a bound address ends every session of the account.
      if (current) {
        toast.success(
          t("currentCredential.signInAgain", "Updated. Please sign in again.")
        );
        Logout();
        return;
      }
      toast.success(t("thirdParty.bindSuccess", "Successfully connected"));
      await onSuccess();
      setOpen(false);
    } catch (_error) {
      toast.error(t("thirdParty.bindFailed", "Failed to connect"));
    } finally {
      pending.current = false;
    }
  };

  return (
    <Dialog
      onOpenChange={(value) => {
        if (!form.formState.isSubmitting) setOpen(value);
      }}
      open={open}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {t("thirdParty.bindEmail", "Connect Email")}
          </DialogTitle>
          <DialogDescription>
            {current
              ? t(
                  "currentCredential.replaceHint",
                  "Replacing a bound address signs out all sessions. Verify both the new address and your current credential."
                )
              : t(
                  "currentCredential.bindHint",
                  "Verify the code sent to your new address to connect it."
                )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Enter your email..."
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code..."
                        type="text"
                        {...field}
                      />
                      <SendCode
                        params={{
                          email: form.watch("email"),
                          type: 1,
                        }}
                        type="email"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {current && (
              <CurrentCredentialFields
                disabled={form.formState.isSubmitting}
                email={current}
                onVerifyByChange={setVerifyBy}
                passwordName="password"
                verifyBy={verifyBy}
              />
            )}
            <Button
              aria-busy={form.formState.isSubmitting}
              className="w-full"
              disabled={form.formState.isSubmitting || !user}
              type="submit"
            >
              {t("thirdParty.confirm", "Confirm")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MobileBindDialog({
  onSuccess,
  children,
}: {
  onSuccess: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("profile");
  const { common, user } = useGlobalStore();
  const { enable_whitelist, whitelist } = common.auth.mobile;
  const current = user?.auth_methods?.find(
    (auth) => auth.auth_type === "mobile"
  )?.auth_identifier;
  const [open, setOpen] = useState(false);

  const formSchema = z.object({
    area_code: z.string().min(1, "Area code is required"),
    mobile: z.string().min(5, "Phone number is required"),
    code: z.string().min(4, "Verification code is required"),
    password: z.string().optional(),
    current_code: z.string().optional(),
    current_area_code: z.string().optional(),
    current_mobile: z.string().optional(),
  });

  type MobileBindFormValues = z.infer<typeof formSchema>;

  const form = useForm<MobileBindFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      area_code: "1",
      mobile: "",
      code: "",
      password: "",
      current_code: "",
      current_area_code: "1",
      current_mobile: "",
    },
  });

  const [verifyBy, setVerifyBy] = useState<VerifyBy>("password");
  const pending = useRef(false);
  const onSubmit = async (values: MobileBindFormValues) => {
    if (pending.current || !user) return;
    const credential = verifyBy === "code" ? "current_code" : "password";
    if (current && !values[credential]) {
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
      await updateBindMobile({
        area_code: values.area_code,
        mobile: values.mobile,
        code: values.code,
        password:
          current && verifyBy === "password"
            ? values.password || undefined
            : undefined,
        current_code:
          current && verifyBy === "code"
            ? values.current_code || undefined
            : undefined,
      });
      // Replacing a bound address ends every session of the account.
      if (current) {
        toast.success(
          t("currentCredential.signInAgain", "Updated. Please sign in again.")
        );
        Logout();
        return;
      }
      toast.success(t("thirdParty.bindSuccess", "Successfully connected"));
      await onSuccess();
      setOpen(false);
    } catch (_error) {
      toast.error(t("thirdParty.bindFailed", "Failed to connect"));
    } finally {
      pending.current = false;
    }
  };

  return (
    <Dialog
      onOpenChange={(value) => {
        if (!form.formState.isSubmitting) setOpen(value);
      }}
      open={open}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {t("thirdParty.bindMobile", "Connect Mobile")}
          </DialogTitle>
          <DialogDescription>
            {current
              ? t(
                  "currentCredential.replaceHint",
                  "Replacing a bound address signs out all sessions. Verify both the new address and your current credential."
                )
              : t(
                  "currentCredential.bindHint",
                  "Verify the code sent to your new address to connect it."
                )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex">
                      <FormField
                        control={form.control}
                        name="area_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <AreaCodeSelect
                                className="w-32 rounded-r-none border-r-0"
                                onChange={(value) => {
                                  if (value.phone) {
                                    form.setValue(field.name, value.phone);
                                  }
                                }}
                                placeholder="Area code..."
                                simple
                                value={field.value}
                                whitelist={enable_whitelist ? whitelist : []}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Input
                        className="rounded-l-none"
                        placeholder="Enter your telephone..."
                        type="tel"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code..."
                        type="text"
                        {...field}
                      />
                      <SendCode
                        params={{
                          telephone_area_code: form.watch("area_code"),
                          telephone: form.watch("mobile"),
                          type: 1,
                        }}
                        type="phone"
                      />
                    </div>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
            {current && (
              <CurrentCredentialFields
                disabled={form.formState.isSubmitting}
                mobile={current}
                onVerifyByChange={setVerifyBy}
                passwordName="password"
                verifyBy={verifyBy}
              />
            )}
            <Button
              aria-busy={form.formState.isSubmitting}
              className="w-full"
              disabled={form.formState.isSubmitting || !user}
              type="submit"
            >
              {t("thirdParty.confirm", "Confirm")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TelegramBindDialog({
  onSuccess,
  children,
}: {
  onSuccess: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("profile");
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<API.BindTelegramResponse>();
  const [loading, setLoading] = useState(false);

  const [countDown, formattedRes] = useCountDown({
    targetDate: link?.expired_at,
  });

  const fetchTelegramLink = async () => {
    setLoading(true);
    try {
      const res = await bindTelegram();
      if (res.data?.data?.url) {
        setLink(res.data.data);
      }
    } catch (_error) {
      toast.error(t("thirdParty.bindFailed", "Failed to connect"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !link) {
      fetchTelegramLink();
    }
  };

  const { minutes, seconds } = formattedRes;

  const countdownDisplay =
    countDown > 0
      ? `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`
      : t("thirdParty.telegram.expired", "Expired");

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {t("thirdParty.bindTelegram", "Connect Telegram")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 text-center">
          {link?.url ? (
            <>
              <div className="rounded-lg bg-white p-3">
                <QRCodeCanvas size={180} value={link.url} />
              </div>
              <p className="text-muted-foreground text-sm">
                {t(
                  "thirdParty.telegram.description",
                  "Open Telegram with the button below, or scan the QR code on desktop. The link is valid for 5 minutes."
                )}
              </p>
              <p className="font-medium text-sm">
                {t("thirdParty.telegram.validFor", "Valid for")}:{" "}
                {countdownDisplay}
              </p>
              <div className="flex w-full gap-2">
                <Button asChild className="flex-1">
                  <a href={link.url} rel="noreferrer" target="_blank">
                    {t("thirdParty.telegram.open", "Open Telegram")}
                  </a>
                </Button>
                <Button
                  className="flex-1"
                  onClick={async () => {
                    await onSuccess();
                    setOpen(false);
                  }}
                  variant="outline"
                >
                  {t("thirdParty.telegram.refresh", "I have started the bot")}
                </Button>
              </div>
              {countDown <= 0 && (
                <Button
                  className="w-full"
                  disabled={loading}
                  onClick={fetchTelegramLink}
                  variant="outline"
                >
                  {t("thirdParty.telegram.refreshLink", "Get a new link")}
                </Button>
              )}
            </>
          ) : (
            <Button disabled={loading} onClick={fetchTelegramLink}>
              {loading
                ? t("thirdParty.loading", "Loading...")
                : t("thirdParty.telegram.getLink", "Get Telegram link")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type BindOAuthMethod = API.BindOAuthRequest["method"];

function isBindOAuthMethod(method: string): method is BindOAuthMethod {
  return ["google", "apple", "telegram", "github"].includes(method);
}

export default function ThirdPartyAccounts() {
  const { t } = useTranslation("profile");
  const { user, getUserInfo, common } = useGlobalStore();
  const { oauth_methods } = common;

  const accounts = [
    {
      id: "email",
      icon: "logos:mailgun-icon",
      name: "Email",
      type: "Basic",
      descriptionDefault: "Link your email address",
    },
    {
      id: "mobile",
      icon: "mdi:telephone",
      name: "Mobile",
      type: "Basic",
      descriptionDefault: "Link your mobile number",
    },
    {
      id: "telegram",
      icon: "logos:telegram",
      name: "Telegram",
      type: "OAuth",
      descriptionDefault: "Sign in with Telegram",
    },
    {
      id: "apple",
      icon: "uil:apple",
      name: "Apple",
      type: "OAuth",
      descriptionDefault: "Sign in with Apple",
    },
    {
      id: "google",
      icon: "logos:google",
      name: "Google",
      type: "OAuth",
      descriptionDefault: "Sign in with Google",
    },
    {
      id: "facebook",
      icon: "logos:facebook",
      name: "Facebook",
      type: "OAuth",
      descriptionDefault: "Sign in with Facebook",
    },
    {
      id: "github",
      icon: "uil:github",
      name: "GitHub",
      type: "OAuth",
      descriptionDefault: "Sign in with GitHub",
    },
    {
      id: "device",
      icon: "mdi:devices",
      name: "Device",
      type: "OAuth",
      descriptionDefault: "Sign in with Device ID",
    },
  ].filter(
    (account) =>
      oauth_methods?.includes(account.id) &&
      (account.type === "Basic" || isBindOAuthMethod(account.id))
  );

  const handleAccountAction = async (account: (typeof accounts)[number]) => {
    const isBound = user?.auth_methods?.find(
      (auth) => auth.auth_type === account.id
    )?.auth_identifier;
    if (isBound) {
      if (account.id === "telegram") {
        await unbindTelegram();
      } else {
        await unbindOAuth({ method: account.id });
      }
      await getUserInfo();
    } else {
      if (!isBindOAuthMethod(account.id)) {
        return;
      }
      const res = await bindOAuth({
        method: account.id,
        // Trailing slash so static hosting serves /bind/<provider>/index.html,
        // the page that folds Telegram's fragment result into the hash route.
        redirect: `${window.location.origin}/bind/${account.id}/`,
      });
      if (res.data?.data?.redirect) {
        window.location.href = res.data.data.redirect;
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("thirdParty.title", "Connected Accounts")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {accounts.map((account) => {
            const method = user?.auth_methods?.find(
              (auth) => auth.auth_type === account.id
            );
            const displayValue =
              method?.auth_identifier ||
              t(
                `thirdParty.${account.id}.description`,
                account.descriptionDefault
              );
            const bindButton = (
              <Button
                className="whitespace-nowrap"
                variant={method?.auth_identifier ? "outline" : "default"}
              >
                {t(
                  method?.auth_identifier
                    ? "thirdParty.update"
                    : "thirdParty.bind",
                  method?.auth_identifier ? "Update" : "Connect"
                )}
              </Button>
            );

            return (
              <div className="flex w-full flex-col gap-2" key={account.id}>
                <span className="flex gap-3 font-medium">
                  <Icon className="size-6" icon={account.icon} />
                  {account.name}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1 truncate bg-muted"
                    disabled
                    value={displayValue}
                  />
                  {account.id === "email" ? (
                    <EmailBindDialog onSuccess={getUserInfo}>
                      {bindButton}
                    </EmailBindDialog>
                  ) : account.id === "mobile" ? (
                    <MobileBindDialog onSuccess={getUserInfo}>
                      {bindButton}
                    </MobileBindDialog>
                  ) : account.id === "telegram" && !method?.auth_identifier ? (
                    <TelegramBindDialog onSuccess={getUserInfo}>
                      <Button className="whitespace-nowrap" variant="default">
                        {t("thirdParty.bind", "Connect")}
                      </Button>
                    </TelegramBindDialog>
                  ) : (
                    <Button
                      className="whitespace-nowrap"
                      onClick={() => handleAccountAction(account)}
                      variant={method?.auth_identifier ? "outline" : "default"}
                    >
                      {t(
                        method?.auth_identifier
                          ? "thirdParty.unbind"
                          : "thirdParty.bind",
                        method?.auth_identifier ? "Disconnect" : "Connect"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
