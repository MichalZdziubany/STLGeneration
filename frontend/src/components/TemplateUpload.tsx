"use client";

import { useState, FormEvent } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function TemplateUpload() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: "error", text: "You must be logged in to upload templates" });
      return;
    }
    if (!file) {
      setMessage({ type: "error", text: "Please select a file" });
      return;
    }
    if (!templateName.trim()) {
      setMessage({ type: "error", text: "Please enter a template name" });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      // Create a reference to the file in Firebase Storage
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const storagePath = `templates/${user.uid}/${timestamp}-${templateName}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);

      // Upload the file
      await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Here you would typically save metadata to Firestore or your backend
      console.log("Template uploaded:", {
        name: templateName,
        description,
        downloadURL,
        userId: user.uid,
        timestamp,
      });

      setMessage({ type: "success", text: "Template uploaded successfully!" });
      
      // Reset form
      setFile(null);
      setTemplateName("");
      setDescription("");
      
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      setMessage({ 
        type: "error", 
        text: error instanceof Error ? error.message : "Failed to upload template" 
      });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center">
        <p className="text-neutral-600 dark:text-neutral-400">
          Please log in to upload templates
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
      <h2 className="text-xl font-semibold mb-4">Upload Template</h2>
      
      {message && (
        <div
          className={`mb-4 rounded-md border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
              : "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="template-name" className="block text-sm font-medium mb-1">
            Template Name
          </label>
          <input
            id="template-name"
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My Custom Template"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your template..."
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium mb-1">
            Template File (.scad, .scad.j2)
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".scad,.j2"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload Template"}
        </button>
      </form>
    </div>
  );
}
