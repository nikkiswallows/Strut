import { cn } from "@/lib/utils";
import { BbcChip, Cage, Crown, Flame, Heart, Key, Lips, Lock, Medal, Spade } from "./graphics";
import type { AchievementIcon } from "@/lib/achievements";

/** Maps the achievement catalog's icon name to the hand-drawn SVG glyph. */
export function AchievementGlyph({
  icon,
  className,
}: {
  icon: AchievementIcon;
  className?: string;
}) {
  const cls = cn("size-full", className);
  switch (icon) {
    case "crown":
      return <Crown className={cls} />;
    case "cage":
      return <Cage className={cls} />;
    case "lips":
      return <Lips className={cls} />;
    case "lock":
      return <Lock className={cls} />;
    case "key":
      return <Key className={cls} />;
    case "heart":
      return <Heart className={cls} />;
    case "flame":
      return <Flame className={cls} />;
    case "medal":
      return <Medal className={cls} />;
    case "bbc":
      return <BbcChip className={cls} />;
    case "spade":
    default:
      return <Spade className={cls} />;
  }
}
