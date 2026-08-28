import { persistPhotoList } from "@/lib/media";
import type { ProfileInput } from "@/lib/server/profiles";
import type { Profile } from "@/lib/types";
import { http } from "@/lib/http";

/** Load the signed-in user's own profile (null if not onboarded yet). */
export async function fetchMyProfile(): Promise<Profile | null> {
  const profile = await http<Profile | null>("/api/profile");
  return profile;
}

/**
 * Create/update the signed-in user's profile after persisting any data-URL
 * photos. Returns the saved profile with its photo/placeholder arrays aligned.
 *
 * `birthDate` is required on the first save (the 18+ gate) and ignored on every
 * later one — an editable date of birth is not a gate.
 */
export async function postProfile(input: ProfileInput): Promise<Profile> {
  const { photos, blurs } = await persistPhotoList(
    input.photos ?? [],
    (input as { photoBlurs?: string[] }).photoBlurs ?? [],
  );
  return http<Profile>("/api/profile", { ...input, photos, photoBlurs: blurs });
}
