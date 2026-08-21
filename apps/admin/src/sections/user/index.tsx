import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  createUser,
  deleteUser,
  getUserDetail,
  getUserList,
  updateUserBasicInfo,
} from "@workspace/ui/services/admin/user";
import {
  Layers3,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Display } from "@/components/display";
import { PageHeader } from "@/components/page-header";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/settings-workspace";
import { StatusChip } from "@/components/status-chip";
import { useSubscribe } from "@/stores/subscribe";
import { formatDate } from "@/utils/common";
import { UserDetail } from "./user-detail";
import UserForm from "./user-form";
import { AuthMethodsForm } from "./user-profile/auth-methods-form";
import { BasicInfoForm } from "./user-profile/basic-info-form";
import { NotifySettingsForm } from "./user-profile/notify-settings-form";
import UserSubscription from "./user-subscription";

export default function User() {
  const { t } = useTranslation("user");
  const [loading, setLoading] = useState(false);
  const ref = useRef<ProTableActions>(null);
  const sp = useSearch({ strict: false }) as Record<string, string | undefined>;

  const { subscribes } = useSubscribe();

  const initialFilters = {
    search: sp.search || undefined,
    user_id: sp.user_id || undefined,
    subscribe_id: sp.subscribe_id || undefined,
    user_subscribe_id: sp.user_subscribe_id || undefined,
    user_subscribe_token: sp.user_subscribe_token || undefined,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <UserForm<API.CreateUserRequest>
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await createUser(values);
                toast.success(t("createSuccess", "Created successfully"));
                ref.current?.refresh();
                return true;
              } catch {
                return false;
              } finally {
                setLoading(false);
              }
            }}
            title={t("createUser", "Create User")}
            trigger={
              <>
                <Plus />
                {t("create", "Create")}
              </>
            }
          />
        }
        description={t(
          "userListDescription",
          "Manage user access, balances, authentication methods and subscriptions."
        )}
        eyebrow={t("userManagement", "User management")}
        title={t("userList", "Users")}
      />
      <ProTable<API.User, API.GetUserListParams>
        action={ref}
        actions={{
          render: (row) => [
            <ProfileSheet
              key="profile"
              onUpdated={() => ref.current?.refresh()}
              userId={row.id}
            />,
            <SubscriptionSheet key="subscription" userId={row.id} />,
            <UserMoreActions
              key="more"
              onDeleted={() => ref.current?.refresh()}
              userId={row.id}
            />,
          ],
        }}
        columns={[
          {
            accessorKey: "enable",
            header: t("enable", "Enable"),
            cell: ({ row }) => (
              <Switch
                defaultChecked={row.getValue("enable")}
                onCheckedChange={async (checked) => {
                  const {
                    auth_methods: _auth_methods,
                    user_devices: _user_devices,
                    enable_balance_notify: _enable_balance_notify,
                    enable_login_notify: _enable_login_notify,
                    enable_subscribe_notify: _enable_subscribe_notify,
                    enable_trade_notify: _enable_trade_notify,
                    updated_at: _updated_at,
                    created_at: _created_at,
                    id,
                    ...rest
                  } = row.original;
                  await updateUserBasicInfo({
                    user_id: id,
                    ...rest,
                    enable: checked,
                  } as unknown as API.UpdateUserBasiceInfoRequest);
                  toast.success(t("updateSuccess", "Updated successfully"));
                  ref.current?.refresh();
                }}
              />
            ),
          },
          {
            accessorKey: "id",
            header: "ID",
          },
          {
            accessorKey: "deleted_at",
            header: t("isDeleted", "Deleted"),
            cell: ({ row }) => {
              const deletedAt = row.getValue("deleted_at") as
                | number
                | undefined;
              return deletedAt ? (
                <StatusChip tone="danger">{t("deleted", "Deleted")}</StatusChip>
              ) : (
                <StatusChip tone="success">{t("normal", "Normal")}</StatusChip>
              );
            },
          },
          {
            accessorKey: "auth_methods",
            header: t("userName", "Username"),
            cell: ({ row }) => {
              const method = row.original.auth_methods?.[0];
              const identifier =
                method?.auth_identifier || `User ${row.original.id}`;
              return (
                <div className="flex min-w-56 items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                    {identifier.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="max-w-52 truncate font-medium"
                      title={identifier}
                    >
                      {identifier}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <span className="uppercase">
                        {method?.auth_type || "account"}
                      </span>
                      {method?.verified ? (
                        <StatusChip
                          className="min-h-4 px-1.5 text-[10px]"
                          dot={false}
                          tone="success"
                        >
                          {t("verified", "Verified")}
                        </StatusChip>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            accessorKey: "balance",
            header: t("balance", "Balance"),
            cell: ({ row }) => (
              <Display type="currency" value={row.getValue("balance")} />
            ),
          },
          {
            accessorKey: "gift_amount",
            header: t("giftAmount", "Gift Amount"),
            cell: ({ row }) => (
              <Display type="currency" value={row.getValue("gift_amount")} />
            ),
          },
          {
            accessorKey: "commission",
            header: t("commission", "Commission"),
            cell: ({ row }) => (
              <Display type="currency" value={row.getValue("commission")} />
            ),
          },
          {
            accessorKey: "refer_code",
            header: t("inviteCode", "Invite Code"),
            cell: ({ row }) => row.getValue("refer_code") || "--",
          },
          {
            accessorKey: "referer_id",
            header: t("referer", "Referer"),
            cell: ({ row }) => <UserDetail id={row.original.referer_id} />,
          },
          {
            accessorKey: "created_at",
            header: t("createdAt", "Created At"),
            cell: ({ row }) => formatDate(row.getValue("created_at")),
          },
        ]}
        header={{}}
        initialFilters={initialFilters}
        key={JSON.stringify(initialFilters)}
        params={[
          {
            key: "search",
            placeholder: t("searchUsers", "Search email or account"),
          },
          {
            key: "subscribe_id",
            placeholder: t("subscription", "Subscription"),
            options: subscribes?.map((item) => ({
              label: item.name!,
              value: String(item.id!),
            })),
          },
          {
            key: "user_id",
            placeholder: t("userId", "User ID"),
          },
          {
            key: "user_subscribe_id",
            placeholder: t("subscriptionId", "Subscription ID"),
          },
          {
            key: "user_subscribe_token",
            placeholder: t(
              "subscriptionTokenOrUrl",
              "Subscription URL / Token / UUID"
            ),
          },
        ]}
        request={async (pagination, filter) => {
          const { data } = await getUserList({
            ...pagination,
            ...filter,
            user_subscribe_token: extractSubscribeTokenOrUuid(
              filter.user_subscribe_token
            ),
          });
          return {
            list: data.data?.list || [],
            total: data.data?.total || 0,
          };
        }}
      />
    </div>
  );
}

function extractSubscribeTokenOrUuid(value: unknown) {
  if (typeof value !== "string") {
    return;
  }
  const input = value.trim();
  if (!input) {
    return;
  }
  const queryIndex = input.indexOf("?");
  const search =
    queryIndex !== -1
      ? input.slice(queryIndex + 1).split("#", 1)[0]
      : input.startsWith("token=") || input.startsWith("uuid=")
        ? input
        : "";
  if (search) {
    const params = new URLSearchParams(search);
    const tokenOrUuid = params.get("token") ?? params.get("uuid");
    if (tokenOrUuid !== null) {
      const trimmedTokenOrUuid = tokenOrUuid.trim();
      return trimmedTokenOrUuid || undefined;
    }
  }
  return input;
}

function UserMoreActions({
  userId,
  onDeleted,
}: {
  userId: number;
  onDeleted: () => void;
}) {
  const { t } = useTranslation("user");
  const deleteRef = useRef<HTMLButtonElement>(null);
  const links = [
    { to: "/dashboard/order", label: t("orderList", "Order List") },
    { to: "/dashboard/log/login", label: t("loginLogs", "Login Logs") },
    { to: "/dashboard/log/balance", label: t("balanceLogs", "Balance Logs") },
    {
      to: "/dashboard/log/commission",
      label: t("commissionLogs", "Commission Logs"),
    },
    { to: "/dashboard/log/gift", label: t("giftLogs", "Gift Logs") },
  ] as const;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("more", "More")}
            className="size-8 rounded-full"
            size="icon"
            variant="ghost"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {links.map((item) => (
            <DropdownMenuItem asChild key={item.to}>
              <Link search={{ user_id: String(userId) }} to={item.to}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              deleteRef.current?.click();
            }}
          >
            <Trash2 />
            {t("delete", "Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmButton
        cancelText={t("cancel", "Cancel")}
        confirmText={t("confirm", "Confirm")}
        description={t("deleteDescription", "This action cannot be undone.")}
        onConfirm={async () => {
          await deleteUser({ id: userId });
          toast.success(t("deleteSuccess", "Deleted successfully"));
          onDeleted();
        }}
        title={t("confirmDelete", "Confirm Delete")}
        trigger={<Button className="hidden" ref={deleteRef} />}
      />
    </>
  );
}

function ProfileSheet({
  userId,
  onUpdated,
}: {
  userId: number;
  onUpdated?: () => void;
}) {
  const { t } = useTranslation("user");
  const [open, setOpen] = useState(false);
  const { data: user, refetch } = useQuery({
    enabled: open,
    queryKey: ["user", userId],
    queryFn: async () => {
      const { data } = await getUserDetail({ id: userId });
      return data.data as API.User;
    },
  });

  const refetchAll = async () => {
    await refetch();
    onUpdated?.();
    return Promise.resolve();
  };
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label={t("edit", "Edit")}
          className="size-8 rounded-full"
          size="icon"
          title={t("edit", "Edit")}
          variant="ghost"
        >
          <Pencil />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="admin-user-sheet w-[760px] max-w-full gap-0 md:max-w-[760px]"
        size="md"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{t("userProfile", "User Profile")}</SheetTitle>
          <SheetDescription>
            {t(
              "userProfileDescription",
              "Review identity, permissions and account settings."
            )}
          </SheetDescription>
        </SheetHeader>
        {user ? (
          <>
            <div className="flex items-center gap-3 border-b bg-muted/25 px-6 py-4">
              <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {user.auth_methods?.[0]?.auth_identifier || `User ${userId}`}
                </div>
                <div className="text-muted-foreground text-xs">ID {userId}</div>
              </div>
              <StatusChip tone={user.enable ? "success" : "neutral"}>
                {user.enable
                  ? t("enabled", "Enabled")
                  : t("disabled", "Disabled")}
              </StatusChip>
            </div>
            <Tabs className="flex min-h-0 flex-1 flex-col" defaultValue="basic">
              <TabsList className="mx-6 mt-4 grid w-[calc(100%-3rem)] grid-cols-3">
                <TabsTrigger value="basic">
                  {t("basicInfoTitle", "Basic Info")}
                </TabsTrigger>
                <TabsTrigger value="notify">
                  {t("notifySettingsTitle", "Notify Settings")}
                </TabsTrigger>
                <TabsTrigger value="auth">
                  {t("authMethodsTitle", "Auth Methods")}
                </TabsTrigger>
              </TabsList>
              <ScrollArea className="min-h-0 flex-1">
                <div className="p-6 pt-4">
                  <TabsContent className="mt-0" value="basic">
                    <BasicInfoForm refetch={refetchAll} user={user} />
                  </TabsContent>
                  <TabsContent className="mt-0" value="notify">
                    <NotifySettingsForm refetch={refetchAll} user={user} />
                  </TabsContent>
                  <TabsContent className="mt-0" value="auth">
                    <AuthMethodsForm refetch={refetchAll} user={user} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="space-y-4 p-6">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SubscriptionSheet({ userId }: { userId: number }) {
  const { t } = useTranslation("user");
  const [open, setOpen] = useState(false);
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label={t("subscription", "Subscription")}
          className="size-8 rounded-full"
          size="icon"
          title={t("subscription", "Subscription")}
          variant="ghost"
        >
          <Layers3 />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-[1100px] max-w-full gap-0 md:max-w-[1100px]"
        size="xl"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{t("subscriptionList", "Subscriptions")}</SheetTitle>
          <SheetDescription>
            {t(
              "subscriptionSheetDescription",
              "User {{id}} plans, usage and device access.",
              { id: userId }
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <UserSubscription userId={userId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
