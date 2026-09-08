"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Icon } from "@workspace/ui/composed/icon";
import {
  getToolVersion as getServerVersion,
  getToolRestart as restartSystem,
} from "@workspace/ui/services/admin/admin";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import packageJson from "../../../../../../package.json";

export default function SystemVersionCard() {
  const { t } = useTranslation("tool");
  const [openRestart, setOpenRestart] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const {
    data: serverVersion,
    isError: isVersionError,
    isLoading: isVersionLoading,
    isFetching: isVersionFetching,
    refetch: refetchVersion,
  } = useQuery({
    queryKey: ["getServerVersion"],
    queryFn: async () => {
      const { data } = await getServerVersion({ skipErrorHandler: true });
      return data.data?.version ?? null;
    },
    retry: false,
  });

  return (
    <Card className="dashboard-card h-full gap-0 border-border/70 p-0 shadow-none">
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-base">
            {t("systemServices", "System Services")}
          </span>
          <div className="flex items-center space-x-2">
            <AlertDialog onOpenChange={setOpenRestart} open={openRestart}>
              <AlertDialogTrigger asChild>
                <Button
                  className="text-destructive hover:text-destructive"
                  size="sm"
                  variant="ghost"
                >
                  <Icon className="size-4" icon="uil:power" />
                  {t("systemReboot", "System Reboot")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("confirmSystemReboot", "Confirm System Reboot")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "rebootDescription",
                      "Are you sure you want to reboot the system? This action cannot be undone."
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel", "Cancel")}</AlertDialogCancel>
                  <Button
                    disabled={isRestarting}
                    onClick={async () => {
                      setIsRestarting(true);
                      try {
                        await restartSystem();
                        await new Promise((resolve) =>
                          setTimeout(resolve, 5000)
                        );
                        setOpenRestart(false);
                      } catch {
                        // The request layer reports the failure.
                      } finally {
                        setIsRestarting(false);
                      }
                    }}
                  >
                    {isRestarting && (
                      <Icon className="mr-2 animate-spin" icon="mdi:loading" />
                    )}
                    {isRestarting
                      ? t("rebooting", "Rebooting...")
                      : t("confirmReboot", "Confirm Reboot")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-5">
        <div className="flex flex-1 flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <Icon
              className="mr-2 h-4 w-4 text-muted-foreground"
              icon="mdi:web"
            />
            <span className="font-medium text-sm">
              {t("webVersion", "Web Version")}
            </span>
          </div>
          <div className="flex w-full items-center justify-end space-x-2 sm:w-auto">
            <Badge variant="outline">V{packageJson.version}</Badge>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <Icon
              className="mr-2 h-4 w-4 text-muted-foreground"
              icon="mdi:server"
            />
            <span className="font-medium text-sm">
              {t("serverVersion", "Server Version")}
            </span>
          </div>
          <div className="flex w-full items-center justify-end space-x-2 sm:w-auto">
            {isVersionLoading ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                <Icon className="size-3.5 animate-spin" icon="mdi:loading" />
                {t("versionLoading", "Loading...")}
              </span>
            ) : isVersionError ? (
              <Button
                className="h-7 px-2 text-destructive hover:text-destructive"
                disabled={isVersionFetching}
                onClick={async () => {
                  await refetchVersion();
                }}
                size="sm"
                variant="ghost"
              >
                <Icon
                  className={
                    isVersionFetching ? "size-3.5 animate-spin" : "size-3.5"
                  }
                  icon={isVersionFetching ? "mdi:loading" : "uil:refresh"}
                />
                {t("versionRetry", "Retry")}
              </Button>
            ) : (
              <Badge variant="outline">
                {serverVersion ? `V${serverVersion}` : "—"}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
