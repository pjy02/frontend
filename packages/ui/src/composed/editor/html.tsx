"use client";

import {
  MonacoEditor,
  type MonacoEditorProps,
} from "@workspace/ui/composed/editor/monaco-editor";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export function HTMLEditor(props: MonacoEditorProps) {
  const { t } = useTranslation("components");

  return (
    <MonacoEditor
      description={t("editor.htmlDescription", "Supports HTML syntax")}
      title={t("editor.htmlTitle", "HTML editor")}
      {...props}
      language="markdown"
      render={(value) => (
        <HTMLPreview
          title={t("editor.htmlPreviewTitle", "HTML preview")}
          value={value}
        />
      )}
    />
  );
}

interface HTMLPreviewProps {
  title: string;
  value?: string;
}

function HTMLPreview({ title, value }: HTMLPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframeDocument = iframeRef.current?.contentDocument;
    if (iframeDocument) {
      iframeDocument.open();
      iframeDocument.write(value || "");
      iframeDocument.close();
    }
  }, [value]);

  return (
    <iframe className="h-full w-full border-0" ref={iframeRef} title={title} />
  );
}
