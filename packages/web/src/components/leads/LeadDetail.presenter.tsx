import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  IconArrowLeft,
  IconPhone,
  IconMapPin,
  IconCalendar,
  IconBriefcase,
} from "@tabler/icons-react";

interface ConversationMessage {
  id: string;
  type: "inbound" | "ai_reply";
  sender: string;
  content: string;
  timestamp: string;
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
  // Extended fields for qualification
  budget?: string | null;
  moveInDate?: string | null;
  employed?: boolean | null;
  messages?: ConversationMessage[];
}

interface LeadDetailProps {
  lead: LeadDetailData | null | undefined;
  isLoading: boolean;
  onReply?: (message: string) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  NEW: { bg: "bg-[#3f3f46]", text: "text-[#f4f4f5]" },
  CONTACTED: { bg: "bg-[#1e40af]", text: "text-[#7dd3fc]" },
  QUALIFYING: { bg: "bg-[#92400e]", text: "text-[#fed7aa]" },
  QUALIFIED: { bg: "bg-[#4f46e5]", text: "text-[#c7d2fe]" },
  VIEWING_BOOKED: { bg: "bg-[#065f46]", text: "text-[#86efac]" },
  CONVERTED: { bg: "bg-[#14532d]", text: "text-[#86efac]" },
  ARCHIVED: { bg: "bg-[#27272a]", text: "text-[#a1a1aa]" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function LeadDetail({ lead, isLoading, onReply }: LeadDetailProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8b8fa8] text-sm">
        Loading lead...
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8b8fa8] text-sm">
        Lead not found.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[lead.status] || STATUS_STYLES.NEW;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-2 text-[#8b8fa8] hover:text-[#e8e9f0] hover:bg-[#252840]"
      >
        <IconArrowLeft size={16} stroke={1.5} />
        Back
      </Button>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column (60%) */}
        <div className="col-span-2 space-y-6">
          {/* Lead Header Card */}
          <Card className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/30 text-indigo-300 text-sm font-bold flex items-center justify-center flex-shrink-0">
                {getInitials(lead.name)}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
                <p className="text-[#8b8fa8] text-sm mt-1">{lead.email}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {lead.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-[#8b8fa8]">
                    Received {formatDate(lead.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Conversation Thread Card */}
          <Card className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6 flex flex-col h-96">
            <h3 className="font-semibold text-white mb-4">Conversation</h3>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {lead.messages && lead.messages.length > 0 ? (
                lead.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.type === "inbound" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div className={msg.type === "inbound" ? "max-w-xs" : "max-w-xs"}>
                      {msg.type === "inbound" && (
                        <p className="text-xs text-[#8b8fa8] mb-1">{msg.sender}</p>
                      )}
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                          msg.type === "inbound"
                            ? "bg-[#252840] text-[#e8e9f0]"
                            : "bg-indigo-600 text-white"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.type === "ai_reply" && (
                        <p className="text-xs text-indigo-400 mt-1">AI</p>
                      )}
                      <p className="text-xs text-[#8b8fa8] mt-1">
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-[#8b8fa8] text-sm py-8">
                  No messages yet
                </p>
              )}
            </div>

            {/* Reply Box */}
            <div className="border-t border-[#2a2d3e] pt-4 space-y-2">
              <Textarea
                placeholder="Send reply..."
                className="bg-[#252840] border-[#2a2d3e] text-[#e8e9f0] placeholder-[#8b8fa8] text-sm h-20 resize-none"
              />
              <Button
                onClick={() => onReply?.("")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Send Reply
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column (40%) */}
        <div className="col-span-1 space-y-6">
          {/* Contact Info Card */}
          <Card className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Contact Info</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <IconPhone size={16} className="text-[#8b8fa8]" />
                  <p className="text-xs text-[#8b8fa8]">Phone</p>
                </div>
                <p className="text-sm text-white">
                  {lead.phone || "Not provided"}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <IconMapPin size={16} className="text-[#8b8fa8]" />
                  <p className="text-xs text-[#8b8fa8]">Property Interest</p>
                </div>
                <p className="text-sm text-white">
                  {lead.propertyRef || "Not specified"}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <IconBriefcase size={16} className="text-[#8b8fa8]" />
                  <p className="text-xs text-[#8b8fa8]">Source</p>
                </div>
                <p className="text-sm text-white">{lead.source}</p>
              </div>
            </div>
          </Card>

          {/* Qualification Card */}
          <Card className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Qualification</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#8b8fa8] mb-1">Budget</p>
                <p className="text-sm text-white">
                  {lead.budget || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8b8fa8] mb-1">Move-in Date</p>
                <p className="text-sm text-white">
                  {lead.moveInDate || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8b8fa8] mb-1">Employment Status</p>
                <p className="text-sm text-white">
                  {lead.employed !== null && lead.employed !== undefined
                    ? lead.employed
                      ? "Employed"
                      : "Not Employed"
                    : "Not specified"}
                </p>
              </div>
            </div>
          </Card>

          {/* Actions Card */}
          <Card className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
            <div className="space-y-3">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                <IconCalendar size={16} className="mr-2" />
                Book Viewing
              </Button>
              <Button
                variant="outline"
                className="w-full border-[#2a2d3e] text-[#e8e9f0] hover:bg-[#252840]"
              >
                Mark Qualified
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
