import { FormControl } from "@workspace/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { Loader } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type SelectDropdownProps = {
  onValueChange?: (value: string) => void;
  defaultValue: string | undefined;
  placeholder?: string;
  isPending?: boolean;
  items: { label: string | ReactNode; value: string }[] | undefined;
  disabled?: boolean;
  className?: string;
  isControlled?: boolean;
};

export function SelectDropdown({
  defaultValue,
  onValueChange,
  isPending,
  items,
  placeholder,
  disabled,
  className = "",
  isControlled = false,
}: SelectDropdownProps) {
  const { t } = useTranslation("components");
  const defaultState = isControlled
    ? { value: defaultValue, onValueChange }
    : { defaultValue, onValueChange };
  return (
    <Select {...defaultState}>
      <FormControl>
        <SelectTrigger className={cn(className)} disabled={disabled}>
          <SelectValue
            placeholder={placeholder ?? t("select.placeholder", "Select")}
          />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {isPending ? (
          <SelectItem className="h-14" disabled value="loading">
            <div className="flex items-center justify-center gap-2">
              <Loader className="h-5 w-5 animate-spin" />
              {"  "}
              {t("loading", "Loading...")}
            </div>
          </SelectItem>
        ) : (
          items?.map(({ label, value }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
