import { Badge } from "@/components/ui/badge";
import { rentStatusLabel, ticketStatusLabel, ticketPriorityLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RentStatusBadge({ status }: { status: string }) {
  const cls = ({
    paid: "bg-[oklch(0.95_0.05_155)] text-[oklch(0.4_0.13_155)] border-[oklch(0.85_0.08_155)]",
    unpaid: "bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.13_75)] border-[oklch(0.85_0.1_75)]",
    overdue: "bg-[oklch(0.95_0.06_25)] text-[oklch(0.45_0.18_25)] border-[oklch(0.85_0.12_25)]",
  } as Record<string, string>)[status] ?? "";
  return <Badge variant="outline" className={cn("font-medium", cls)}>{rentStatusLabel[status] ?? status}</Badge>;
}

export function TicketStatusBadge({ status }: { status: string }) {
  const cls = ({
    new: "bg-[oklch(0.95_0.05_250)] text-[oklch(0.4_0.13_250)] border-[oklch(0.85_0.08_250)]",
    in_progress: "bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.13_75)] border-[oklch(0.85_0.1_75)]",
    awaiting_tenant: "bg-secondary text-secondary-foreground",
    done: "bg-[oklch(0.95_0.05_155)] text-[oklch(0.4_0.13_155)] border-[oklch(0.85_0.08_155)]",
  } as Record<string, string>)[status] ?? "";
  return <Badge variant="outline" className={cn("font-medium", cls)}>{ticketStatusLabel[status] ?? status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = ({
    low: "bg-muted text-muted-foreground",
    normal: "bg-secondary text-secondary-foreground",
    high: "bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.13_75)]",
    urgent: "bg-[oklch(0.95_0.06_25)] text-[oklch(0.45_0.18_25)]",
  } as Record<string, string>)[priority] ?? "";
  return <Badge variant="outline" className={cn("font-medium", cls)}>{ticketPriorityLabel[priority] ?? priority}</Badge>;
}