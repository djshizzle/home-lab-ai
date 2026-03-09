import clsx from "clsx";

interface Props {
  status: string;
  size?: "sm" | "md";
}

const statusStyles: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  resolved: "bg-green-500/20 text-green-300 border border-green-500/30",
  error: "bg-red-500/20 text-red-300 border border-red-500/30",
  online: "bg-green-500/20 text-green-300 border border-green-500/30",
  offline: "bg-red-500/20 text-red-300 border border-red-500/30",
  degraded: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  maintenance: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  unknown: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

const priorityStyles: Record<string, string> = {
  critical: "bg-red-600/30 text-red-200 border border-red-600/50",
  high: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  medium: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  low: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

export function StatusBadge({ status, size = "md" }: Props) {
  const style =
    statusStyles[status] ?? priorityStyles[status] ?? statusStyles.unknown;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-medium capitalize",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        style
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
