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
import { IconSearch, IconInbox } from "@tabler/icons-react";

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
        <h1 className="text-2xl font-semibold text-text tracking-tight">
          Leads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage viewing enquiries, maintenance requests, and general enquiries
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            stroke={1.5}
          />
          <Input
            placeholder="Search by name or property..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-raised border-border text-text h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-surface-raised border-border text-text w-40 h-9">
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

      {/* Leads Table */}
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
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
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
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="p-3 rounded-full bg-surface">
                      <IconInbox size={24} stroke={1.5} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">No leads found</p>
                      <p className="text-xs mt-0.5">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          Showing {filteredLeads.length} of {allLeads.length} leads
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground h-8 text-xs"
            disabled
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground h-8 text-xs"
            disabled
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
