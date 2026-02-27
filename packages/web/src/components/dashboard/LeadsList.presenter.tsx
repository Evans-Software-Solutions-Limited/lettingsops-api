import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface Lead {
  id: string;
  name: string;
  email: string;
  status: string;
  score?: number | null;
  scoreCategory?: string | null;
  createdAt: string;
}

interface LeadsListProps {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  selectedStatus: string;
  onPageChange: (page: number) => void;
  onStatusFilter: (status: string) => void;
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

const STATUS_OPTIONS = [
  "All",
  "NEW",
  "CONTACTED",
  "QUALIFYING",
  "QUALIFIED",
  "VIEWING_BOOKED",
  "CONVERTED",
  "ARCHIVED",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LeadsList({
  leads,
  total,
  page,
  limit,
  isLoading,
  selectedStatus,
  onPageChange,
  onStatusFilter,
}: LeadsListProps) {
  const navigate = useNavigate();
  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="bg-card border-border overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-border">
        {STATUS_OPTIONS.map((s) => {
          const value = s === "All" ? "" : s;
          const active = selectedStatus === value;
          return (
            <button
              key={s}
              onClick={() => onStatusFilter(value)}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wide">
              Name
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wide">
              Email
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wide">
              Status
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wide">
              Score
            </TableHead>
            <TableHead className="text-muted-foreground text-xs uppercase tracking-wide">
              Date
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                Loading leads...
              </TableCell>
            </TableRow>
          ) : leads.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => (
              <TableRow
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="border-border hover:bg-secondary/50 cursor-pointer transition-colors"
              >
                <TableCell className="font-medium text-foreground">
                  {lead.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.email}
                </TableCell>
                <TableCell>
                  <span
                    className={[
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      STATUS_STYLES[lead.status] ??
                        "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {lead.status.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.scoreCategory ? (
                    <span className="text-xs">{lead.scoreCategory}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDate(lead.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
