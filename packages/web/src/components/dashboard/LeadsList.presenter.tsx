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
import {
  IconMail,
  IconPhone,
  IconGlobe,
  IconFileText,
  IconInbox,
} from "@tabler/icons-react";

export interface Lead {
  id: string;
  name: string;
  email: string;
  status: string;
  source: "email" | "phone" | "portal" | "manual";
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
  CONTACTED: "bg-blue-900/40 text-blue-300",
  QUALIFYING: "bg-amber-900/40 text-amber-300",
  QUALIFIED: "bg-teal-900/40 text-teal-300",
  VIEWING_BOOKED: "bg-emerald-900/40 text-emerald-300",
  CONVERTED: "bg-green-900/40 text-green-300",
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

function getSourceIcon(source: string) {
  switch (source) {
    case "email":
      return <IconMail size={16} className="text-muted-foreground" />;
    case "phone":
      return <IconPhone size={16} className="text-muted-foreground" />;
    case "portal":
      return <IconGlobe size={16} className="text-muted-foreground" />;
    default:
      return <IconFileText size={16} className="text-muted-foreground" />;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SkeletonRow() {
  return (
    <TableRow className="border-border">
      <TableCell>
        <div className="skeleton h-4 w-4 rounded mx-auto" />
      </TableCell>
      <TableCell>
        <div className="skeleton h-4 w-28 rounded" />
      </TableCell>
      <TableCell>
        <div className="skeleton h-4 w-36 rounded" />
      </TableCell>
      <TableCell>
        <div className="skeleton h-5 w-20 rounded" />
      </TableCell>
      <TableCell>
        <div className="skeleton h-4 w-12 rounded" />
      </TableCell>
      <TableCell>
        <div className="skeleton h-4 w-20 rounded" />
      </TableCell>
    </TableRow>
  );
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
      <div className="flex flex-wrap gap-1.5 p-4 border-b border-border">
        {STATUS_OPTIONS.map((s) => {
          const value = s === "All" ? "" : s;
          const active = selectedStatus === value;
          return (
            <button
              key={s}
              onClick={() => onStatusFilter(value)}
              className={[
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80",
              ].join(" ")}
            >
              {s.replace("_", " ")}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Channel
            </TableHead>
            <TableHead className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Name
            </TableHead>
            <TableHead className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Email
            </TableHead>
            <TableHead className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Status
            </TableHead>
            <TableHead className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Score
            </TableHead>
            <TableHead className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Date
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : leads.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="py-16">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="p-3 rounded-full bg-secondary">
                    <IconInbox size={24} stroke={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">No leads found</p>
                    <p className="text-xs mt-0.5">Try adjusting your filters</p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => (
              <TableRow
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="border-border hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2 justify-center">
                    {getSourceIcon(lead.source)}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {lead.name}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
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
                <TableCell className="text-muted-foreground text-xs tabular-nums">
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
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
