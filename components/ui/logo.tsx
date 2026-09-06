import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 24, className }: LogoMarkProps) {
  const rx = Math.round(14 * size / 64);
  const sw = (5.5 * size / 64).toFixed(1);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="mo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx={rx} fill="url(#mo-bg)" />
      <path
        d="M13 51 L23 15 L32 33 L41 15 L51 51"
        stroke="white"
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  textColor?: string;
  showTagline?: boolean;
  className?: string;
}

export function Logo({ size = 28, textColor, showTagline = false, className }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          style={textColor ? { color: textColor } : undefined}
          className={cn(
            "font-semibold tracking-tight",
            size <= 20 ? "text-sm" : size <= 28 ? "text-[15px]" : "text-lg",
            !textColor && "text-inherit"
          )}
        >
          MetricOra
        </span>
        {showTagline && (
          <span className="text-[10px] text-white/40 font-normal tracking-wide mt-0.5">
            Measure what matters.
          </span>
        )}
      </span>
    </span>
  );
}
