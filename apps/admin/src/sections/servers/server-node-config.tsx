"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
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
import { Switch } from "@workspace/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Textarea } from "@workspace/ui/components/textarea";
import { ArrayInput } from "@workspace/ui/composed/dynamic-Inputs";
import { Icon } from "@workspace/ui/composed/icon";
import {
  getServerNodeConfig,
  postServerNodeConfigUpdate as updateServerNodeConfig,
} from "@workspace/ui/services/admin/admin";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type Control, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { StatusChip } from "@/components/status-chip";
import {
  WorkspaceDialog,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
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
  proto: z.string().trim().min(1),
  address: z.string().trim().min(1),
  server_name: z.string().trim().optional(),
  domains: z.array(z.string()),
});

const serverNodeConfigSchema = z.object({
  inherit_ip_strategy: z.boolean(),
  ip_strategy: z.enum(["prefer_ipv4", "prefer_ipv6"]),
  inherit_dns: z.boolean(),
  dns: z.array(dnsConfigSchema),
  inherit_block: z.boolean(),
  block: z.array(z.string()),
  inherit_outbound: z.boolean(),
  outbound: z.array(outboundConfigSchema),
});

type ServerNodeConfigFormData = z.infer<typeof serverNodeConfigSchema>;
type IPStrategy = ServerNodeConfigFormData["ip_strategy"];

function normalizeIPStrategy(value?: string): IPStrategy {
  return value === "prefer_ipv6" ? "prefer_ipv6" : "prefer_ipv4";
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStringList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getFormValues(
  response: API.GetServerNodeConfigResponse
): ServerNodeConfigFormData {
  const { effective, override } = response;
  return {
    inherit_ip_strategy: override.inherit_ip_strategy,
    ip_strategy: normalizeIPStrategy(
      override.inherit_ip_strategy
        ? effective.ip_strategy
        : override.ip_strategy
    ),
    inherit_dns: override.inherit_dns,
    dns: override.inherit_dns ? effective.dns || [] : override.dns || [],
    inherit_block: override.inherit_block,
    block: override.inherit_block
      ? effective.block || []
      : override.block || [],
    inherit_outbound: override.inherit_outbound,
    outbound: override.inherit_outbound
      ? effective.outbound || []
      : override.outbound || [],
  };
}

export function normalizeServerNodeConfigValues(
  values: ServerNodeConfigFormData
): ServerNodeConfigFormData {
  return {
    ...values,
    dns: values.dns.map((item) => ({
      proto: item.proto.trim(),
      address: item.address.trim(),
      server_name: item.server_name?.trim() || "",
      domains: normalizeStringList(item.domains),
    })),
    block: normalizeStringList(values.block),
    outbound: values.outbound.map((item) => ({
      ...normalizeOutboundConfig(item),
      rules: normalizeStringList(item.rules || []),
    })),
  };
}

function ToggleField({
  control,
  name,
  label,
  description,
  inheritedLabel,
  customLabel,
}: {
  control: Control<ServerNodeConfigFormData>;
  name:
    | "inherit_ip_strategy"
    | "inherit_dns"
    | "inherit_block"
    | "inherit_outbound";
  label: string;
  description: string;
  inheritedLabel: string;
  customLabel: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background px-4 py-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 font-medium text-sm">
              {label}
              <Badge variant={field.value ? "secondary" : "outline"}>
                {field.value ? inheritedLabel : customLabel}
              </Badge>
            </span>
            <span className="mt-1 block text-muted-foreground text-xs">
              {description}
            </span>
          </span>
          <Switch
            aria-label={label}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  );
}

function ConfigSummaryCard({
  title,
  strategy,
  dnsCount,
  outboundCount,
  blockCount,
  mode,
  labels,
}: {
  title: ReactNode;
  strategy: ReactNode;
  dnsCount: number;
  outboundCount: number;
  blockCount: number;
  mode?: ReactNode;
  labels: { ip: string; dns: string; outbound: string; block: string };
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-sm">{title}</h3>
        {mode}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">{labels.ip}</dt>
          <dd className="mt-0.5 font-medium">{strategy}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labels.dns}</dt>
          <dd className="mt-0.5 font-medium">{dnsCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labels.outbound}</dt>
          <dd className="mt-0.5 font-medium">{outboundCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labels.block}</dt>
          <dd className="mt-0.5 font-medium">{blockCount}</dd>
        </div>
      </dl>
    </section>
  );
}

