import { useId } from "react";

// Santa Monica Eco Beach Resort — luxury mark: a rising sun above three waves,
// separated by negative space. Two brand colours only: deep navy and champagne gold.
const NAVY = "#17324D";
const GOLD = "#C5A46D";
const CREAM = "#F5EFE3";

type Tone = "light" | "dark";

export function LogoMark({ tone = "light", className }: { tone?: Tone; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wave = tone === "light" ? NAVY : CREAM;
  const bands = [
    { y: 71, w: 8.5 },
    { y: 86, w: 6.5 },
    { y: 100, w: 5 },
  ];

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-disc`}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
        <clipPath id={`${id}-sky`}>
          <rect x="0" y="0" width="120" height="55" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-sky)`}>
        <circle cx="60" cy="60" r="56" fill={GOLD} />
      </g>
      <g clipPath={`url(#${id}-disc)`} fill="none" stroke={wave}>
        {bands.map((band) => (
          <path
            key={band.y}
            d={`M-2 ${band.y} q15 -8 30 0 t30 0 t30 0 t30 0 t30 0`}
            strokeWidth={band.w}
          />
        ))}
      </g>
    </svg>
  );
}

export function BrandLogo({
  tone = "light",
  size = "md",
  className = "",
}: {
  tone?: Tone;
  size?: "md" | "lg";
  className?: string;
}) {
  const text = tone === "light" ? "text-[#17324D]" : "text-[#F5EFE3]";
  const markSize = size === "lg" ? "size-16" : "size-11";
  const nameSize = size === "lg" ? "text-2xl" : "text-[17px]";
  const subSize = size === "lg" ? "text-[10px]" : "text-[8px]";

  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark tone={tone} className={`${markSize} shrink-0`} />
      <span className={`leading-none ${text}`}>
        <span className={`block font-display font-medium uppercase tracking-[0.2em] ${nameSize}`}>
          Santa Monica
        </span>
        <span className="my-1.5 block h-px w-8" style={{ backgroundColor: GOLD }} />
        <span className={`block font-semibold uppercase tracking-[0.34em] opacity-80 ${subSize}`}>
          Eco Beach Resort
        </span>
      </span>
    </span>
  );
}
