import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@workspace/ui/components/badge";
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
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  deleteUserAuthMethod,
  postUserAuthMethod,
  putUserAuthMethod,
} from "@workspace/ui/services/admin/admin";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { type FormLeaveGuard, useFormSafety } from "@/components/form-safety";

export function AuthMethodsForm({
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
  const emailMethod = user.auth_methods.find(
    (method) => method.auth_type === "email"
  );
  const otherMethods = user.auth_methods.filter(
    (method) => method.auth_type !== "email"
  );
  const form = useForm({
    defaultValues: { email: emailMethod?.auth_identifier || "" },
    resolver: zodResolver(
      z.object({
        email: z
          .string()
          .email(t("invalidEmail", "Enter a valid email address")),
      })
    ),
  });
  const removalLock = useRef(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const safety = useFormSafety({
    form,
    open,
    navigationGuard: !onLeaveGuardChange,
    review: true,
    externalBusy: Boolean(removing),
    onOpenChange: () => {
      /* Profile owns the workspace. */
    },
  });
  useEffect(() => {
    onLeaveGuardChange?.(safety.canLeave);
    return () => onLeaveGuardChange?.(null);
  }, [onLeaveGuardChange, safety.canLeave]);
  useEffect(() => {
    if (!open || safety.dirty || safety.busy || safety.syncFailed) return;
    form.reset({ email: emailMethod?.auth_identifier || "" });
  }, [user, open]);

  const saveEmail = async ({ email }: { email: string }) => {
    const body = {
      user_id: user.id,
      auth_type: "email",
      auth_identifier: email,
    };
    if (emailMethod) await putUserAuthMethod(body);
    else await postUserAuthMethod(body);
    form.reset({ email });
    toast.success(
      emailMethod
        ? t("updateSuccess", "Updated successfully")
        : t("createSuccess", "Created successfully")
    );
    await safety.synchronize(refetch);
  };
  const remove = async (authType: string) => {
    if (removalLock.current || safety.busy || safety.syncFailed) return false;
    removalLock.current = true;
    setRemoving(authType);
    try {
      await deleteUserAuthMethod({ user_id: user.id, auth_type: authType });
      toast.success(t("deleteSuccess", "Deleted successfully"));
      await safety.synchronize(refetch);
    } finally {
      removalLock.current = false;
      setRemoving(null);
    }
  };
  return (
    <Form {...form}>
      <form onSubmit={safety.handleSubmit(saveEmail)}>
        {safety.summary}
        <Card className="admin-user-profile-section">
          <CardHeader>
            <CardTitle>{t("authMethodsTitle", "Auth Methods")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <fieldset
              className="min-w-0 space-y-6"
              disabled={safety.busy || safety.syncFailed}
            >
              <section className="admin-profile-detail-section space-y-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>{t("email", "Email")}</FormLabel>
                        <Badge
                          variant={
                            emailMethod?.verified ? "default" : "destructive"
                          }
                        >
                          {emailMethod?.verified
                            ? t("verified", "Verified")
                            : t("unverified", "Unverified")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="off"
                            placeholder={t("pleaseEnterEmail", "Enter email")}
                            type="email"
                          />
                        </FormControl>
                        <Button
                          disabled={!safety.dirty}
                          loading={safety.submitting}
                          type="submit"
                        >
                          {emailMethod
                            ? t("update", "Update")
                            : t("add", "Add")}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
              {otherMethods.map((method) => (
                <section
                  className="admin-profile-detail-section space-y-3"
                  key={method.auth_type}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium uppercase">
                      {method.auth_type}
                    </div>
                    <Badge
                      variant={method.verified ? "default" : "destructive"}
                    >
                      {method.verified
                        ? t("verified", "Verified")
                        : t("unverified", "Unverified")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1 break-all text-muted-foreground text-sm">
                      {method.auth_identifier}
                    </div>
                    <ConfirmButton
                      description={t(
                        "removeAuthDescription",
                        "This sign-in method will no longer be available to this user."
                      )}
                      onConfirm={() => remove(method.auth_type)}
                      title={t(
                        "removeAuthTitle",
                        "Remove authentication method?"
                      )}
                      trigger={
                        <Button
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          loading={removing === method.auth_type}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("remove", "Remove")}
                        </Button>
                      }
                    />
                  </div>
                </section>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      </form>
      {safety.dialogs}
    </Form>
  );
}
