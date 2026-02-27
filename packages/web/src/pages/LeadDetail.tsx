import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";

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

export default function LeadDetail() {
  const navigate = useNavigate();

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

          {/* Property & Type */}
          <Card className="bg-surface-raised border-border p-6 space-y-4">
            <h3 className="text-lg font-semibold text-text">Property</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Address
                </p>
                <p className="text-text">{leadData.property}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Enquiry Type
                </p>
                <Badge
                  variant="outline"
                  className="bg-accent/10 text-accent border-accent/30"
                >
                  {leadData.type}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Qualification Fields */}
          <Card className="bg-surface-raised border-border p-6 space-y-4">
            <h3 className="text-lg font-semibold text-text">Qualification</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Budget
                </p>
                <p className="text-text">{leadData.budget}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Move-in Date
                </p>
                <p className="text-text">
                  {new Date(leadData.moveInDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Employment
                </p>
                <p className="text-text">{leadData.employment}</p>
              </div>
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
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      msg.direction === "outbound"
                        ? "bg-accent text-white"
                        : "bg-surface text-text border border-border"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p
                      className={`text-xs mt-2 ${
                        msg.direction === "outbound"
                          ? "text-white/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

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
