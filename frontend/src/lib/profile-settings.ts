import {
  DEFAULT_USER_PROFILE_SETTINGS,
  UserProfileSettings,
  getUserProfileSettings,
  saveUserProfileSettings,
} from "./firestore";

const LOCAL_PREFIX = "profile-settings:";

function localKey(userId: string) {
  return `${LOCAL_PREFIX}${userId}`;
}

function readLocalSettings(userId: string): UserProfileSettings | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(localKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<UserProfileSettings>;
    return {
      printer: (parsed.printer as UserProfileSettings["printer"]) ?? DEFAULT_USER_PROFILE_SETTINGS.printer,
      printWidth: Number(parsed.printWidth ?? DEFAULT_USER_PROFILE_SETTINGS.printWidth),
      printHeight: Number(parsed.printHeight ?? DEFAULT_USER_PROFILE_SETTINGS.printHeight),
      printLength: Number(parsed.printLength ?? DEFAULT_USER_PROFILE_SETTINGS.printLength),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeLocalSettings(userId: string, settings: UserProfileSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localKey(userId), JSON.stringify(settings));
}

export async function loadEffectiveUserProfileSettings(userId: string): Promise<UserProfileSettings> {
  try {
    const remote = await getUserProfileSettings(userId);
    writeLocalSettings(userId, remote);
    return remote;
  } catch {
    const local = readLocalSettings(userId);
    return local ?? { ...DEFAULT_USER_PROFILE_SETTINGS };
  }
}

export async function saveEffectiveUserProfileSettings(
  userId: string,
  settings: UserProfileSettings
): Promise<"firestore" | "local"> {
  try {
    await saveUserProfileSettings(userId, settings);
    writeLocalSettings(userId, settings);
    return "firestore";
  } catch {
    writeLocalSettings(userId, settings);
    return "local";
  }
}
