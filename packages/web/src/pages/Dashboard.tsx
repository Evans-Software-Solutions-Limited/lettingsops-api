import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconUsers,
  IconSparkles,
  IconTools,
  IconCalendarEvent,
  IconArrowRight,
} from "@tabler/icons-react";

// Mock data - in production, this would come from TanStack Query
const statCards = [
  {
    id: 1,
    label: "Total Leads",
    value: "142",
    icon: IconUsers,
    accent: "from-accent/20 to-accent/5",
    iconColor: "text-accent",
    ring: "ring-accent/10",
  },
  {
    id: 2,
    label: "New Today",
    value: "8",
    icon: IconSparkles,
    accent: "from-success/20 to-success/5",
    iconColor: "text-success",
    ring: "ring-success/10",
  },
  {
    id: 3,
    label: "Pending Maintenance",
    value: "12",
    icon: IconTools,
    accent: "from-warning/20 to-warning/5",
    iconColor: "text-warning",
    ring: "ring-warning/10",
  },
  {
    id: 4,
    label: "Viewings Scheduled",
    value: "5",
    icon: IconCalendarEvent,
    accent: "from-info/20 to-info/5",
    iconColor: "text-info",
    ring: "ring-info/10",
  },
];

const recentLeads = [
  {
    id: "1",
    name: "John Smith",
    property: "15 Market Street",
    type: "Viewing Enquiry",
    status: "pending",
    date: "Today",
  },
  {
    id: "2",
    name: "Sarah Johnson",
    property: "42 Park Avenue",
    type: "General Enquiry",
    status: "new",
    date: "Today",
  },
  {
    id: "3",
    name: "Michael Chen",
    property: "9 Oxford Lane",
    type: "Maintenance",
    status: "in_progress",
    date: "Yesterday",
  },
  {
    id: "4",
    name: "Emma Williams",
    property: "87 Bridge Road",
    type: "Viewing Enquiry",
    status: "resolved",
    date: "2 days ago",
  },
  {
    id: "5",
    name: "David Brown",
    property: "52 High Street",
    type: "General Enquiry",
    status: "pending",
    date: "3 days ago",
  },
];

const STATUS_STYLES: Record<string, string> = {
  new: "bg-info/15 text-info",
  pending: "bg-warning/15 text-warning",
  in_progress: "bg-accent/15 text-accent",
  resolved: "bg-success/15 text-success",
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    new: "New",
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
  };
  return labels[status] || status;
};

const TYPE_STYLES: Record<string, string> = {
  Maintenance: "bg-warning/10 text-warning border-warning/20",
  "Viewing Enquiry": "bg-accent/10 text-accent border-accent/20",
  "General Enquiry": "bg-muted/50 text-muted-foreground border-border",
};

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your lettings pipeline
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(
          ({ id, label, value, icon: Icon, accent, iconColor, ring }) => (
            <Card
              key={id}
              className={`relative overflow-hidden bg-surface-raised border-border p-5 ring-1 ${ring}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
                    {label}
                  </p>
                  <p className="text-3xl font-semibold text-text mt-2 tabular-nums">
                    {value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg bg-surface/50 ${iconColor}`}>
                  <Icon size={20} stroke={1.5} />
                </div>
              </div>
            </Card>
          ),
        )}
      </div>

      {/* Recent Leads Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Recent Leads</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest activity in your pipeline
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/leads")}
            className="text-accent hover:text-accent hover:bg-accent/10 gap-1"
          >
            View All
            <IconArrowRight size={16} stroke={1.5} />
          </Button>
        </div>

        {/* Table */}
        <Card className="bg-surface-raised border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Name
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Property
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Type
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wide text-right">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="border-border hover:bg-surface-elevated/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <TableCell className="text-text font-medium">
                    {lead.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.property}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${TYPE_STYLES[lead.type] ?? TYPE_STYLES["General Enquiry"]} border text-xs`}
                    >
                      {lead.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${STATUS_STYLES[lead.status] ?? "bg-muted text-muted-foreground"} text-xs font-medium`}
                    >
                      {statusLabel(lead.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {lead.date}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
