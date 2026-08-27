import { persistPhotoList } from "@/lib/media";
import type { ProfileInput } from "@/lib/server/profiles";
import type { Profile } from "@/lib/types";
import { http } from "@/lib/http";

/** Load the signed-in user's own profile (null if not onboarded yet). */
export async function fetchMyProfile(): Promise<Profile | null> {
  const profile = await http<Profile | null>("/api/profile");
  return profile;
}

/** Create/update the signed-in user's profile after persisting any data-URL photos. */
export async function postProfile(input: ProfileInput): Promise<Profile> {
  const photos = await persistPhotoList(input.photos ?? []);
  return http<Profile>("/api/profile", { ...input, photos });
}
