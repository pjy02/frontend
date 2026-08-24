"use client";

import { Editor, type Monaco, type OnMount } from "@monaco-editor/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useSize } from "ahooks";
import { EyeIcon, EyeOff, FullscreenIcon, MinimizeIcon } from "lucide-react";
import DraculaTheme from "monaco-themes/themes/Dracula.json" with {
  type: "json",
};
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface MonacoEditorProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  onBlur?: (value: string | undefined) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  render?: (value?: string) => React.ReactNode;
  onMount?: OnMount;
  beforeMount?: (monaco: Monaco) => void;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
  readOnly?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function MonacoEditor({
  value: propValue,
  onChange,
  onBlur,
  title,
  description,
  placeholder,
  render,
  onMount,
  beforeMount,
  language = "markdown",
  className,
  showLineNumbers = false,
  readOnly = false,
}: MonacoEditorProps) {
  const { t } = useTranslation("components");
  const resolvedTitle = title ?? t("editor.title", "Editor");
  const resolvedPlaceholder =
    placeholder ?? t("editor.placeholder", "Start typing...");
  const [internalValue, setInternalValue] = useState<string | undefined>(
    propValue
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const size = useSize(ref);

  useEffect(() => {
    // Only update internalValue if propValue has actually changed and is different from current value
    if (propValue !== internalValue) {
      setInternalValue(propValue);
    }
  }, [propValue]);

  const debouncedOnChange = useRef(
    debounce((newValue: string | undefined) => {
      if (onChange) {
        onChange(newValue);
      }
    }, 300)
  ).current;

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    if (onMount) onMount(editor, monaco);

    editor.onDidChangeModelContent(() => {
      const newValue = editor.getValue();
      setInternalValue(newValue);
      debouncedOnChange(newValue);
    });

    editor.onDidBlurEditorWidget(() => {
      if (onBlur) {
        onBlur(editor.getValue());
      }
    });
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const togglePreview = () => setIsPreviewVisible(!isPreviewVisible);

  return (
    <div className="size-full" ref={ref}>
      <div style={size}>
        <div
          className={cn(
            "flex size-full min-h-96 flex-col rounded-md border",
            className,
            {
              "!mt-0 fixed inset-0 z-50 h-screen bg-background": isFullscreen,
            }
          )}
        >
          <div className="flex items-center justify-between border-b p-2">
            <div>
              <h1 className="text-left font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {resolvedTitle}
              </h1>
              <p className="text-[0.8rem] text-muted-foreground">
                {description}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {render && (
                <Button
                  aria-label={
                    isPreviewVisible
                      ? t("editor.hidePreview", "Hide preview")
                      : t("editor.showPreview", "Show preview")
                  }
                  onClick={togglePreview}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  {isPreviewVisible ? <EyeOff /> : <EyeIcon />}
                </Button>
              )}
              <Button
                aria-label={
                  isFullscreen
                    ? t("editor.exitFullscreen", "Exit fullscreen")
                    : t("editor.enterFullscreen", "Enter fullscreen")
                }
                onClick={toggleFullscreen}
                size="icon"
                type="button"
                variant="outline"
              >
                {isFullscreen ? <MinimizeIcon /> : <FullscreenIcon />}
              </Button>
            </div>
          </div>

          <div className={cn("relative flex flex-1")}>
            <div
              className={cn("flex-1 overflow-auto p-4 invert dark:invert-0", {
                "w-1/2": isPreviewVisible,
              })}
            >
              <Editor
                beforeMount={(monaco: Monaco) => {
                  monaco.editor.defineTheme("transparentTheme", {
                    base: DraculaTheme.base as "vs" | "vs-dark" | "hc-black",
                    inherit: DraculaTheme.inherit,
                    rules: DraculaTheme.rules,
                    colors: {
                      ...DraculaTheme.colors,
                      "editor.background": "#00000000",
                    },
                  });
                  if (beforeMount) {
                    beforeMount(monaco);
                  }
                }}
                className=""
                language={language}
                onChange={(newValue) => {
                  setInternalValue(newValue);
                  debouncedOnChange(newValue);
                }}
                onMount={handleEditorDidMount}
                options={{
                  automaticLayout: true,
                  contextmenu: false,
                  folding: false,
                  fontSize: 14,
                  formatOnPaste: true,
                  formatOnType: true,
                  glyphMargin: false,
                  lineNumbers: showLineNumbers ? "on" : "off",
                  minimap: { enabled: false },
                  overviewRulerLanes: 0,
                  renderLineHighlight: "none",
                  scrollBeyondLastLine: false,
                  scrollbar: {
                    useShadows: false,
                    vertical: "auto",
                  },
                  tabSize: 2,
                  wordWrap: "off",
                  readOnly,
                }}
                theme="transparentTheme"
                value={internalValue}
              />
              {!internalValue?.trim() && resolvedPlaceholder && (
                <pre
                  className={cn(
                    "pointer-events-none absolute top-4 left-7 text-muted-foreground text-sm",
                    {
                      "left-16": showLineNumbers,
                    }
                  )}
                  style={{ userSelect: "none" }}
                >
                  {resolvedPlaceholder}
                </pre>
              )}
            </div>
            {render && isPreviewVisible && (
              <div className="w-1/2 flex-1 overflow-auto border-l p-4">
                {render(internalValue)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
