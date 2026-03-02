import { useNavigate, useParams } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconArrowLeft, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { useGetLead } from "@/hooks/api/useGetLead";
import { useGetLeadCommunication } from "@/hooks/api/useGetLeadCommunication";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: leadData, isLoading, error, isError } = useGetLead(id || "");
  const { data: communicationData, isLoading: commsLoading } =
    useGetLeadCommunication(id || "");

  if (!id) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
          className="text-accent hover:bg-surface-raised"
        >
          <IconArrowLeft size={20} />
          Back to Leads
        </Button>
        <div className="flex items-center gap-3 text-destructive">
          <IconAlertCircle size={20} />
          <div>
            <p className="font-medium">Lead not found</p>
            <p className="text-sm text-muted-foreground">
              The lead ID is missing or invalid.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/leads")}
            className="text-accent hover:bg-surface-raised"
          >
            <IconArrowLeft size={20} />
            Back to Leads
          </Button>
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !leadData) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
          className="text-accent hover:bg-surface-raised"
        >
          <IconArrowLeft size={20} />
          Back to Leads
        </Button>
        <div className="flex items-center gap-3 text-destructive">
          <IconAlertCircle size={20} />
          <div>
            <p className="font-medium">Error loading lead</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning text-white";
      case "in_progress":
        return "bg-accent text-white";
      case "resolved":
        return "bg-success text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      in_progress: "In Progress",
      resolved: "Resolved",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
          className="text-accent hover:bg-surface-raised"
        >
          <IconArrowLeft size={20} />
          Back to Leads
        </Button>
        <h1 className="text-3xl font-bold text-text">{leadData.name}</h1>
        <Badge className={statusBadgeColor(leadData.status)}>
          {statusLabel(leadData.status)}
        </Badge>
      </div>

      {/* Main content - Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Qualification & Contact */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact Info */}
          <Card className="bg-surface-raised border-border p-6 space-y-4">
            <h3 className="text-lg font-semibold text-text">Contact Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Email
                </p>
                <p className="text-text">{leadData.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Phone
                </p>
                <p className="text-text">{leadData.phone}</p>
              </div>
            </div>
          </Card>

          {/* Lead Info */}
          <Card className="bg-surface-raised border-border p-6 space-y-4">
            <h3 className="text-lg font-semibold text-text">Lead Details</h3>
            <div className="space-y-3">
              {leadData.propertyRef && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">
                    Property Ref
                  </p>
                  <p className="text-text">{leadData.propertyRef}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Source
                </p>
                <p className="text-text">{leadData.source}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Created
                </p>
                <p className="text-text">
                  {new Date(leadData.createdAt).toLocaleDateString()}
                </p>
              </div>
              {leadData.score !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">
                    Score
                  </p>
                  <p className="text-text">
                    {leadData.score}
                    {leadData.scoreCategory && ` (${leadData.scoreCategory})`}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button className="w-full bg-accent hover:bg-accent-dark text-white">
              <IconCheck size={18} className="mr-2" />
              Mark Resolved
            </Button>
            <Button
              variant="outline"
              className="w-full border-border text-text hover:bg-surface-raised"
            >
              Schedule Viewing
            </Button>
          </div>
        </div>

        {/* Right column - Conversation Thread */}
        <div className="lg:col-span-2">
          <Card className="bg-surface-raised border-border p-6 h-full flex flex-col space-y-4">
            <h3 className="text-lg font-semibold text-text">Conversation</h3>

            {/* Messages */}
            {commsLoading ? (
              <div className="flex-1 space-y-4 pr-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-2/3" />
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {communicationData &&
                communicationData.communications.length > 0 ? (
                  communicationData.communications.map((msg) => {
                    const content =
                      msg.body ||
                      msg.transcript?.map((t) => t.message).join(" ") ||
                      msg.subject ||
                      "No content available";
                    const timestamp = new Date(
                      msg.receivedAt,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const direction = msg.direction || msg.source || "inbound";

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${
                          direction === "outbound"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                            direction === "outbound"
                              ? "bg-accent text-white"
                              : "bg-surface text-text border border-border"
                          }`}
                        >
                          <p className="text-sm">{content}</p>
                          <p
                            className={`text-xs mt-2 ${
                              direction === "outbound"
                                ? "text-white/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {timestamp}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No communications yet
                  </p>
                )}
              </div>
            )}

            {/* Message Input */}
            <div className="border-t border-border pt-4 space-y-2">
              <Label
                htmlFor="message"
                className="text-sm text-muted-foreground"
              >
                Reply
              </Label>
              <Textarea
                id="message"
                placeholder="Type your reply here..."
                className="bg-surface border-border text-text resize-none"
                rows={3}
              />
              <Button className="w-full bg-accent hover:bg-accent-dark text-white">
                Send Message
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
