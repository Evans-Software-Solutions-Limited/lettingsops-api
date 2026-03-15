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
import { IconSearch, IconAlertCircle } from "@tabler/icons-react";
import { useListLeads } from "@/hooks/api/useListLeads";
import { Skeleton } from "@/components/ui/skeleton";

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
      return "bg-muted text-muted-foreground";
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

export default function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: leadsResponse, isLoading, error } = useListLeads();
  const leads = leadsResponse?.leads || [];

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = (lead.name || "")
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text">Leads</h1>
        <p className="text-sm text-muted-foreground mt-2">
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
                className="absolute left-3 top-2.5 text-muted-foreground"
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
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <IconAlertCircle size={20} />
              <div>
                <p className="font-medium">Error loading leads</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "An error occurred"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-surface border-b border-border">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Source</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Score
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Actions
                </TableHead>
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
                    <TableCell className="text-text">{lead.email}</TableCell>
                    <TableCell className="text-text">{lead.source}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeColor(lead.status)}>
                        {statusLabel(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {lead.score ? (
                        <>
                          <span className="font-medium">{lead.score}</span>
                          {lead.scoreCategory && (
                            <span className="text-xs ml-1">
                              ({lead.scoreCategory})
                            </span>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
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
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No leads found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination placeholder */}
      {!isLoading && !error && leadsResponse && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredLeads.length} of {leadsResponse.total} leads
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
      )}
    </div>
  );
}