function InheritedPreview({
  description,
  title,
}: {
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3">
      <p className="font-medium text-sm">{title}</p>
      <p className="mt-1 text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

export default function ServerNodeConfig({ server }: { server: API.Server }) {
  const { t } = useTranslation("servers");
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    data: cfgResp,
    refetch,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["getServerNodeConfig", server.id],
    queryFn: async () => {
      const { data } = await getServerNodeConfig({ server_id: server.id });
      return data.data;
    },
    enabled: open,
    retry: false,
  });

  const form = useForm<ServerNodeConfigFormData>({
    resolver: zodResolver(serverNodeConfigSchema),
    defaultValues: {
      inherit_ip_strategy: true,
      ip_strategy: "prefer_ipv4",
      inherit_dns: true,
      dns: [],
      inherit_block: true,
      block: [],
      inherit_outbound: true,
      outbound: [],
    },
  });

  useEffect(() => {
    if (!cfgResp) return;
    form.reset(getFormValues(cfgResp));
  }, [cfgResp, form]);

  const inheritIPStrategy = form.watch("inherit_ip_strategy");
  const inheritDNS = form.watch("inherit_dns");
  const inheritOutbound = form.watch("inherit_outbound");
  const inheritBlock = form.watch("inherit_block");
  const ipStrategy = form.watch("ip_strategy");
  const dns = form.watch("dns");
  const outbound = form.watch("outbound");
  const block = form.watch("block");
  const { isDirty } = form.formState;

  const effectivePreview = useMemo(
    () => ({
      ip_strategy:
        inheritIPStrategy && cfgResp
          ? normalizeIPStrategy(cfgResp.global.ip_strategy)
          : ipStrategy,
      dns: inheritDNS && cfgResp ? cfgResp.global.dns || [] : dns || [],
      outbound:
        inheritOutbound && cfgResp
          ? cfgResp.global.outbound || []
          : outbound || [],
      block: inheritBlock && cfgResp ? cfgResp.global.block || [] : block || [],
    }),
    [
      block,
      cfgResp,
      dns,
      inheritBlock,
      inheritDNS,
      inheritIPStrategy,
      inheritOutbound,
      ipStrategy,
      outbound,
    ]
  );

  const customCount = [
    inheritIPStrategy,
    inheritDNS,
    inheritOutbound,
    inheritBlock,
  ].filter((inherited) => !inherited).length;
  const summaryLabels = {
    ip: "IP",
    dns: "DNS",
    outbound: t("server_node_config.summaryOutbound", "Outbound"),
    block: t("server_node_config.summaryBlock", "Block"),
  };

  useEffect(() => {
    if (!(open && isDirty)) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty, open]);

  function requestOpenChange(nextOpen: boolean) {
    if (!nextOpen && isDirty && !saving) {
      setDiscardOpen(true);
      return;
    }
    setOpen(nextOpen);
  }

  function discardChanges() {
    if (cfgResp) form.reset(getFormValues(cfgResp));
    setDiscardOpen(false);
    setOpen(false);
  }

  async function onSubmit(values: ServerNodeConfigFormData) {
    setSaving(true);
    try {
      const normalized = normalizeServerNodeConfigValues(values);
      await updateServerNodeConfig({
        server_id: server.id,
        inherit_ip_strategy: normalized.inherit_ip_strategy,
        ip_strategy: normalized.ip_strategy,
        inherit_dns: normalized.inherit_dns,
        dns: normalized.dns,
        inherit_block: normalized.inherit_block,
        block: normalized.block,
        inherit_outbound: normalized.inherit_outbound,
        outbound: normalized.outbound,
      });
      toast.success(t("server_node_config.saveSuccess", "Saved successfully"));
      form.reset(normalized);
      setOpen(false);
      refetch();
    } catch {
      toast.error(
        t("server_node_config.saveFailed", "Unable to save node configuration")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceDialog onOpenChange={requestOpenChange} open={open}>
      <WorkspaceDialogTrigger asChild>
        <Button variant="outline">
          <Icon className="mr-2 h-4 w-4" icon="mdi:tune-variant" />
          {t("server_node_config.trigger", "Node Config")}
        </Button>
      </WorkspaceDialogTrigger>
      <WorkspaceDialogContent size="xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>
            {t("server_node_config.title", "Node configuration overrides")}
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>
            {t(
              "server_node_config.description",
              "Choose which global settings this server inherits and which ones it overrides."
            )}{" "}
            {server.name}
          </WorkspaceDialogDescription>
        </WorkspaceDialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-5 py-5 sm:px-7 sm:py-6">
          {isLoading && !cfgResp && (
            <div
              className="mt-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm"
              role="status"
            >
              {t("server_node_config.loading", "Loading configuration")}
            </div>
          )}
          {isError && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
              <p className="font-medium">
                {t(
                  "server_node_config.loadErrorTitle",
                  "Unable to load configuration"
                )}
              </p>
              <p className="mt-1">
                {t(
                  "server_node_config.loadError",
                  "Nothing can be changed until the current server configuration is loaded."
                )}
              </p>
              <Button
                className="mt-3"
                onClick={() => refetch()}
                size="sm"
                variant="outline"
              >
                <Icon icon="mdi:refresh" />
                {t("server_node_config.retry", "Retry")}
              </Button>
            </div>
          )}
          {cfgResp ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <ConfigSummaryCard
                blockCount={cfgResp.global.block?.length || 0}
                dnsCount={cfgResp.global.dns?.length || 0}
                labels={summaryLabels}
                outboundCount={cfgResp.global.outbound?.length || 0}
                strategy={
                  normalizeIPStrategy(cfgResp.global.ip_strategy) ===
                  "prefer_ipv6"
                    ? t("server_config.fields.ip_strategy_ipv6", "Prefer IPv6")
                    : t("server_config.fields.ip_strategy_ipv4", "Prefer IPv4")
                }
                title={t(
                  "server_node_config.globalSummary",
                  "Global configuration"
                )}
              />
              <ConfigSummaryCard
                blockCount={effectivePreview.block.length}
                dnsCount={effectivePreview.dns.length}
                labels={summaryLabels}
                outboundCount={effectivePreview.outbound.length}
                strategy={
                  effectivePreview.ip_strategy === "prefer_ipv6"
                    ? t("server_config.fields.ip_strategy_ipv6", "Prefer IPv6")
                    : t("server_config.fields.ip_strategy_ipv4", "Prefer IPv4")
                }
                title={t(
                  "server_node_config.effectiveSummary",
                  "Effective configuration"
                )}
              />
              <ConfigSummaryCard
                blockCount={inheritBlock ? 0 : block.length}
                dnsCount={inheritDNS ? 0 : dns.length}
                labels={summaryLabels}
                mode={
                  <Badge variant={customCount > 0 ? "default" : "secondary"}>
                    {t(
                      "server_node_config.customCount",
                      "{{count}} of 4 custom",
                      { count: customCount }
                    )}
                  </Badge>
                }
                outboundCount={inheritOutbound ? 0 : outbound.length}
                strategy={
                  inheritIPStrategy
                    ? t("server_node_config.modeInherited", "Inherited")
                    : ipStrategy === "prefer_ipv6"
                      ? t(
                          "server_config.fields.ip_strategy_ipv6",
                          "Prefer IPv6"
                        )
                      : t(
                          "server_config.fields.ip_strategy_ipv4",
                          "Prefer IPv4"
                        )
                }
                title={t(
                  "server_node_config.customSummary",
                  "Custom overrides"
                )}
              />
            </div>
          ) : null}
          <Tabs className="mt-4" defaultValue="dns">
            <TabsList className="grid w-full grid-cols-3">
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
                className="space-y-4 pt-4"
                id="server-node-config-form"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <TabsContent className="space-y-4" value="dns">
                  <ToggleField
                    control={form.control}
                    customLabel={t("server_node_config.modeCustom", "Custom")}
                    description={t(
                      "server_node_config.inherit_ip_strategy_desc",
                      "Turn this off to choose a different IP preference for this server."
                    )}
                    inheritedLabel={t(
                      "server_node_config.modeInherited",
                      "Inherited"
                    )}
                    label={t(
                      "server_node_config.inherit_ip_strategy",
                      "Use global IP strategy"
                    )}
                    name="inherit_ip_strategy"
                  />
                  {inheritIPStrategy && cfgResp ? (
                    <InheritedPreview
                      description={t(
                        "server_node_config.global_ip_strategy_summary",
                        "Current global value: {{value}}",
                        {
                          value:
                            cfgResp.global.ip_strategy === "prefer_ipv6"
                              ? t(
                                  "server_config.fields.ip_strategy_ipv6",
                                  "Prefer IPv6"
                                )
                              : t(
                                  "server_config.fields.ip_strategy_ipv4",
                                  "Prefer IPv4"
                                ),
                        }
                      )}
                      title={t(
                        "server_node_config.globalPreview",
                        "Using global configuration"
                      )}
                    />
                  ) : (
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <ToggleField
                    control={form.control}
                    customLabel={t("server_node_config.modeCustom", "Custom")}
                    description={t(
                      "server_node_config.inherit_dns_desc",
                      "Turn this off to maintain a DNS list only for this server."
                    )}
                    inheritedLabel={t(
                      "server_node_config.modeInherited",
                      "Inherited"
                    )}
                    label={t(
                      "server_node_config.inherit_dns",
                      "Use global DNS configuration"
                    )}
                    name="inherit_dns"
                  />
                  {inheritDNS && cfgResp ? (
                    <InheritedPreview
                      description={t(
                        "server_node_config.global_dns_summary",
                        "{{count}} global DNS entries",
                        { count: cfgResp.global.dns?.length || 0 }
                      )}
                      title={t(
                        "server_node_config.globalPreview",
                        "Using global configuration"
                      )}
                    />
                  ) : (
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
                                      ? splitLines(item.domains)
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
                  )}
                </TabsContent>

                <TabsContent className="space-y-4" value="outbound">
                  <ToggleField
                    control={form.control}
                    customLabel={t("server_node_config.modeCustom", "Custom")}
                    description={t(
                      "server_node_config.inherit_outbound_desc",
                      "Turn this off to define outbound routing only for this server."
                    )}
                    inheritedLabel={t(
                      "server_node_config.modeInherited",
                      "Inherited"
                    )}
                    label={t(
                      "server_node_config.inherit_outbound",
                      "Use global outbound rules"
                    )}
                    name="inherit_outbound"
                  />
                  {inheritOutbound && cfgResp ? (
                    <InheritedPreview
                      description={t(
                        "server_node_config.global_outbound_summary",
                        "{{count}} global outbound rules",
                        { count: cfgResp.global.outbound?.length || 0 }
                      )}
                      title={t(
                        "server_node_config.globalPreview",
                        "Using global configuration"
                      )}
                    />
                  ) : (
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
                  )}
                </TabsContent>

                <TabsContent className="space-y-4" value="block">
                  <ToggleField
                    control={form.control}
                    customLabel={t("server_node_config.modeCustom", "Custom")}
                    description={t(
                      "server_node_config.inherit_block_desc",
                      "Turn this off to define a block list only for this server."
                    )}
                    inheritedLabel={t(
                      "server_node_config.modeInherited",
                      "Inherited"
                    )}
                    label={t(
                      "server_node_config.inherit_block",
                      "Use global block rules"
                    )}
                    name="inherit_block"
                  />
                  {inheritBlock && cfgResp ? (
                    <InheritedPreview
                      description={t(
                        "server_node_config.global_block_summary",
                        "{{count}} global block rules",
                        { count: cfgResp.global.block?.length || 0 }
                      )}
                      title={t(
                        "server_node_config.globalPreview",
                        "Using global configuration"
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="block"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              onChange={(e) => {
                                field.onChange(splitLines(e.target.value));
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
                  )}
                </TabsContent>
              </form>
            </Form>
          </Tabs>
        </ScrollArea>

        <WorkspaceDialogFooter className="flex-row items-center justify-between gap-2">
          <StatusChip tone={isDirty ? "warning" : "neutral"}>
            {isDirty
              ? t("server_node_config.unsavedChanges", "Unsaved changes")
              : t("server_node_config.noChanges", "No unsaved changes")}
          </StatusChip>
          <div className="flex gap-2">
            <Button
              disabled={saving}
              onClick={() => requestOpenChange(false)}
              variant="outline"
            >
              {t("actions.cancel", "Cancel")}
            </Button>
            <Button
              disabled={saving || isLoading || isError || !cfgResp || !isDirty}
              form="server-node-config-form"
              type="submit"
            >
              <Icon
                className={saving ? "mr-2 animate-spin" : "hidden"}
                icon="mdi:loading"
              />
              {t("actions.save", "Save")}
            </Button>
          </div>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
      <AlertDialog onOpenChange={setDiscardOpen} open={discardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("server_node_config.discardTitle", "Discard changes?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "server_node_config.discardDescription",
                "The unsaved node configuration changes will be lost."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("server_node_config.keepEditing", "Keep editing")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={discardChanges}>
              {t("server_node_config.discardAction", "Discard changes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceDialog>
  );
}
