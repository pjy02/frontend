"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { getNodeConfig } from "@workspace/ui/services/admin/system";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  WorkspaceDialog,
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";

type Props = {
  server: API.Server;
};

export default function ServerInstall({ server }: Props) {
  const { t } = useTranslation("servers");
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");

  const { data: cfgResp } = useQuery({
    queryKey: ["getNodeConfig"],
    queryFn: async () => {
      const { data } = await getNodeConfig();
      return data.data as API.NodeConfig | undefined;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      const host = localStorage.getItem("API_HOST") ?? window.location.origin;
      setDomain(host);
    }
  }, [open]);

  const installCommand = useMemo(() => {
    const secret = cfgResp?.node_secret ?? "";
    return `wget -N https://raw.githubusercontent.com/perfect-panel/ppanel-node/master/scripts/install.sh && bash install.sh --api-host ${domain} --server-id ${server.id} --secret-key ${secret}`;
  }, [domain, server.id, cfgResp?.node_secret]);

  async function handleCopy() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(installCommand);
      } else {
        // fallback for environments without clipboard API
        const el = document.createElement("textarea");
        el.value = installCommand;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      toast.success(t("copied", "Copied"));
      setOpen(false);
    } catch {
      toast.error(t("copyFailed", "Copy failed"));
    }
  }

  const onDomainChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
    localStorage.setItem("API_HOST", e.target.value);
  }, []);
  return (
    <WorkspaceDialog onOpenChange={setOpen} open={open}>
      <WorkspaceDialogTrigger asChild>
        <Button variant="secondary">{t("connect", "Connect")}</Button>
      </WorkspaceDialogTrigger>

      <WorkspaceDialogContent size="md">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>
            {t("oneClickInstall", "One-click Install")}
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>
            {server.name} · {server.address}
          </WorkspaceDialogDescription>
        </WorkspaceDialogHeader>

        <WorkspaceDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t("apiHost", "API Host")}</Label>
            <div className="flex items-center gap-2">
              <Input
                onChange={onDomainChange}
                placeholder={t("apiHostPlaceholder", "http(s)://example.com")}
                value={domain}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("installCommand", "Install command")}</Label>
            <div className="flex flex-col gap-2">
              <textarea
                aria-label={t("installCommand", "Install command")}
                className="min-h-32 w-full resize-none rounded-xl border bg-muted/35 p-4 font-mono text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                readOnly
                value={installCommand}
              />
            </div>
          </div>
        </WorkspaceDialogBody>

        <WorkspaceDialogFooter className="flex-row justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="outline">
            {t("close", "Close")}
          </Button>
          <Button onClick={handleCopy}>
            {t("copyAndClose", "Copy and Close")}
          </Button>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </WorkspaceDialog>
  );
}
