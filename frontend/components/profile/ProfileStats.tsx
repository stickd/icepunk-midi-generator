import { UserProfileResponse } from "@/lib/api";
import { Panel } from "@/components/ui";

type ProfileStatsProps = {
  profile: UserProfileResponse;
};

function compact(value: number) {
  if (value >= 1000) {
    const scaled = value / 1000;
    return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)}k`;
  }

  return String(value);
}

function memberSince(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function ProfileStats({ profile }: ProfileStatsProps) {
  const cells: Array<{ label: string; value: string }> = [
    { label: "Packs", value: compact(profile.packCount) },
    { label: "Downloads", value: compact(profile.totalDownloads) },
    { label: "Likes", value: compact(profile.totalLikes) },
    { label: "Member since", value: memberSince(profile.joinedAt) },
  ];

  return (
    <Panel className="grid grid-cols-2 divide-white/[0.06] sm:grid-cols-4 sm:divide-x">
      {cells.map((cell) => (
        <div className="grid gap-1 px-6 py-5 text-center" key={cell.label}>
          <span className="text-xl font-semibold text-ice-primary">{cell.value}</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-ice-muted">
            {cell.label}
          </span>
        </div>
      ))}
    </Panel>
  );
}
