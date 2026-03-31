import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconArrowLeft,
  IconMail,
  IconPhone,
  IconMessageCircle,
} from "@tabler/icons-react";

interface CommunicationLog {
  id: string;
  source: string;
  subject?: string;
  body?: string;
  receivedAt: string;
  direction?: string;
  transcript?: Array<{ role: string; message: string; timestamp: string }>;
}

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
  communications: CommunicationLog[];
  isLoading: boolean;
  isLoadingCommunication: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-muted text-muted-foreground",
  CONTACTED: "bg-blue-900/40 text-blue-300",
  QUALIFYING: "bg-amber-900/40 text-amber-300",
  QUALIFIED: "bg-teal-900/40 text-teal-300",
  VIEWING_BOOKED: "bg-emerald-900/40 text-emerald-300",
  CONVERTED: "bg-green-900/40 text-green-300",
  ARCHIVED: "bg-muted text-muted-foreground",
};

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSourceIcon(source: string) {
  switch (source) {
    case "email":
      return <IconMail size={16} />;
    case "phone":
      return <IconPhone size={16} />;
    default:
      return null;
  }
}

function SkeletonDetail() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-16 rounded" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="skeleton h-6 w-40 rounded" />
          <div className="skeleton h-4 w-32 rounded" />
          <Card className="bg-card border-border p-5">
            <div className="space-y-4">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-4 w-28 rounded" />
            </div>
          </Card>
        </div>
        <div className="col-span-2">
          <div className="skeleton h-6 w-48 rounded mb-4" />
          <div className="space-y-3">
            <div className="skeleton h-24 w-full rounded" />
            <div className="skeleton h-24 w-full rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeadDetail({
  lead,
  communications,
  isLoading,
  isLoadingCommunication,
}: LeadDetailProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm font-medium">Lead not found</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => navigate(-1)}
        >
          <IconArrowLeft size={16} />
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 h-8"
      >
        <IconArrowLeft size={16} />
        Back
      </Button>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Contact Info */}
        <div className="col-span-1 space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {lead.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{lead.email}</p>
          </div>

          {/* Status Badge */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
              Status
            </p>
            <span
              className={[
                "inline-flex items-center px-2.5 py-1 rounded text-xs font-medium",
                STATUS_STYLES[lead.status] ?? "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {lead.status.replace("_", " ")}
            </span>
          </div>

          {/* Details Card */}
          <Card className="bg-card border-border p-5">
            <div className="space-y-3.5">
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
              <Field label="Created" value={formatDate(lead.createdAt)} />
              <Field label="Updated" value={formatDate(lead.updatedAt)} />
            </div>
          </Card>
        </div>

        {/* Right Column - Communication Timeline */}
        <div className="col-span-2">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Communication Timeline
            </h2>

            {isLoadingCommunication ? (
              <div className="space-y-3">
                <div className="skeleton h-24 w-full rounded-lg" />
                <div className="skeleton h-24 w-full rounded-lg" />
                <div className="skeleton h-16 w-full rounded-lg" />
              </div>
            ) : communications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <div className="p-3 rounded-full bg-secondary">
                  <IconMessageCircle size={24} stroke={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">No communications yet</p>
                  <p className="text-xs mt-0.5">
                    Communications will appear here once received
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {communications.map((comm) => (
                  <Card
                    key={comm.id}
                    className="bg-card border-border p-4 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {getSourceIcon(comm.source) && (
                            <>
                              {getSourceIcon(comm.source)}
                              <span className="text-xs font-medium text-muted-foreground capitalize">
                                {comm.source}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatDate(comm.receivedAt)}
                        </span>
                      </div>

                      {/* Subject (for emails) */}
                      {comm.subject && (
                        <p className="text-sm font-medium text-foreground">
                          {comm.subject}
                        </p>
                      )}

                      {/* Body (for emails) */}
                      {comm.body && (
                        <div className="bg-muted/30 p-3 rounded-lg text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                          {comm.body}
                        </div>
                      )}

                      {/* Transcript (for phone calls) */}
                      {comm.transcript && comm.transcript.length > 0 && (
                        <div className="space-y-2">
                          {comm.transcript.map((msg, idx) => (
                            <div
                              key={idx}
                              className={[
                                "px-3 py-2 rounded-lg text-sm",
                                msg.role === "agent"
                                  ? "bg-blue-900/20 text-blue-300"
                                  : "bg-amber-900/20 text-amber-300",
                              ].join(" ")}
                            >
                              <p className="font-medium text-[11px] mb-1 opacity-70 uppercase tracking-wider">
                                {msg.role === "agent" ? "Agent" : "Caller"}
                              </p>
                              <p className="leading-relaxed">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
