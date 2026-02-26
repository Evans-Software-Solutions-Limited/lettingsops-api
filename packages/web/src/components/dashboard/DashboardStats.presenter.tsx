import { Card } from "@/components/ui/card";
import {
  IconUsers,
  IconPhoneCall,
  IconClipboardCheck,
  IconCheck,
} from "@tabler/icons-react";

interface DashboardStatsProps {
  total: number;
  byStatus: Record<string, number>;
  isLoading: boolean;
}

interface StatCard {
  key: string;
  label: string;
  icon: typeof IconUsers;
  iconBgColor: string;
  iconColor: string;
}

const statConfig: StatCard[] = [
  {
    key: "total",
    label: "Total Leads",
    icon: IconUsers,
    iconBgColor: "bg-indigo-500/20",
    iconColor: "text-indigo-400",
  },
  {
    key: "active",
    label: "Active",
    icon: IconPhoneCall,
    iconBgColor: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    key: "qualified",
    label: "Qualified",
    icon: IconClipboardCheck,
    iconBgColor: "bg-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    key: "converted",
    label: "Converted",
    icon: IconCheck,
    iconBgColor: "bg-green-500/20",
    iconColor: "text-green-400",
  },
];

export function DashboardStats({
  total,
  byStatus,
  isLoading,
}: DashboardStatsProps) {
  const getValue = (key: string) => {
    if (key === "total") return total;
    if (key === "active") {
      return (
        (byStatus.NEW ?? 0) +
        (byStatus.CONTACTED ?? 0) +
        (byStatus.QUALIFYING ?? 0)
      );
    }
    if (key === "qualified") {
      return (
        (byStatus.QUALIFIED ?? 0) + (byStatus.VIEWING_BOOKED ?? 0)
      );
    }
    if (key === "converted") {
      return byStatus.CONVERTED ?? 0;
    }
    return 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {statConfig.map(({ key, label, icon: Icon, iconBgColor, iconColor }) => (
        <Card
          key={key}
          className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-5 transition-colors duration-150 hover:bg-[#252840]"
        >
          {/* Top row: Icon + "vs last month" text */}
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-full ${iconBgColor} flex items-center justify-center`}>
              <Icon size={20} className={iconColor} stroke={1.5} />
            </div>
            <span className="text-xs text-[#8b8fa8]">vs last month</span>
          </div>

          {/* Big number */}
          <div className="text-3xl font-bold text-white mt-3">
            {isLoading ? "—" : getValue(key)}
          </div>

          {/* Label */}
          <p className="text-sm text-[#8b8fa8] mt-1">{label}</p>
        </Card>
      ))}
    </div>
  );
}
