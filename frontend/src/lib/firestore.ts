import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Query,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  FieldValue,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface FirebaseTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  isPublic: boolean;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  jsFile?: string;
  templateContent?: string;
}

export interface UserProfileSettings {
  printer: string;
  printWidth: number;
  printHeight: number;
  printLength: number;
  updatedAt?: string;
}

export const DEFAULT_USER_PROFILE_SETTINGS: UserProfileSettings = {
  printer: "creality_ender3v3ke.def.json",
  printWidth: 220,
  printHeight: 250,
  printLength: 220,
};

type TemplateLike = {
  id?: unknown;
  userId?: unknown;
  file?: unknown;
};

const normalizeTemplateKeyPart = (value: unknown): string => String(value ?? "").trim();

export function dedupeTemplates<T extends TemplateLike>(templates: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const template of templates) {
    const key = [
      normalizeTemplateKeyPart(template.id),
      normalizeTemplateKeyPart(template.userId),
      normalizeTemplateKeyPart(template.file),
    ].join("::");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(template);
  }

  return deduped;
}

/**
 * Save a template to Firestore
 */
export async function saveTemplateToFirestore(
  userId: string,
  template: FirebaseTemplate
): Promise<void> {
  const docRef = doc(db, "templates", userId, "items", template.id);
  
  const now = new Date().toISOString();
  
  await setDoc(docRef, {
    ...template,
    userId,
    createdAt: template.createdAt || now,
    updatedAt: now,
  });
}

/**
 * Get all templates for a user
 */
export async function getUserTemplates(
  userId: string
): Promise<FirebaseTemplate[]> {
  try {
    const templatesRef = collection(db, "templates", userId, "items");
    const snapshot = await getDocs(templatesRef);

    return snapshot.docs.map(doc => {
      const data = doc.data() as Omit<FirebaseTemplate, 'id'>;
      return {
        id: doc.id,
        ...data,
      } as FirebaseTemplate;
    });
  } catch {
    // Firestore rules can block reads for unauthenticated or non-owner users.
    return [];
  }
}

/**
 * Get all public templates
 */
export async function getPublicTemplates(): Promise<FirebaseTemplate[]> {
  try {
    const templatesRef = collection(db, "templates");
    const snapshot = await getDocs(templatesRef);

    const publicTemplates: FirebaseTemplate[] = [];

    for (const userDoc of snapshot.docs) {
      try {
        const itemsRef = collection(db, "templates", userDoc.id, "items");
        const itemsSnapshot = await getDocs(itemsRef);

        itemsSnapshot.docs.forEach(doc => {
          const data = doc.data() as Omit<FirebaseTemplate, 'id'>;
          if (data.isPublic) {
            publicTemplates.push({
              id: doc.id,
              ...data,
            } as FirebaseTemplate);
          }
        });
      } catch {
        // Ignore users whose templates are not readable under current rules.
      }
    }

    return publicTemplates;
  } catch {
    return [];
  }
}

/**
 * Get a specific template
 */
export async function getTemplate(
  userId: string,
  templateId: string
): Promise<FirebaseTemplate | null> {
  try {
    const docRef = doc(db, "templates", userId, "items", templateId);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data() as Omit<FirebaseTemplate, 'id'>;
      return {
        id: snapshot.id,
        ...data,
      } as FirebaseTemplate;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Update template metadata (owner only)
 */
export async function updateTemplateMetadata(
  userId: string,
  templateId: string,
  updates: Partial<FirebaseTemplate>
): Promise<FirebaseTemplate | null> {
  const docRef = doc(db, "templates", userId, "items", templateId);
  
  // Verify ownership by reading first
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists() || snapshot.data()?.userId !== userId) {
    return null;
  }
  
  const now = new Date().toISOString();
  const updateData = {
    ...updates,
    updatedAt: now,
  };
  
  await setDoc(docRef, updateData, { merge: true });
  
  const updated = await getDoc(docRef);
  if (updated.exists()) {
    const data = updated.data() as Omit<FirebaseTemplate, 'id'>;
    return {
      id: updated.id,
      ...data,
    } as FirebaseTemplate;
  }
  
  return null;
}

/**
 * Delete a template (owner only)
 */
export async function deleteTemplate(
  userId: string,
  templateId: string
): Promise<boolean> {
  const docRef = doc(db, "templates", userId, "items", templateId);
  
  // Verify ownership by reading first
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists() || snapshot.data()?.userId !== userId) {
    return false;
  }
  
  try {
    await deleteDoc(docRef);
    return true;
  } catch {
    return false;
  }
}

/**
 * Search templates by tag (public only)
 */
export async function searchTemplatesByTag(tag: string): Promise<FirebaseTemplate[]> {
  const templates = await getPublicTemplates();
  return templates.filter(t => t.tags.includes(tag));
}

/**
 * Build a composite templates list combining:
 * 1. Built-in templates
 * 2. User's private templates
 * 3. Public templates from other users
 */
export async function fetchAllAvailableTemplates(
  userId: string | null,
  builtInTemplates: any[]
): Promise<any[]> {
  try {
    const builtInOnly = builtInTemplates.filter((template) => !template?.userId);
    let allTemplates = [...builtInOnly];

    if (userId) {
      // Add user's own templates
      const userTemplates = await getUserTemplates(userId);
      allTemplates = allTemplates.concat(userTemplates);
    }

    // Add public templates
    const publicTemplates = await getPublicTemplates();
    allTemplates = allTemplates.concat(publicTemplates);

    return dedupeTemplates(allTemplates);
  } catch {
    // Keep app usable even when Firestore is unavailable or blocked.
    return dedupeTemplates([...builtInTemplates]);
  }
}

/**
 * Save or update profile settings for a user.
 */
export async function saveUserProfileSettings(
  userId: string,
  settings: UserProfileSettings
): Promise<void> {
  const docRef = doc(db, "users", userId, "settings", "profile");
  const now = new Date().toISOString();
  await setDoc(
    docRef,
    {
      ...settings,
      updatedAt: now,
    },
    { merge: true }
  );
}

/**
 * Load user profile settings; returns defaults when none exist.
 */
export async function getUserProfileSettings(
  userId: string
): Promise<UserProfileSettings> {
  const docRef = doc(db, "users", userId, "settings", "profile");
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return { ...DEFAULT_USER_PROFILE_SETTINGS };
  }

  const data = snapshot.data() as Partial<UserProfileSettings>;

  return {
    printer: (data.printer as UserProfileSettings["printer"]) ?? DEFAULT_USER_PROFILE_SETTINGS.printer,
    printWidth: Number(data.printWidth ?? DEFAULT_USER_PROFILE_SETTINGS.printWidth),
    printHeight: Number(data.printHeight ?? DEFAULT_USER_PROFILE_SETTINGS.printHeight),
    printLength: Number(data.printLength ?? DEFAULT_USER_PROFILE_SETTINGS.printLength),
    updatedAt: data.updatedAt,
  };
}

/**
 * Remove profile settings document for a user.
 */
export async function deleteUserProfileSettings(userId: string): Promise<void> {
  const docRef = doc(db, "users", userId, "settings", "profile");
  await deleteDoc(docRef);
}
