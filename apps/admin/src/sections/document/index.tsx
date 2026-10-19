import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  deleteDocumentBatch as batchDeleteDocument,
  postDocument as createDocument,
  deleteDocument,
  getDocumentList,
  putDocument as updateDocument,
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
import DocumentForm from "./document-form";

export default function Page() {
  const { t } = useTranslation("document");
  const [loading, setLoading] = useState(false);

  const ref = useRef<ProTableActions>(null);
  return (
    <div className="space-y-5">
      <PageHeader title={t("DocumentList", "Document List")} />
      <ProTable<API.Document, { tag: string; search: string }>
        action={ref}
        actions={{
          render(row) {
            return [
              <DocumentForm<API.UpdateDocumentRequest>
                initialValues={row}
                key="edit"
                loading={loading}
                onSubmit={async (values) => {
                  setLoading(true);
                  try {
                    await updateDocument({
                      ...row,
                      ...values,
                    });
                    toast.success(t("updateSuccess", "Updated successfully"));
                    ref.current?.refresh({ reason: "edit", rowIds: [row.id] });
                    return true;
                  } catch {
                    return false;
                  } finally {
                    setLoading(false);
                  }
                }}
                title={t("editDocument", "Edit Document")}
                trigger={t("edit", "Edit")}
              />,
              <ConfirmButton
                cancelText={t("cancel", "Cancel")}
                confirmText={t("confirm", "Confirm")}
                description={t(
                  "deleteDescription",
                  "Are you sure you want to delete this document? This action cannot be undone."
                )}
                key="delete"
                onConfirm={async () => {
                  await deleteDocument({
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
                  "Are you sure you want to delete this document? This action cannot be undone."
                )}
                key="delete"
                onConfirm={async () => {
                  await batchDeleteDocument({
                    ids: rows.map((item) => item.id),
                  });
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
            cell: ({ row }) => (
              <AsyncSwitch
                checked={Boolean(row.original.show)}
                field="show"
                id={row.original.id}
                label={t("show", "Show")}
                onSync={() => synchronizeTable(ref, row.original.id)}
                onWrite={(checked) =>
                  updateDocument({
                    ...row.original,
                    show: checked,
                  })
                }
                resource="document"
                status={(value) => (
                  <EnabledStatusChip
                    disabledLabel={t("hidden", "Hidden")}
                    enabled={value}
                    enabledLabel={t("visible", "Visible")}
                  />
                )}
              />
            ),
          },
          {
            accessorKey: "title",
            header: t("title", "Title"),
          },
          {
            accessorKey: "tags",
            header: t("tags", "Tags"),
            cell: ({ row }) => (
              <div className="flex flex-wrap gap-1">
                {row.original.tags.length > 0
                  ? row.original.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))
                  : "—"}
              </div>
            ),
          },
          {
            accessorKey: "updated_at",
            header: t("updatedAt", "Updated At"),
            cell: ({ row }) => (
              <DateTimeValue value={row.getValue("updated_at")} />
            ),
          },
        ]}
        header={{
          toolbar: (
            <DocumentForm<API.CreateDocumentRequest>
              key="create"
              loading={loading}
              onSubmit={async (values) => {
                setLoading(true);
                try {
                  await createDocument({
                    ...values,
                    show: false,
                  });
                  toast.success(t("createSuccess", "Created successfully"));
                  ref.current?.refresh({ reason: "create" });
                  return true;
                } catch {
                  return false;
                } finally {
                  setLoading(false);
                }
              }}
              title={t("createDocument", "Create Document")}
              trigger={t("create", "Create")}
            />
          ),
        }}
        params={[
          {
            key: "search",
          },
          {
            key: "tag",
            placeholder: t("tags", "Tags"),
          },
        ]}
        request={async (pagination, filter, { signal }) => {
          const { data } = await getDocumentList(
            { ...pagination, ...filter },
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
