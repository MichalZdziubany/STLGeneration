export type AuthUser = {
  uid: string;
  email: string | null;
  displayName?: string | null;
};

const useMock = (process.env.NEXT_PUBLIC_AUTH_MOCK ?? "true").toLowerCase() === "true";

function makeMockUser(email: string): AuthUser {
  return {
    uid: `mock-${Math.random().toString(36).slice(2)}`,
    email,
    displayName: email.split("@")[0],
  };
}

export async function signInWithEmail(email: string, _password: string): Promise<AuthUser> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 500));
    return makeMockUser(email);
  }
  throw new Error(
    "Auth not configured. Replace functions in src/lib/auth.ts with Firebase Auth (signInWithEmailAndPassword)."
  );
}

export async function signInWithGoogle(): Promise<AuthUser> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 500));
    return makeMockUser("mock.user@example.com");
  }
  throw new Error(
    "Auth not configured. Replace functions in src/lib/auth.ts with Firebase Auth (signInWithPopup/redirect with GoogleAuthProvider)."
  );
}

export async function signOut(): Promise<void> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 250));
    return;
  }
  throw new Error(
    "Auth not configured. Replace function in src/lib/auth.ts with Firebase Auth signOut()."
  );
}

export async function signUpWithEmail(email: string, _password: string): Promise<AuthUser> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 600));
    return makeMockUser(email);
  }
  throw new Error(
    "Auth not configured. Replace with Firebase Auth createUserWithEmailAndPassword."
  );
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 600));
    return;
  }
  throw new Error(
    "Auth not configured. Replace with Firebase Auth sendPasswordResetEmail."
  );
}

export async function resetPasswordWithCode(_code: string, _newPassword: string): Promise<void> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 600));
    return;
  }
  throw new Error(
    "Auth not configured. Replace with Firebase Auth confirmPasswordReset."
  );
}
