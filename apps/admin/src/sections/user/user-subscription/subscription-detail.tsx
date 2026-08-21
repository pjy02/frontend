import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import { ProTable } from "@workspace/ui/composed/pro-table/pro-table";
import {
  getUserSubscribeDevices,
  kickOfflineByUserDevice,
} from "@workspace/ui/services/admin/user";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IpLink } from "@/components/ip-link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/settings-workspace";
import { StatusChip } from "@/components/status-chip";
import { formatDate } from "@/utils/common";

export function SubscriptionDetail({
  trigger,
  userId,
  subscriptionId,
}: {
  trigger: ReactNode;
  userId: number;
  subscriptionId: number;
}) {
  const { t } = useTranslation("user");
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className="w-[820px] max-w-full gap-0 md:max-w-[820px]"
        size="lg"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{t("onlineDevices", "Online Devices")}</SheetTitle>
          <SheetDescription>
            {t(
              "onlineDevicesDescription",
              "Review active sessions and revoke device access when needed."
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <ProTable<API.UserDevice, Record<string, unknown>>
            actions={{
              render: (row) => {
                if (!row.identifier) return [];
                return [
                  <ConfirmButton
                    cancelText={t("cancel", "Cancel")}
                    confirmText={t("confirm", "Confirm")}
                    description={t(
                      "kickOfflineConfirm",
                      `Kick device ${row.ip} offline?`
                    )}
                    key="offline"
                    onConfirm={async () => {
                      await kickOfflineByUserDevice({ id: row.id });
                      toast.success(
                        t("kickOfflineSuccess", "Device kicked offline")
                      );
                    }}
                    title={t("confirmOffline", "Confirm Offline")}
                    trigger={
                      <Button variant="destructive">
                        {t("confirmOffline", "Confirm Offline")}
                      </Button>
                    }
                  />,
                ];
              },
            }}
            columns={[
              {
                accessorKey: "enabled",
                header: t("enable", "Enable"),
                cell: ({ row }) => (
                  <Switch
                    checked={row.getValue("enabled")}
                    onChange={(checked) => {
                      console.log("Switch:", checked);
                    }}
                  />
                ),
              },
              { accessorKey: "id", header: "ID" },
              { accessorKey: "identifier", header: "IMEI" },
              {
                accessorKey: "user_agent",
                header: t("userAgent", "User Agent"),
              },
              {
                accessorKey: "ip",
                header: "IP",
                cell: ({ row }) => <IpLink ip={row.getValue("ip")} />,
              },
              {
                accessorKey: "online",
                header: t("loginStatus", "Login Status"),
                cell: ({ row }) => (
                  <StatusChip
                    tone={row.getValue("online") ? "success" : "neutral"}
                  >
                    {row.getValue("online")
                      ? t("online", "Online")
                      : t("offline", "Offline")}
                  </StatusChip>
                ),
              },
              {
                accessorKey: "updated_at",
                header: t("lastSeen", "Last Seen"),
                cell: ({ row }) => formatDate(row.getValue("updated_at")),
              },
            ]}
            request={async (pagination) => {
              const { data } = await getUserSubscribeDevices({
                user_id: userId,
                subscribe_id: subscriptionId,
                ...pagination,
              });
              return {
                list: data.data?.list || [],
                total: data.data?.total || 0,
              };
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
