import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  IconArrowLeft,
  IconCheck,
  IconCalendarEvent,
  IconSend,
} from "@tabler/icons-react";

// Mock data
const leadData = {
  id: "1",
  name: "John Smith",
  email: "john.smith@email.com",
  phone: "07700 123456",
  property: "15 Market Street",
  type: "Viewing Enquiry",
  status: "pending",
  budget: "£1,500 - £1,800 pcm",
  moveInDate: "2024-04-01",
  employment: "Software Engineer",
};

const messages = [
  {
    id: 1,
    author: "John Smith",
    direction: "inbound",
    content:
      "Hi, I'm interested in viewing the property at 15 Market Street. Is it available next week?",
    timestamp: "10:30 AM",
  },
  {
    id: 2,
    author: "You",
    direction: "outbound",
    content:
      "Hello John! Thank you for your interest. Yes, we have several viewing slots available next week. Would Wednesday at 2 PM work for you?",
    timestamp: "10:45 AM",
  },
  {
    id: 3,
    author: "John Smith",
    direction: "inbound",
    content:
      "Wednesday at 2 PM sounds great. Can you confirm the address and what I need to bring?",
    timestamp: "11:00 AM",
  },
  {
    id: 4,
    author: "You",
    direction: "outbound",
    content:
      "Perfect! Address is 15 Market Street, London SW1A 1AA. Please bring a form of ID and proof of current employment or income. See you then!",
    timestamp: "11:15 AM",
  },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  in_progress: "bg-accent/15 text-accent",
  resolved: "bg-success/15 text-success",
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
  };
  return labels[status] || status;
};

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="text-sm text-text">{children}</div>
    </div>
  );
}

export default function LeadDetail() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/leads")}
        className="gap-1.5 text-muted-foreground hover:text-text -ml-2 h-8"
      >
        <IconArrowLeft size={16} stroke={1.5} />
        Back to Leads
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-text tracking-tight">
          {leadData.name}
        </h1>
        <Badge
          className={`${STATUS_STYLES[leadData.status] ?? "bg-muted text-muted-foreground"} text-xs font-medium`}
        >
          {statusLabel(leadData.status)}
        </Badge>
      </div>

      {/* Main content - Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Qualification & Contact */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact Info */}
          <Card className="bg-surface-raised border-border p-5">
            <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-4">
              Contact
            </h3>
            <div className="space-y-3">
              <DetailField label="Email">
                <a
                  href={`mailto:${leadData.email}`}
                  className="text-accent hover:underline"
                >
                  {leadData.email}
                </a>
              </DetailField>
              <DetailField label="Phone">{leadData.phone}</DetailField>
            </div>
          </Card>

          {/* Property & Type */}
          <Card className="bg-surface-raised border-border p-5">
            <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-4">
              Property
            </h3>
            <div className="space-y-3">
              <DetailField label="Address">{leadData.property}</DetailField>
              <DetailField label="Enquiry Type">
                <Badge
                  variant="outline"
                  className="bg-accent/10 text-accent border-accent/20 text-xs"
                >
                  {leadData.type}
                </Badge>
              </DetailField>
            </div>
          </Card>

          {/* Qualification Fields */}
          <Card className="bg-surface-raised border-border p-5">
            <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-4">
              Qualification
            </h3>
            <div className="space-y-3">
              <DetailField label="Budget">{leadData.budget}</DetailField>
              <DetailField label="Move-in Date">
                {new Date(leadData.moveInDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </DetailField>
              <DetailField label="Employment">
                {leadData.employment}
              </DetailField>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button className="w-full bg-accent hover:bg-accent-dark text-white gap-2 h-9">
              <IconCheck size={16} stroke={2} />
              Mark Resolved
            </Button>
            <Button
              variant="outline"
              className="w-full border-border text-text hover:bg-surface-elevated gap-2 h-9"
            >
              <IconCalendarEvent size={16} stroke={1.5} />
              Schedule Viewing
            </Button>
          </div>
        </div>

        {/* Right column - Conversation Thread */}
        <div className="lg:col-span-2">
          <Card className="bg-surface-raised border-border flex flex-col h-full">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wide">
                Conversation
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.direction === "outbound"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 ${
                      msg.direction === "outbound"
                        ? "bg-accent/15 text-text rounded-2xl rounded-br-md"
                        : "bg-surface text-text border border-border rounded-2xl rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p
                      className={`text-[11px] mt-1.5 ${
                        msg.direction === "outbound"
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {msg.author} · {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="border-t border-border p-4">
              <div className="flex gap-3 items-end">
                <Textarea
                  placeholder="Type your reply..."
                  className="bg-surface border-border text-text resize-none flex-1 min-h-[40px]"
                  rows={1}
                />
                <Button
                  size="sm"
                  className="bg-accent hover:bg-accent-dark text-white h-9 px-4 shrink-0"
                >
                  <IconSend size={16} stroke={1.5} />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
