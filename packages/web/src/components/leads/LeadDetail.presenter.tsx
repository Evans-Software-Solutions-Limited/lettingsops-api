import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconMail, IconPhone } from "@tabler/icons-react";

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
  CONTACTED: "bg-blue-900/60 text-blue-300",
  QUALIFYING: "bg-amber-900/60 text-amber-300",
  QUALIFIED: "bg-teal-900/60 text-teal-300",
  VIEWING_BOOKED: "bg-emerald-900/60 text-emerald-300",
  CONVERTED: "bg-green-900/60 text-green-300",
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
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
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

export function LeadDetail({
  lead,
  communications,
  isLoading,
  isLoadingCommunication,
}: LeadDetailProps) {
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
    <div className="space-y-6">
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

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Contact Info */}
        <div className="col-span-1 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold text-foreground">{lead.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{lead.email}</p>
          </div>

          {/* Status Badge */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Status</p>
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
            <div className="space-y-4">
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
            <h2 className="text-lg font-semibold text-foreground">
              Communication Timeline
            </h2>

            {isLoadingCommunication ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                Loading communications...
              </div>
            ) : communications.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                No communications yet.
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
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comm.receivedAt)}
                        </span>
                      </div>

                      {/* Subject (for emails) */}
                      {comm.subject && (
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {comm.subject}
                          </p>
                        </div>
                      )}

                      {/* Body (for emails) */}
                      {comm.body && (
                        <div className="bg-muted/30 p-3 rounded text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
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
                                "px-3 py-2 rounded text-sm",
                                msg.role === "agent"
                                  ? "bg-blue-900/30 text-blue-300"
                                  : "bg-amber-900/30 text-amber-300",
                              ].join(" ")}
                            >
                              <p className="font-medium text-xs mb-1 opacity-75">
                                {msg.role === "agent" ? "Agent" : "Caller"}
                              </p>
                              <p>{msg.message}</p>
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
