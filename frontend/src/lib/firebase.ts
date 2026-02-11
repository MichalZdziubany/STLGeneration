import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAQPQ_uI4drrJDqcxWEaT3sXkRL6kpw0Hw",
  authDomain: "stl-generation.firebaseapp.com",
  projectId: "stl-generation",
  storageBucket: "stl-generation.firebasestorage.app",
  messagingSenderId: "319472068850",
  appId: "1:319472068850:web:073f5ea2d8ecbe8c15c86b",
  measurementId: "G-GKQVHXEW9W"
};

// Initialize Firebase (only if not already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
