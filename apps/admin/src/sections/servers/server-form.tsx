"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
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
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import { Icon } from "@workspace/ui/composed/icon";
import {
  type BaseSyntheticEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { changedFormFields, useFormSafety } from "@/components/form-safety";
import { StatusChip } from "@/components/status-chip";
import {
  WorkspaceDialog,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  WorkspaceDialogTrigger,
} from "@/components/workspace-dialog";
import { useNode } from "@/stores/node";
import {
  createServerFormSchema,
  type FieldConfig,
  getLabel,
  getProtocolFormValues,
  getUneditableProtocols,
  protocols as PROTOCOLS,
  type ProtocolType,
  preserveUneditableProtocols,
  useProtocolFields,
} from "./form-schema";

function getFieldLabel(field: FieldConfig) {
  return (
    <>
      {field.label}
      {field.required ? (
        <span aria-hidden="true" className="ml-1 text-destructive">
          *
        </span>
      ) : null}
    </>
  );
}

function getVisibleRequiredFields(
  fields: FieldConfig[],
  protocolData: Record<string, any>
) {
  return fields.filter(
    (field) =>
      field.required && (!field.condition || field.condition(protocolData, {}))
  );
}

const PRESERVED_HIDDEN_PROTOCOL_FIELDS = new Set([
  "fingerprint",
  "server_key",
  "reality_private_key",
  "reality_public_key",
  "reality_short_id",
  "encryption_ticket",
  "encryption_server_padding",
  "encryption_private_key",
  "encryption_client_padding",
  "encryption_password",
  "obfs_password",
]);

function DynamicField({
  field,
  control,
  form,
  protocolIndex,
  protocolData,
}: {
  field: FieldConfig;
  control: any;
  form: any;
  protocolIndex: number;
  protocolData: any;
}) {
  const { t } = useTranslation("servers");
  const fieldName = `protocols.${protocolIndex}.${field.name}` as const;

  if (field.condition && !field.condition(protocolData, {})) {
    return null;
  }

  const commonProps = {
    control,
    name: fieldName,
  };

  switch (field.type) {
    case "input":
      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <EnhancedInput
                  {...fieldProps}
                  onValueChange={(v) => fieldProps.onChange(v)}
                  placeholder={field.placeholder}
                  suffix={
                    field.generate ? (
                      field.generate.functions &&
                      field.generate.functions.length > 0 ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" type="button" variant="ghost">
                              <Icon className="h-4 w-4" icon="mdi:key" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {field.generate.functions.map((genFunc, idx) => (
                              <DropdownMenuItem
                                key={idx}
                                onClick={async () => {
                                  const result =
                                    await genFunc.function(protocolData);
                                  if (typeof result === "string") {
                                    fieldProps.onChange(result);
                                  } else if (field.generate!.updateFields) {
                                    Object.entries(
                                      field.generate!.updateFields
                                    ).forEach(([fieldName, resultKey]) => {
                                      const fullFieldName = `protocols.${protocolIndex}.${fieldName}`;
                                      form.setValue(
                                        fullFieldName,
                                        (result as any)[resultKey]
                                      );
                                    });
                                  } else if (result.privateKey) {
                                    fieldProps.onChange(result.privateKey);
                                  }
                                }}
                              >
                                {genFunc.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : field.generate.function ? (
                        <Button
                          onClick={async () => {
                            const result =
                              await field.generate!.function!(protocolData);
                            if (typeof result === "string") {
                              fieldProps.onChange(result);
                            } else if (field.generate!.updateFields) {
                              Object.entries(
                                field.generate!.updateFields
                              ).forEach(([fieldName, resultKey]) => {
                                const fullFieldName = `protocols.${protocolIndex}.${fieldName}`;
                                form.setValue(
                                  fullFieldName,
                                  (result as any)[resultKey]
                                );
                              });
                            } else if (result.privateKey) {
                              fieldProps.onChange(result.privateKey);
                            }
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Icon className="h-4 w-4" icon="mdi:key" />
                        </Button>
                      ) : null
                    ) : (
                      field.suffix
                    )
                  }
                  type="text"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "number":
      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <EnhancedInput
                  {...fieldProps}
                  max={field.max}
                  min={field.min}
                  onValueChange={(v) => fieldProps.onChange(v)}
                  placeholder={field.placeholder}
                  step={field.step || 1}
                  suffix={field.suffix}
                  type="number"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "select":
      if (!field.options || field.options.length <= 1) {
        return null;
      }

      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <Select
                  onValueChange={(value) => {
                    fieldProps.onChange(value);
                    if (field.name === "security") {
                      if (
                        value === "tls" &&
                        protocolData.cert_mode === "none"
                      ) {
                        form.setValue(
                          `protocols.${protocolIndex}.cert_mode`,
                          "self"
                        );
                      }
                      if (value === "reality") {
                        if (
                          protocolData.type === "vmess" ||
                          protocolData.type === "trojan"
                        ) {
                          form.setValue(
                            `protocols.${protocolIndex}.transport`,
                            "tcp"
                          );
                        }
                        form.setValue(
                          `protocols.${protocolIndex}.cert_mode`,
                          "none"
                        );
                      }
                    }
                    if (field.name === "plugin" && value === "none") {
                      form.setValue(
                        `protocols.${protocolIndex}.plugin_opts`,
                        null
                      );
                    }
                  }}
                  value={String(fieldProps.value ?? field.defaultValue ?? "")}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {getLabel(option)}
                      </SelectItem>
                    ))}
                    {field.name === "fingerprint" &&
                      typeof fieldProps.value === "string" &&
                      fieldProps.value.length > 0 &&
                      !field.options?.includes(fieldProps.value) && (
                        <SelectItem value={fieldProps.value}>
                          {t(
                            "fingerprintLegacyValue",
                            "{{value}} (saved value)",
                            {
                              value: fieldProps.value,
                            }
                          )}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "switch":
      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <div className="pt-2">
                  <Switch
                    checked={!!fieldProps.value}
                    onCheckedChange={(checked) => fieldProps.onChange(checked)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "textarea":
      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem className="col-span-2">
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <textarea
                  {...fieldProps}
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(e) => fieldProps.onChange(e.target.value)}
                  placeholder={field.placeholder}
                  value={fieldProps.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "string-list":
      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem className="col-span-2">
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <textarea
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) =>
                    fieldProps.onChange(
                      event.target.value
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder={field.placeholder}
                  value={
                    Array.isArray(fieldProps.value)
                      ? fieldProps.value.join("\n")
                      : ""
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case "json":
      return (
        <FormField
          {...commonProps}
          render={({ field: fieldProps }) => (
            <FormItem className="col-span-2">
              <FormLabel>{getFieldLabel(field)}</FormLabel>
              <FormControl>
                <textarea
                  className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) => fieldProps.onChange(event.target.value)}
                  placeholder={field.placeholder}
                  value={
                    typeof fieldProps.value === "string"
                      ? fieldProps.value
                      : fieldProps.value
                        ? JSON.stringify(fieldProps.value, null, 2)
                        : ""
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );

    default:
      return null;
  }
}

function renderFieldsByGroup(
  fields: FieldConfig[],
  group: string,
  control: any,
  form: any,
  protocolIndex: number,
  protocolData: any
) {
  const groupFields = fields.filter((field) => field.group === group);
  if (groupFields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {groupFields.map((field) => (
        <DynamicField
          control={control}
          field={field}
          form={form}
          key={field.name}
          protocolData={protocolData}
          protocolIndex={protocolIndex}
        />
      ))}
    </div>
  );
}

function renderGroupCard(
  title: string,
  fields: FieldConfig[],
  group: string,
  control: any,
  form: any,
  protocolIndex: number,
  protocolData: any
) {
  const groupFields = fields.filter((field) => field.group === group);
  if (groupFields.length === 0) return null;

  const visibleFields = groupFields.filter(
    (field) => !field.condition || field.condition(protocolData, {})
  );

  if (visibleFields.length === 0) return null;

  return (
    <div className="relative">
      <fieldset className="admin-form-section">
        <legend className="text-foreground">{title}</legend>
        <div className="pt-2">
          {renderFieldsByGroup(
            fields,
            group,
            control,
            form,
            protocolIndex,
            protocolData
          )}
        </div>
      </fieldset>
    </div>
  );
}

interface ServerFormProps {
  trigger?: string;
  title: string;
  loading?: boolean;
  readWarning?: ReactNode;
  saveDisabled?: boolean;
  initialValues?: Partial<API.Server>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void | Promise<void>;
  onAfterClose?: () => void | Promise<void>;
  onSubmit: (values: Partial<API.Server>) => Promise<boolean> | boolean;
}

export default function ServerForm(props: ServerFormProps) {
  const {
    trigger,
    title,
    loading,
    readWarning,
    saveDisabled,
    initialValues,
    open: controlledOpen,
    onOpenChange,
    onAfterClose,
    onSubmit,
  } = props;
  const { t } = useTranslation("servers");
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>(() => {
    const firstEnabled = initialValues?.protocols?.find(
      (protocol) =>
        protocol?.enable && PROTOCOLS.includes(protocol.type as ProtocolType)
    )?.type as ProtocolType | undefined;
    return firstEnabled ?? PROTOCOLS[0];
  });
  const formRef = useRef<HTMLFormElement>(null);
  const revealProtocolError = useRef(false);
  const open = controlledOpen ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    return onOpenChange?.(nextOpen);
  };

  const { fetchNodes, isProtocolUsedInNodes, loadFailed, nodeReferencesReady } =
    useNode();
  const PROTOCOL_FIELDS = useProtocolFields();

  const editableSchema = useMemo(
    () => createServerFormSchema(initialValues?.protocols),
    [initialValues?.protocols]
  );

  const defaultValues = useMemo(
    () => ({
      name: "",
      address: "",
      country: "",
      city: "",
      ...initialValues,
      protocols: getProtocolFormValues(initialValues?.protocols),
    }),
    [initialValues]
  );
  const uneditableProtocols = getUneditableProtocols(initialValues?.protocols);
  const serverId = initialValues?.id;

  useEffect(() => {
    if (open && serverId) fetchNodes();
  }, [fetchNodes, open, serverId]);

  const form = useForm<Record<string, any>>({
    resolver: zodResolver(editableSchema) as unknown as Resolver<
      Record<string, any>
    >,
    defaultValues,
  });
  const safety = useFormSafety({
    form,
    open,
    onOpenChange: setOpen,
    review: true,
  });
  const { control } = form;

  const protocolsValues = useWatch({ control, name: "protocols" });
  const enabledProtocolCount = (protocolsValues || []).filter((protocol: any) =>
    Boolean(protocol?.enable)
  ).length;

  useLayoutEffect(() => {
    if (!revealProtocolError.current) return;
    revealProtocolError.current = false;
    const summary =
      formRef.current?.querySelector<HTMLElement>('[role="alert"]');
    const viewport = formRef.current?.closest<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    // Only scroll the content viewport, not overflow:hidden Dialog ancestors.
    if (viewport) viewport.scrollTop = 0;
    else summary?.scrollIntoView({ block: "start", behavior: "instant" });
    summary?.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (initialValues && !safety.dirty && !safety.busy) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  function validateEnabledProtocols(values: Record<string, any>) {
    let firstInvalidProtocol: ProtocolType | undefined;

    for (const [index, protocol] of (values?.protocols || []).entries()) {
      if (!protocol?.enable) continue;

      const protocolType = protocol.type as ProtocolType;
      const fields = PROTOCOL_FIELDS[protocolType] || [];
      const requiredFields = getVisibleRequiredFields(fields, protocol);

      for (const field of requiredFields) {
        const value = protocol[field.name];
        const fieldPath = `protocols.${index}.${field.name}` as any;

        if (field.type === "number") {
          const numericValue =
            typeof value === "number" ? value : Number(value ?? Number.NaN);
          const hasValue = Number.isFinite(numericValue);
          const inMinRange =
            field.min === undefined || numericValue >= field.min;
          const inMaxRange =
            field.max === undefined || numericValue <= field.max;

          if (!(hasValue && inMinRange && inMaxRange)) {
            form.setError(fieldPath, {
              type: "manual",
              message: t(
                "validation.requiredNumberField",
                "{{field}} is required and must be between {{min}} and {{max}}",
                {
                  field: field.label,
                  min: field.min ?? 0,
                  max: field.max ?? 65_535,
                }
              ),
            });
            firstInvalidProtocol ??= protocolType;
          }
          continue;
        }

        if (field.type === "select") {
          const hasValue = typeof value === "string" && value.trim().length > 0;
          const isAllowed =
            !field.options || (hasValue && field.options.includes(value));

          if (!(hasValue && isAllowed)) {
            form.setError(fieldPath, {
              type: "manual",
              message: t(
                "validation.requiredSelectField",
                "{{field}} is required",
                { field: field.label }
              ),
            });
            firstInvalidProtocol ??= protocolType;
          }
          continue;
        }

        const hasValue =
          typeof value === "string"
            ? value.trim().length > 0
            : value !== null && value !== undefined;

        if (!hasValue) {
          form.setError(fieldPath, {
            type: "manual",
            message: t("validation.requiredField", "{{field}} is required", {
              field: field.label,
            }),
          });
          firstInvalidProtocol ??= protocolType;
        }
      }
    }

    if (firstInvalidProtocol) {
      setSelectedProtocol(firstInvalidProtocol);
      return false;
    }

    return true;
  }

  async function handleSubmit(values: Record<string, any>) {
    form.clearErrors();

    const protectedProtocolIndex = serverId
      ? defaultValues.protocols.findIndex(
          (protocol, index) =>
            protocol.enable &&
            !values.protocols?.[index]?.enable &&
            (!nodeReferencesReady() ||
              isProtocolUsedInNodes(serverId, protocol.type))
        )
      : -1;
    if (protectedProtocolIndex >= 0) {
      form.setError(`protocols.${protectedProtocolIndex}.enable`, {
        type: "manual",
        message: t(
          "protocolDisableBlocked",
          "This protocol cannot be disabled while node references are unverified or the protocol is in use."
        ),
      });
      return;
    }

    if (!validateEnabledProtocols(values)) {
      return;
    }

    const filteredProtocols = (values?.protocols || [])
      .filter((protocol: any) => protocol?.enable)
      .map((protocol: any) => {
        const protocolType = protocol.type as ProtocolType;
        const fields = PROTOCOL_FIELDS[protocolType] || [];
        const fieldNames = [...new Set(fields.map((field) => field.name))];
        const hiddenFieldNames = new Set(
          fieldNames.filter((name) => {
            const sameName = fields.filter((field) => field.name === name);
            return sameName.every(
              (field) => field.condition && !field.condition(protocol, {})
            );
          })
        );
        const normalized = Object.fromEntries(
          Object.entries(protocol).filter(([key]) => {
            if (
              hiddenFieldNames.has(key) &&
              !PRESERVED_HIDDEN_PROTOCOL_FIELDS.has(key)
            ) {
              return false;
            }

            return true;
          })
        );
        if (normalized.plugin === "none") {
          normalized.plugin = undefined;
          normalized.plugin_opts = undefined;
        }
        if (normalized.multiplex === "none") {
          normalized.multiplex = undefined;
        }
        return normalized;
      });

    const result = {
      name: values.name,
      country: values.country,
      city: values.city,
      address: values.address,
      protocols: preserveUneditableProtocols(
        filteredProtocols,
        initialValues?.protocols
      ) as API.Protocol[],
    };

    const ok = await onSubmit(result);
    if (ok === false) throw new Error("Write was not confirmed");
    if (ok) {
      await safety.completeSave();
    }
  }

  // Expanding a protocol is not enabling it. Never silently discard a draft
  // just because its independent switch was left off. A pristine empty server
  // and deliberately disabling an unchanged existing protocol remain valid.
  function submitForm(event?: BaseSyntheticEvent) {
    if (saveDisabled) {
      event?.preventDefault();
      return;
    }
    const values = form.getValues();
    const baseline = form.formState.defaultValues?.protocols || [];
    let firstDisabled: string | undefined;
    for (const [index, protocol] of (values.protocols || []).entries()) {
      if (protocol.enable) continue;
      const changes = changedFormFields(baseline[index], protocol).filter(
        (path) => path !== "enable"
      );
      if (!changes.length) continue;
      form.setError(`protocols.${index}.enable`, {
        type: "manual",
        message: t(
          "validation.disabledProtocolDraft",
          "{{protocol}} has changes but is not enabled. Enable it to save these settings, or undo its changes.",
          { protocol: String(protocol.type).toUpperCase() }
        ),
      });
      firstDisabled ??= protocol.type;
    }
    if (firstDisabled) {
      event?.preventDefault();
      revealProtocolError.current = true;
      setSelectedProtocol(firstDisabled as ProtocolType);
      return;
    }
    return safety.handleSubmit(handleSubmit)(event);
  }

  const protocolErrors = (form.formState.errors as Record<string, any>)
    ?.protocols;
  const activeProtocolType = selectedProtocol;
  const activeIndex = Math.max(0, PROTOCOLS.indexOf(activeProtocolType));
  const activeData = (protocolsValues?.[activeIndex] || {}) as Record<
    string,
    any
  >;
  const activeFields = PROTOCOL_FIELDS[activeProtocolType] || [];
  const activeEnabled = Boolean(activeData?.enable);

  return (
    <WorkspaceDialog onOpenChange={safety.requestOpenChange} open={open}>
      {trigger ? (
        <WorkspaceDialogTrigger asChild>
          <Button
            onClick={() => {
              if (!initialValues) {
                form.reset(defaultValues);
              }
              setOpen(true);
            }}
          >
            {trigger}
          </Button>
        </WorkspaceDialogTrigger>
      ) : null}
      <WorkspaceDialogContent
        onCloseAutoFocus={() => {
          onAfterClose?.();
        }}
        size="xl"
      >
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle>{title}</WorkspaceDialogTitle>
        </WorkspaceDialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <Form {...form}>
            <form
              className="grid grid-cols-1 gap-2 px-6 pt-4"
              onSubmit={submitForm}
              ref={formRef}
            >
              {safety.summary}
              {readWarning && (
                <div className="col-span-full">{readWarning}</div>
              )}
              {serverId && loadFailed && (
                <div
                  className="col-span-full flex flex-wrap items-center gap-2"
                  role="alert"
                >
                  <p className="text-muted-foreground text-sm">
                    {t(
                      "nodeReferencesUnavailable",
                      "Could not verify node references. Destructive actions are unavailable until the list is refreshed."
                    )}
                  </p>
                  <Button
                    onClick={fetchNodes}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("components:read.retry", "Retry")}
                  </Button>
                </div>
              )}
              <div className="admin-server-base-panel grid grid-cols-1 gap-3.5 rounded-lg border border-border bg-muted/25 p-3.5 sm:grid-cols-2 xl:grid-cols-4">
                <FormField
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("name", "Name")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          {...field}
                          onValueChange={(v) => field.onChange(v)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("address", "Address")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          {...field}
                          onValueChange={(v) => field.onChange(v)}
                          placeholder={t(
                            "address_placeholder",
                            "Server address"
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("country", "Country")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          {...field}
                          onValueChange={(v) => field.onChange(v)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("city", "City")}</FormLabel>
                      <FormControl>
                        <EnhancedInput
                          {...field}
                          onValueChange={(v) => field.onChange(v)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="my-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {t("protocol_configurations", "Protocol Configurations")}
                  </h3>
                  <p className="admin-helper-text mt-1">
                    {t(
                      "protocol_configurations_desc",
                      "Enable and configure the required protocol types"
                    )}
                  </p>
                </div>
                <StatusChip
                  pulse={enabledProtocolCount > 0}
                  tone={enabledProtocolCount > 0 ? "success" : "neutral"}
                >
                  <span className="font-mono tabular-nums">
                    {enabledProtocolCount} / {PROTOCOLS.length}
                  </span>
                </StatusChip>
              </div>

              {uneditableProtocols.length > 0 && (
                <p className="mb-3 text-muted-foreground text-xs">
                  {t(
                    "uneditable_protocols_preserved",
                    "These protocols are not editable in this panel and will be preserved when saving: {{protocols}}",
                    {
                      protocols: uneditableProtocols
                        .map((protocol) => protocol.type)
                        .join(", "),
                    }
                  )}
                </p>
              )}
              <div className="admin-protocol-studio mb-4">
                <div
                  aria-label={t(
                    "protocol_configurations",
                    "Protocol Configurations"
                  )}
                  className="admin-protocol-rail"
                  role="region"
                >
                  {PROTOCOLS.map((type) => {
                    const i = Math.max(0, PROTOCOLS.indexOf(type));
                    const current = (protocolsValues?.[i] || {}) as Record<
                      string,
                      any
                    >;
                    const isEnabled = Boolean(current?.enable);
                    const isSelected = selectedProtocol === type;
                    const hasError = Boolean(
                      Array.isArray(protocolErrors) &&
                        protocolErrors[i] &&
                        Object.keys(protocolErrors[i]).length > 0
                    );
                    const dotStatus = hasError
                      ? "error"
                      : isEnabled
                        ? "enabled"
                        : "disabled";
                    return (
                      <div
                        className="admin-protocol-rail__row"
                        data-enabled={isEnabled ? "true" : "false"}
                        data-selected={isSelected ? "true" : "false"}
                        key={type}
                      >
                        <button
                          aria-current={isSelected ? "true" : undefined}
                          className="admin-protocol-rail__select"
                          data-form-path={`protocols.${i}`}
                          data-state={isSelected ? "active" : "inactive"}
                          onClick={() => setSelectedProtocol(type)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="admin-protocol-rail__dot"
                            data-status={dotStatus}
                          />
                          <span className="min-w-0 flex-1 truncate capitalize">
                            {type}
                          </span>
                          {current.port ? (
                            <span className="admin-protocol-rail__port">
                              :{current.port}
                            </span>
                          ) : null}
                        </button>
                        <Switch
                          aria-invalid={
                            !!form.getFieldState(`protocols.${i}.enable`).error
                          }
                          aria-label={t(
                            "protocol_enabled",
                            "Enable {{protocol}}",
                            { protocol: type }
                          )}
                          checked={isEnabled}
                          data-form-field={`protocols.${i}.enable`}
                          disabled={Boolean(
                            serverId &&
                              isEnabled &&
                              defaultValues.protocols[i]?.enable &&
                              (!nodeReferencesReady() ||
                                isProtocolUsedInNodes(serverId, type))
                          )}
                          onCheckedChange={(checked) => {
                            form.setValue(`protocols.${i}.enable`, checked, {
                              shouldDirty: true,
                            });
                            form.clearErrors(`protocols.${i}` as any);
                            if (checked) setSelectedProtocol(type);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="admin-protocol-canvas">
                  <div className="admin-protocol-canvas__header">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-foreground text-sm capitalize tracking-[-0.01em]">
                        {activeProtocolType}
                      </h4>
                      <StatusChip
                        pulse={activeEnabled}
                        tone={activeEnabled ? "success" : "neutral"}
                      >
                        {activeEnabled
                          ? t("enabled", "Enabled")
                          : t("disabled", "Disabled")}
                      </StatusChip>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeData.transport ? (
                        <Badge
                          className="font-mono text-[11px] tabular-nums"
                          variant="secondary"
                        >
                          {String(activeData.transport).toUpperCase()}
                        </Badge>
                      ) : null}
                      {activeData.security &&
                        activeData.security !== "none" && (
                          <Badge
                            className="font-mono text-[11px] tabular-nums"
                            variant="outline"
                          >
                            {String(activeData.security).toUpperCase()}
                          </Badge>
                        )}
                      {activeData.port ? (
                        <Badge
                          className="font-mono text-[11px] tabular-nums"
                          variant="outline"
                        >
                          :{activeData.port}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {!activeEnabled && (
                    <p className="mb-4 rounded-md border border-border bg-muted/35 px-3 py-2 text-muted-foreground text-xs">
                      {t(
                        "disabledProtocolHint",
                        "This protocol is off. After configuring it, enable the switch beside its heading to save these changes."
                      )}
                    </p>
                  )}

                  <div className="admin-protocol-groups space-y-5">
                    {activeProtocolType === "nowhere" && (
                      <p className="text-muted-foreground text-xs">
                        {t(
                          "nowhere_description",
                          "NW3 · TLS 1.3 · ALPN nw3. Use an NW3 client with the same Morph setting."
                        )}
                      </p>
                    )}
                    {renderGroupCard(
                      t("basic", "Basic Configuration"),
                      activeFields,
                      "basic",
                      control,
                      form,
                      activeIndex,
                      activeData
                    )}
                    {renderGroupCard(
                      t("obfs", "Obfuscation"),
                      activeFields,
                      "obfs",
                      control,
                      form,
                      activeIndex,
                      activeData
                    )}
                    {renderGroupCard(
                      t("transport", "Transport"),
                      activeFields,
                      "transport",
                      control,
                      form,
                      activeIndex,
                      activeData
                    )}
                    {renderGroupCard(
                      t("security", "Security"),
                      activeFields,
                      "security",
                      control,
                      form,
                      activeIndex,
                      activeData
                    )}
                    {renderGroupCard(
                      t("reality", "Reality"),
                      activeFields,
                      "reality",
                      control,
                      form,
                      activeIndex,
                      activeData
                    )}
                    {renderGroupCard(
                      t("encryption", "Encryption"),
                      activeFields,
                      "encryption",
                      control,
                      form,
                      activeIndex,
                      activeData
                    )}
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </ScrollArea>
        <WorkspaceDialogFooter className="flex-row justify-end gap-2">
          <Button
            disabled={loading || safety.busy}
            onClick={() => safety.requestOpenChange(false)}
            variant="outline"
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            disabled={loading || safety.busy || saveDisabled}
            loading={loading || safety.submitting}
            loadingLabel={t("components:actions.processing")}
            onClick={submitForm}
          >
            {t("confirm", "Confirm")}
          </Button>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
      {safety.dialogs}
    </WorkspaceDialog>
  );
}
