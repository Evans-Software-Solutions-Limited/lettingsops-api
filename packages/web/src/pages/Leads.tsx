import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconSearch } from "@tabler/icons-react";

// Mock data - in production, use TanStack Query
const allLeads = [
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
  {
    id: "6",
    name: "Lisa Anderson",
    property: "120 Elm Street",
    type: "Maintenance",
    status: "resolved",
    date: "1 week ago",
  },
  {
    id: "7",
    name: "James Taylor",
    property: "33 King Road",
    type: "Viewing Enquiry",
    status: "new",
    date: "5 days ago",
  },
  {
    id: "8",
    name: "Rachel Lee",
    property: "76 Queen Lane",
    type: "General Enquiry",
    status: "in_progress",
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

export default function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredLeads = allLeads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.property.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text">Leads</h1>
        <p className="text-sm text-muted mt-2">
          Manage all viewing enquiries, maintenance requests, and general
          enquiries
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="bg-surface-raised border-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text">Search</label>
            <div className="relative">
              <IconSearch
                size={18}
                className="absolute left-3 top-2.5 text-muted"
              />
              <Input
                placeholder="Search by name or property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-surface border-border text-text"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-surface border-border text-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-elevated border-border">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">Type</label>
            <Select>
              <SelectTrigger className="bg-surface border-border text-text">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-surface-elevated border-border">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="viewing">Viewing Enquiry</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="general">General Enquiry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Leads Table */}
      <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-surface border-b border-border">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted">Name</TableHead>
              <TableHead className="text-muted">Property</TableHead>
              <TableHead className="text-muted">Type</TableHead>
              <TableHead className="text-muted">Status</TableHead>
              <TableHead className="text-muted text-right">Date</TableHead>
              <TableHead className="text-muted text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
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
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-accent hover:bg-surface-elevated"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/leads/${lead.id}`);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="border-border hover:bg-transparent cursor-default">
                <TableCell colSpan={6} className="text-center py-8 text-muted">
                  No leads found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing {filteredLeads.length} of {allLeads.length} leads
        </p>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-text hover:bg-surface-raised"
            disabled
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border text-text hover:bg-surface-raised"
            disabled
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
