import { Button } from "@workspace/ui/components/button";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  postAnnouncement as createAnnouncement,
  deleteAnnouncement,
  getAnnouncementList,
  putAnnouncement as updateAnnouncement,
} from "@workspace/ui/services/admin/admin";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AsyncSwitch, synchronizeTable } from "@/components/async-switch";
import {
  DateTimeValue,
  EnabledStatusChip,
} from "@/components/commerce-display";
import { PageHeader } from "@/components/page-header";
import NoticeForm from "./notice-form";

export default function Page() {
  const { t } = useTranslation("announcement");
  const [loading, setLoading] = useState(false);
  const ref = useRef<ProTableActions>(null);

  return (
    <div className="space-y-5">
      <PageHeader title={t("announcementList", "Announcement List")} />
      <ProTable<API.Announcement, { enable: boolean; search: string }>
        action={ref}
        actions={{
          render(row) {
            return [
              <NoticeForm<API.Announcement>
                initialValues={row}
                key="edit"
                loading={loading}
                onSubmit={async (values) => {
                  setLoading(true);
                  try {
                    await updateAnnouncement({
                      ...row,
                      ...values,
                    });
                    toast.success(t("updateSuccess", "Updated successfully"));
                    ref.current?.refresh({ reason: "edit", rowIds: [row.id] });
                    setLoading(false);
                    return true;
                  } catch {
                    setLoading(false);
                    return false;
                  }
                }}
                title={t("editAnnouncement", "Edit Announcement")}
                trigger={t("edit", "Edit")}
              />,
              <ConfirmButton
                cancelText={t("cancel", "Cancel")}
                confirmText={t("confirm", "Confirm")}
                description={t(
                  "deleteDescription",
                  "This action cannot be undone."
                )}
                key="delete"
                onConfirm={async () => {
                  await deleteAnnouncement({
                    id: row.id,
                  });
                  toast.success(t("deleteSuccess", "Deleted successfully"));
                  ref.current?.refresh({ reason: "delete", rowIds: [row.id] });
                }}
                title={t("confirmDelete", "Confirm Delete")}
                trigger={
                  <Button variant="destructive">{t("delete", "Delete")}</Button>
                }
              />,
            ];
          },
          batchRender(rows) {
            return [
              <ConfirmButton
                cancelText={t("cancel", "Cancel")}
                confirmText={t("confirm", "Confirm")}
                description={t(
                  "deleteDescription",
                  "This action cannot be undone."
                )}
                key="delete"
                onConfirm={async () => {
                  for (const element of rows) {
                    await deleteAnnouncement({
                      id: element.id!,
                    });
                  }
                  toast.success(t("deleteSuccess", "Deleted successfully"));
                  ref.current?.refresh({
                    reason: "delete",
                    rowIds: rows.map((row) => row.id),
                  });
                }}
                title={t("confirmDelete", "Confirm Delete")}
                trigger={
                  <Button variant="destructive">{t("delete", "Delete")}</Button>
                }
              />,
            ];
          },
        }}
        columns={[
          {
            accessorKey: "show",
            header: t("show", "Show"),
            cell: ({ row }) => {
              const visible = Boolean(row.getValue("show"));
              return (
                <AsyncSwitch
                  checked={visible}
                  field="show"
                  id={row.original.id}
                  label={t("show", "Show")}
                  onSync={() => synchronizeTable(ref, row.original.id)}
                  onWrite={(checked) =>
                    updateAnnouncement({
                      ...row.original,
                      show: checked,
                    })
                  }
                  resource="announcement"
                  status={(value) => (
                    <EnabledStatusChip
                      disabledLabel={t("hide", "Hidden")}
                      enabled={value}
                      enabledLabel={t("show", "Visible")}
                    />
                  )}
                />
              );
            },
          },
          {
            accessorKey: "pinned",
            header: t("pinned", "Pinned"),
            cell: ({ row }) => (
              <AsyncSwitch
                checked={Boolean(row.original.pinned)}
                field="pinned"
                id={row.original.id}
                label={t("pinned", "Pinned")}
                onSync={() => synchronizeTable(ref, row.original.id)}
                onWrite={(checked) =>
                  updateAnnouncement({
                    ...row.original,
                    pinned: checked,
                  })
                }
                resource="announcement"
              />
            ),
          },
          {
            accessorKey: "popup",
            header: t("popup", "Popup"),
            cell: ({ row }) => (
              <AsyncSwitch
                checked={Boolean(row.original.popup)}
                field="popup"
                id={row.original.id}
                label={t("popup", "Popup")}
                onSync={() => synchronizeTable(ref, row.original.id)}
                onWrite={(checked) =>
                  updateAnnouncement({
                    ...row.original,
                    popup: checked,
                  })
                }
                resource="announcement"
              />
            ),
          },
          {
            accessorKey: "title",
            header: t("title", "Title"),
          },
          {
            accessorKey: "content",
            header: t("content", "Content"),
          },
          {
            accessorKey: "updated_at",
            header: t("updatedAt", "Updated At"),
            cell: ({ row }) => (
              <DateTimeValue
                value={row.getValue("updated_at") as number | null}
              />
            ),
          },
        ]}
        header={{
          toolbar: (
            <NoticeForm<API.CreateAnnouncementRequest>
              loading={loading}
              onSubmit={async (values) => {
                setLoading(true);
                try {
                  await createAnnouncement(values);
                  toast.success(t("createSuccess", "Created successfully"));
                  ref.current?.refresh({ reason: "create" });
                  setLoading(false);
                  return true;
                } catch {
                  setLoading(false);
                  return false;
                }
              }}
              title={t("createAnnouncement", "Create Announcement")}
              trigger={t("create", "Create")}
            />
          ),
        }}
        params={[
          {
            key: "enable",
            placeholder: t("enable", "Enable"),
            options: [
              { label: t("show", "Show"), value: "false" },
              { label: t("hide", "Hide"), value: "true" },
            ],
          },
          { key: "search" },
        ]}
        request={async (pagination, filter, { signal }) => {
          const { data } = await getAnnouncementList(
            {
              ...pagination,
              ...filter,
            },
            { signal }
          );
          return {
            list: data.data?.list || [],
            total: data.data?.total || 0,
          };
        }}
      />
    </div>
  );
}
