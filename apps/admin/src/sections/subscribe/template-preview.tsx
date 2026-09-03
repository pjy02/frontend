"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import { MonacoEditor } from "@workspace/ui/composed/editor/monaco-editor";
import { Icon } from "@workspace/ui/composed/icon";
import { getApplicationPreview as previewSubscribeTemplate } from "@workspace/ui/services/admin/admin";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/settings-workspace";

interface TemplatePreviewProps {
  applicationId: number;
  output_format?: string;
}

export function TemplatePreview({
  applicationId,
  output_format,
}: TemplatePreviewProps) {
  const { t } = useTranslation("subscribe");
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["previewSubscribeTemplate", applicationId],
    queryFn: () =>
      previewSubscribeTemplate(
        { id: applicationId },
        { skipErrorHandler: true }
      ),
    enabled: isOpen && !!applicationId,
    retry: false,
  });

  const originalContent = data?.data?.data?.template || "";
  const errorMessage =
    (error as any)?.data?.msg ||
    error?.message ||
    t("templatePreview.failed", "Failed to load template");

  const getDecodedContent = () => {
    if (output_format === "base64" && originalContent) {
      try {
        return atob(originalContent);
      } catch {
        return t("templatePreview.base64.decodeError", "Base64 decode error");
      }
    }
    return "";
  };

  const getDisplayContent = () => {
    if (error) return errorMessage;
    if (!originalContent) return "";
    switch (output_format) {
      case "base64": {
        const decoded = getDecodedContent();
        return `${t("templatePreview.base64.originalContent", "Original Content")}:\n${originalContent}\n\n${t("templatePreview.base64.decodedContent", "Decoded Content")}:\n${decoded}`;
      }
      default:
        return originalContent;
    }
  };
  const mapLanguage = (fmt?: string) => {
    switch (fmt) {
      case "json":
        return "json";
      case "yaml":
        return "yaml";
      case "base64":
        return "ini";
      case "plain":
        return "ini";
      case "conf":
        return "ini";
      default:
        return "ini";
    }
  };

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost">
          <Icon className="h-4 w-4" icon="mdi:eye" />
          {t("templatePreview.preview", "Preview")}
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-[800px] max-w-[90vw] md:max-w-screen-md"
        size="lg"
      >
        <SheetHeader>
          <SheetTitle>
            {t("templatePreview.title", "Template Preview")}
          </SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Icon className="h-6 w-6 animate-spin" icon="mdi:loading" />
            <span className="ml-2">
              {t("templatePreview.loading", "Loading...")}
            </span>
          </div>
        ) : (
          <div className="min-h-0 flex-1 p-5">
            <MonacoEditor
              language={mapLanguage(output_format)}
              readOnly
              showLineNumbers
              title={t("templatePreview.title", "Template Preview")}
              value={getDisplayContent()}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
