import type { ProTableActions } from "@workspace/ui/composed/pro-table/pro-table";
import type { RefObject } from "react";
import SubscribeTable from "./subscribe-table";

export default function Product({
  actionRef,
}: {
  actionRef?: RefObject<ProTableActions | null>;
}) {
  return <SubscribeTable actionRef={actionRef} />;
}
