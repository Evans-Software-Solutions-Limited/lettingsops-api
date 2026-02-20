import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  NEW: "bg-zinc-700 text-zinc-200",
  CONTACTED: "bg-blue-900/60 text-blue-300",
  QUALIFYING: "bg-amber-900/60 text-amber-300",
  QUALIFIED: "bg-teal-900/60 text-teal-300",
  VIEWING_BOOKED: "bg-emerald-900/60 text-emerald-300",
  CONVERTED: "bg-green-900/60 text-green-300",
  ARCHIVED: "bg-zinc-800 text-zinc-500",
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Score</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No leads found.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="border-b border-border last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {lead.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        STATUS_STYLES[lead.status] ??
                          "bg-zinc-700 text-zinc-200",
                      ].join(" ")}
                    >
                      {lead.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.scoreCategory ? (
                      <span className="text-xs">{lead.scoreCategory}</span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(lead.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
