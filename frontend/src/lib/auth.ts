import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName?: string | null;
};

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return toAuthUser(credential.user);
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return toAuthUser(credential.user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return toAuthUser(credential.user);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function resetPasswordWithCode(code: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, code, newPassword);
}
