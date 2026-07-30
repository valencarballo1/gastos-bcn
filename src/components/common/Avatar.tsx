import type { HouseholdMember } from "@/types";

interface AvatarProps {
  member?: HouseholdMember;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export function Avatar({ member, size = "md", showName = false }: AvatarProps) {
  if (!member) return null;
  return (
    <span className="avatar-wrap">
      <span
        className={`avatar avatar-${size}`}
        style={{ backgroundColor: member.color }}
        aria-label={member.name}
      >
        {member.initials}
      </span>
      {showName && <span className="avatar-name">{member.name}</span>}
    </span>
  );
}
