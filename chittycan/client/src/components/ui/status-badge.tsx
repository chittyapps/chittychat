import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "inactive" | "error";
  size?: "sm" | "md";
  label?: string;
}

export function StatusBadge({ status, size = "md", label }: StatusBadgeProps) {
  const statusConfig = {
    active: {
      bgColor: "bg-success/20",
      textColor: "text-success",
      dotColor: "bg-success",
      defaultLabel: "Active"
    },
    inactive: {
      bgColor: "bg-slate-100 dark:bg-slate-700",
      textColor: "text-slate-600 dark:text-slate-400",
      dotColor: "bg-slate-400",
      defaultLabel: "Inactive"
    },
    error: {
      bgColor: "bg-error/20",
      textColor: "text-error",
      dotColor: "bg-error",
      defaultLabel: "Error"
    }
  };
  
  const config = statusConfig[status];
  const finalLabel = label || config.defaultLabel;
  
  const sizeClasses = {
    sm: {
      badge: "px-2.5 py-0.5 text-xs",
      dot: "w-1.5 h-1.5 mr-1.5"
    },
    md: {
      badge: "px-3 py-1 text-sm",
      dot: "w-2 h-2 mr-2"
    }
  };
  
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      config.bgColor,
      config.textColor,
      sizeClasses[size].badge
    )}>
      <span className={cn(
        "rounded-full",
        config.dotColor,
        sizeClasses[size].dot
      )}></span>
      {finalLabel}
    </span>
  );
}
