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
  IconLayoutDashboard,
  IconUsers,
  IconTools,
  IconCalendarEvent,
} from "@tabler/icons-react";

// Mock data - in production, this would come from TanStack Query
const statCards = [
  {
    id: 1,
    label: "Total Leads",
    value: "142",
    icon: IconUsers,
    color: "text-accent",
  },
  {
    id: 2,
    label: "New Today",
    value: "8",
    icon: IconCalendarEvent,
    color: "text-success",
  },
  {
    id: 3,
    label: "Pending Maintenance",
    value: "12",
    icon: IconTools,
    color: "text-warning",
  },
  {
    id: 4,
    label: "Viewing Scheduled",
    value: "5",
    icon: IconLayoutDashboard,
    color: "text-info",
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

const statusBadgeColor = (status: string) => {
  switch (status) {
    case "new":
      return "bg-info text-white";
    case "pending":
      return "bg-warning text-white";
    case "in_progress":
      return "bg-accent text-white";
    case "resolved":
      return "bg-success text-white";
    default:
      return "bg-muted text-muted";
  }
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

const typeColor = (type: string) => {
  switch (type) {
    case "Maintenance":
      return "bg-warning/10 text-warning border-warning/30";
    case "Viewing Enquiry":
      return "bg-accent/10 text-accent border-accent/30";
    default:
      return "bg-muted text-muted border-border";
  }
};

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-muted mt-2">
          Overview of your lettings pipeline
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ id, label, value, icon: Icon, color }) => (
          <Card
            key={id}
            className="bg-surface-raised border-border p-6 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted font-medium">{label}</p>
                <p className="text-3xl font-bold text-text mt-2">{value}</p>
              </div>
              <Icon size={24} className={`${color} opacity-70`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Leads Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text">Recent Leads</h2>
            <p className="text-sm text-muted mt-1">
              Latest activity in your pipeline
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/leads")}
            className="border-border text-text hover:bg-surface-raised"
          >
            View All
          </Button>
        </div>

        {/* Table */}
        <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-surface border-b border-border">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted">Name</TableHead>
                <TableHead className="text-muted">Property</TableHead>
                <TableHead className="text-muted">Type</TableHead>
                <TableHead className="text-muted">Status</TableHead>
                <TableHead className="text-muted text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="border-border hover:bg-surface cursor-pointer transition-colors"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <TableCell className="text-text font-medium">
                    {lead.name}
                  </TableCell>
                  <TableCell className="text-text">{lead.property}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${typeColor(lead.type)} border`}
                    >
                      {lead.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadgeColor(lead.status)}>
                      {statusLabel(lead.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted">
                    {lead.date}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
