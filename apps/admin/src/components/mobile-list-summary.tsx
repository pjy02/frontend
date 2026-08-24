import { Button } from "@workspace/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface MobileSummaryField {
  label: ReactNode;
  value: ReactNode;
  wide?: boolean;
}

interface MobileListSummaryProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  fields?: MobileSummaryField[];
  details?: MobileSummaryField[];
}

function FieldGrid({ fields }: { fields: MobileSummaryField[] }) {
  return (
    <dl className="admin-mobile-summary__grid">
      {fields.map((field, index) => (
        <div
          className={field.wide ? "col-span-2 min-w-0" : "min-w-0"}
          key={`${String(field.label)}-${index}`}
        >
          <dt className="admin-mobile-record__label">{field.label}</dt>
          <dd className="admin-mobile-summary__value">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MobileListSummary({
  title,
  subtitle,
  leading,
  trailing,
  fields = [],
  details = [],
}: MobileListSummaryProps) {
  const { t } = useTranslation("components");

  return (
    <div className="admin-mobile-summary">
      <div className="admin-mobile-summary__header">
        {leading ? (
          <div className="admin-mobile-summary__leading">{leading}</div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="admin-mobile-summary__title">{title}</div>
          {subtitle ? (
            <div className="admin-mobile-summary__subtitle">{subtitle}</div>
          ) : null}
        </div>
        {trailing ? (
          <div className="admin-mobile-summary__trailing">{trailing}</div>
        ) : null}
      </div>
      {fields.length ? <FieldGrid fields={fields} /> : null}
      {details.length ? (
        <Collapsible className="admin-mobile-summary__disclosure">
          <CollapsibleTrigger asChild>
            <Button
              className="admin-mobile-record__disclosure-trigger group"
              size="sm"
              variant="ghost"
            >
              <span>{t("table.moreDetails", "More details")}</span>
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldGrid fields={details} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
