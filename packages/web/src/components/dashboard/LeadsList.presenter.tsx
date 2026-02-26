import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChevronRight } from "@tabler/icons-react";

export interface Lead {
  id: string;
  name: string;
  email: string;
  status: string;
  score?: number | null;
  scoreCategory?: string | null;
  createdAt: string;
  property?: string;
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

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  NEW: { bg: "bg-[#3f3f46]", text: "text-[#f4f4f5]" },
  CONTACTED: { bg: "bg-[#1e40af]", text: "text-[#7dd3fc]" },
  QUALIFYING: { bg: "bg-[#92400e]", text: "text-[#fed7aa]" },
  QUALIFIED: { bg: "bg-[#4f46e5]", text: "text-[#c7d2fe]" },
  VIEWING_BOOKED: { bg: "bg-[#065f46]", text: "text-[#86efac]" },
  CONVERTED: { bg: "bg-[#14532d]", text: "text-[#86efac]" },
  ARCHIVED: { bg: "bg-[#27272a]", text: "text-[#a1a1aa]" },
};

const STATUS_OPTIONS = [
  "All",
  "NEW",
  "CONTACTED",
  "QUALIFYING",
  "QUALIFIED",
  "VIEWING_BOOKED",
  "CONVERTED",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
    <Card className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl overflow-hidden">
      {/* Header with Title and Filters */}
      <div className="p-6 border-b border-[#2a2d3e]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Leads</h2>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const value = s === "All" ? "" : s;
            const active = selectedStatus === value;
            return (
              <button
                key={s}
                onClick={() => onStatusFilter(value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors duration-150 ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "bg-[#252840] text-[#8b8fa8] hover:bg-[#2a2d3e] hover:text-[#e8e9f0]"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2d3e] text-[#8b8fa8] text-xs uppercase tracking-wide">
              <th className="text-left px-6 py-4 font-semibold">Name</th>
              <th className="text-left px-6 py-4 font-semibold">Property</th>
              <th className="text-left px-6 py-4 font-semibold">Status</th>
              <th className="text-left px-6 py-4 font-semibold">Score</th>
              <th className="text-left px-6 py-4 font-semibold">Date Received</th>
              <th className="text-center px-6 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-[#8b8fa8]"
                >
                  Loading leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-[#8b8fa8]"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl">📭</div>
                    <p>No leads yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const statusStyle = STATUS_STYLES[lead.status] || STATUS_STYLES.NEW;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="border-b border-[#2a2d3e] last:border-0 hover:bg-[#252840] cursor-pointer transition-colors duration-150"
                  >
                    {/* Name with avatar */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {lead.name}
                          </p>
                          <p className="text-xs text-[#8b8fa8] truncate">
                            {lead.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Property */}
                    <td className="px-6 py-4 text-[#8b8fa8] text-sm">
                      {lead.property || "—"}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {lead.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="px-6 py-4 text-[#8b8fa8] text-sm">
                      {lead.scoreCategory ? (
                        <span>{lead.scoreCategory}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-[#8b8fa8] text-sm">
                      {formatDate(lead.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-center">
                      <IconChevronRight
                        size={18}
                        className="text-[#8b8fa8] inline"
                        stroke={1.5}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2d3e]">
          <span className="text-xs text-[#8b8fa8]">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="border-[#2a2d3e] text-[#8b8fa8] hover:bg-[#252840]"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="border-[#2a2d3e] text-[#8b8fa8] hover:bg-[#252840]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
