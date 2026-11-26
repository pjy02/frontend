"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Textarea } from "@workspace/ui/components/textarea";
import { ArrayInput } from "@workspace/ui/composed/dynamic-Inputs";
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import { Icon } from "@workspace/ui/composed/icon";
import {
  getSystemNodeConfig as getNodeConfig,
  putSystemNodeConfig as updateNodeConfig,
} from "@workspace/ui/services/admin/admin";
import { unitConversion } from "@workspace/ui/utils/unit-conversions";
import { DicesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useFormSafety } from "@/components/form-safety";
import {
  ReadBoundary,
  readReady,
  requireReadData,
} from "@/components/read-boundary";
import {
  WorkspaceDialog,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";
import {
  normalizeOutboundConfig,
  outboundConfigSchema,
} from "./outbound-config";
import { OutboundConfigInput } from "./outbound-config-input";

const dnsConfigSchema = z.object({
  proto: z.string(), // z.enum(['tcp', 'udp', 'tls', 'https', 'quic']),
  address: z.string(),
  server_name: z.string().optional(),
  domains: z.array(z.string()),
});

const nodeConfigSchema = z.object({
  node_secret: z.string().optional(),
  node_pull_interval: z.number().optional(),
  node_push_interval: z.number().optional(),
  traffic_report_threshold: z.number().optional(),
  ip_strategy: z.enum(["prefer_ipv4", "prefer_ipv6"]).optional(),
  dns: z.array(dnsConfigSchema).optional(),
  block: z.array(z.string()).optional(),
  outbound: z.array(outboundConfigSchema).optional(),
});
type NodeConfigFormData = z.infer<typeof nodeConfigSchema>;

function generateNodeSecret() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) % 16) + 64;
  bytes[8] = ((bytes[8] ?? 0) % 64) + 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function ServerConfig() {
  const { t } = useTranslation("servers");
  const [open, setOpen] = useState(false);

  const readQuery = useQuery({
    queryKey: ["getNodeConfig"],
    queryFn: async () => {
      const { data } = await getNodeConfig();
      return requireReadData(data.data);
    },
    enabled: open,
  });
  const { data: cfgResp, refetch: refetchCfg } = readQuery;

  const form = useForm<NodeConfigFormData>({
    resolver: zodResolver(nodeConfigSchema),
    defaultValues: {
      node_secret: "",
      node_pull_interval: undefined,
      node_push_interval: undefined,
      traffic_report_threshold: undefined,
      ip_strategy: "prefer_ipv4",
      dns: [],
      block: [],
      outbound: [],
    },
  });
  const safety = useFormSafety({
    form,
    open,
    onOpenChange: setOpen,
    review: true,
  });

  useEffect(() => {
    if (cfgResp && !safety.dirty && !safety.busy) {
      form.reset({
        node_secret: cfgResp.node_secret ?? "",
        node_pull_interval: cfgResp.node_pull_interval as number | undefined,
        node_push_interval: cfgResp.node_push_interval as number | undefined,
        traffic_report_threshold: cfgResp.traffic_report_threshold as
          | number
          | undefined,
        ip_strategy:
          (cfgResp.ip_strategy as "prefer_ipv4" | "prefer_ipv6" | undefined) ||
          "prefer_ipv4",
        dns: cfgResp.dns || [],
        block: cfgResp.block || [],
        outbound: cfgResp.outbound || [],
      });
    }
  }, [cfgResp, form]);

  async function onSubmit(values: NodeConfigFormData) {
    if (!readReady(readQuery)) return;
    await updateNodeConfig({
      ...values,
      outbound: (values.outbound || []).map((item) =>
        normalizeOutboundConfig(item)
      ),
    } as API.NodeConfig);
    toast.success(t("server_config.saveSuccess", "Saved successfully"));
    await safety.completeSave();
    refetchCfg();
  }

  return (
    <WorkspaceDialog onOpenChange={safety.requestOpenChange} open={open}>
      <WorkspaceDialogTrigger asChild>
        <button
          className="w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <Card className="admin-server-shortcut h-full">
            <CardContent className="admin-server-shortcut__content">
              <div className="flex cursor-pointer items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon
                      className="h-5 w-5 text-primary"
                      icon="mdi:resistor-nodes"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {t("server_config.title", "Node configuration")}
                    </p>
                    <p className="truncate text-muted-foreground text-sm">
                      {t(
                        "server_config.description",
                        "Manage node communication keys, pull/push intervals."
                      )}
                    </p>
                  </div>
                </div>
                <Icon className="size-6" icon="mdi:chevron-right" />
              </div>
            </CardContent>
          </Card>
        </button>
      </WorkspaceDialogTrigger>

      <WorkspaceDialogContent size="xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>
            {t("server_config.title", "Node configuration")}
          </WorkspaceDialogTitle>
        </WorkspaceDialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-5 py-5 sm:px-7 sm:py-6">
          <ReadBoundary configuration query={readQuery}>
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">
                  {t("server_config.tabs.basic", "Basic Configuration")}
                </TabsTrigger>
                <TabsTrigger value="dns">
                  {t("server_config.tabs.dns", "DNS Configuration")}
                </TabsTrigger>
                <TabsTrigger value="outbound">
                  {t("server_config.tabs.outbound", "Outbound Rules")}
                </TabsTrigger>
                <TabsTrigger value="block">
                  {t("server_config.tabs.block", "Block Rules")}
                </TabsTrigger>
              </TabsList>

              <Form {...form}>
                <form
                  className="mt-4"
                  id="server-config-form"
                  onSubmit={safety.handleSubmit(onSubmit)}
                >
                  {safety.summary}
                  <TabsContent className="space-y-4" value="basic">
                    <FormField
                      control={form.control}
                      name="node_secret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "server_config.fields.communication_key",
                              "Communication key"
                            )}
                          </FormLabel>
                          <FormControl>
                            <EnhancedInput
                              onValueChange={field.onChange}
                              placeholder={t(
                                "server_config.fields.communication_key_placeholder",
                                "Please enter"
                              )}
                              suffix={
                                <div className="flex h-9 items-center bg-muted px-3">
                                  <DicesIcon
                                    className="cursor-pointer"
                                    onClick={() => {
                                      form.setValue(
                                        "node_secret",
                                        generateNodeSecret()
                                      );
                                    }}
                                  />
                                </div>
                              }
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            {t(
                              "server_config.fields.communication_key_desc",
                              "Used for node authentication."
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="node_pull_interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "server_config.fields.node_pull_interval",
                              "Node pull interval"
                            )}
                          </FormLabel>
                          <FormControl>
                            <EnhancedInput
                              min={0}
                              onValueChange={field.onChange}
                              placeholder={t(
                                "server_config.fields.communication_key_placeholder",
                                "Please enter"
                              )}
                              suffix="S"
                              type="number"
                              value={field.value as number | undefined}
                            />
                          </FormControl>
                          <FormDescription>
                            {t(
                              "server_config.fields.node_pull_interval_desc",
                              "How often the node pulls configuration (seconds)."
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="node_push_interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "server_config.fields.node_push_interval",
                              "Node push interval"
                            )}
                          </FormLabel>
                          <FormControl>
                            <EnhancedInput
                              min={0}
                              onValueChange={field.onChange}
                              placeholder={t(
                                "server_config.fields.communication_key_placeholder",
                                "Please enter"
                              )}
                              step={0.1}
                              suffix="S"
                              type="number"
                              value={field.value as number | undefined}
                            />
                          </FormControl>
                          <FormDescription>
                            {t(
                              "server_config.fields.node_push_interval_desc",
                              "How often the node pushes stats (seconds)."
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="traffic_report_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "server_config.fields.traffic_report_threshold",
                              "Traffic Report Threshold"
                            )}
                          </FormLabel>
                          <FormControl>
                            <EnhancedInput
                              min={0}
                              onValueChange={(value) => {
                                field.onChange(
                                  unitConversion("mbToBits", value)
                                );
                              }}
                              placeholder="1"
                              suffix="MB"
                              type="number"
                              value={unitConversion(
                                "bitsToMb",
                                field.value as number | undefined
                              )}
                            />
                          </FormControl>
                          <FormDescription>
                            {t(
                              "server_config.fields.traffic_report_threshold_desc",
                              "Set the minimum threshold for traffic reporting."
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent className="space-y-4" value="dns">
                    <FormField
                      control={form.control}
                      name="ip_strategy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "server_config.fields.ip_strategy",
                              "IP Strategy"
                            )}
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    "server_config.fields.ip_strategy_placeholder",
                                    "Select IP strategy"
                                  )}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="prefer_ipv4">
                                {t(
                                  "server_config.fields.ip_strategy_ipv4",
                                  "Prefer IPv4"
                                )}
                              </SelectItem>
                              <SelectItem value="prefer_ipv6">
                                {t(
                                  "server_config.fields.ip_strategy_ipv6",
                                  "Prefer IPv6"
                                )}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t(
                              "server_config.fields.ip_strategy_desc",
                              "Choose IP version preference for network connections"
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dns"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t(
                              "server_config.fields.dns_config",
                              "DNS Configuration"
                            )}
                          </FormLabel>
                          <FormControl>
                            <ArrayInput
                              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                              fields={[
                                {
                                  name: "proto",
                                  type: "select",
                                  placeholder: t(
                                    "server_config.fields.dns_proto_placeholder",
                                    "Select type"
                                  ),
                                  options: [
                                    { label: "TCP", value: "tcp" },
                                    { label: "UDP", value: "udp" },
                                    { label: "TLS", value: "tls" },
                                    { label: "HTTPS", value: "https" },
                                    { label: "QUIC", value: "quic" },
                                  ],
                                },
                                {
                                  name: "address",
                                  type: "text",
                                  placeholder: "8.8.8.8:53",
                                },
                                {
                                  name: "server_name",
                                  type: "text",
                                  placeholder: t(
                                    "server_config.fields.dns_server_name_placeholder",
                                    "TLS server name (optional)"
                                  ),
                                },
                                {
                                  name: "domains",
                                  type: "textarea",
                                  className: "col-span-2",
                                  placeholder: t(
                                    "server_config.fields.dns_domains_placeholder",
                                    "One domain rule per line"
                                  ),
                                },
                              ]}
                              onChange={(values) => {
                                const converted = values.map((item: any) => ({
                                  proto: item.proto,
                                  address: item.address,
                                  server_name: item.server_name || "",
                                  domains:
                                    typeof item.domains === "string"
                                      ? item.domains
                                          .split("\n")
                                          .map((d: string) => d.trim())
                                      : item.domains || [],
                                }));
                                field.onChange(converted);
                              }}
                              value={(field.value || []).map((item) => ({
                                ...item,
                                domains: Array.isArray(item.domains)
                                  ? item.domains.join("\n")
                                  : "",
                              }))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent className="space-y-4" value="outbound">
                    <FormField
                      control={form.control}
                      name="outbound"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <OutboundConfigInput
                              onChange={(values) => {
                                field.onChange(
                                  values.map((item) =>
                                    normalizeOutboundConfig(item)
                                  )
                                );
                              }}
                              value={field.value || []}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent className="space-y-4" value="block">
                    <FormField
                      control={form.control}
                      name="block"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              onChange={(e) => {
                                const lines = e.target.value
                                  .split("\n")
                                  .map((line) => line.trim());
                                field.onChange(lines);
                              }}
                              placeholder={t(
                                "server_config.fields.block_rules_placeholder",
                                "One domain rule per line"
                              )}
                              rows={10}
                              value={(field.value || []).join("\n")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </form>
              </Form>
            </Tabs>
          </ReadBoundary>
        </ScrollArea>

        <WorkspaceDialogFooter className="flex-row justify-end gap-2">
          <Button
            disabled={safety.busy}
            onClick={() => safety.requestOpenChange(false)}
            variant="outline"
          >
            {t("actions.cancel", "Cancel")}
          </Button>
          <Button
            disabled={safety.busy || !readReady(readQuery)}
            form="server-config-form"
            loading={safety.submitting}
            loadingLabel={t("components:actions.processing")}
            type="submit"
          >
            {t("actions.save", "Save")}
          </Button>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
      {safety.dialogs}
    </WorkspaceDialog>
  );
}
