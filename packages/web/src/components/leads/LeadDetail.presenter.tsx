import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import { getStatusBadgeClass, formatDateFull } from "@/lib/utils";

interface LeadDetailData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  propertyRef?: string | null;
  status: string;
  source: string;
  score?: number | null;
  scoreCategory?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadDetailProps {
  lead: LeadDetailData | null | undefined;
  isLoading: boolean;
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export function LeadDetail({ lead, isLoading }: LeadDetailProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading lead...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Lead not found.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
      >
        <IconArrowLeft size={16} />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{lead.email}</p>
        </div>
        <span
          className={[
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150",
            getStatusBadgeClass(lead.status),
          ].join(" ")}
        >
          {lead.status.replace("_", " ")}
        </span>
      </div>

      {/* Details */}
      <Card className="bg-card border-border p-5 grid grid-cols-2 gap-5">
        <Field label="Phone" value={lead.phone} />
        <Field label="Property Ref" value={lead.propertyRef} />
        <Field label="Source" value={lead.source} />
        <Field
          label="Score"
          value={
            lead.score != null
              ? `${lead.score} (${lead.scoreCategory ?? "Unscored"})`
              : undefined
          }
        />
        <Field label="Created" value={formatDateFull(lead.createdAt)} />
        <Field label="Updated" value={formatDateFull(lead.updatedAt)} />
      </Card>
    </div>
  );
}
