"use client";

import { useState, FormEvent, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { saveTemplateToFirestore } from "@/lib/firestore";

interface ExtractedParameter {
  name: string;
  type: string;
  description: string;
  default: any;
}

export default function TemplateUpload({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const apiBaseUrl = useMemo(() => {
    const serverDefault = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    if (typeof window === "undefined") return serverDefault;
    return process.env.NEXT_PUBLIC_API_URL_BROWSER ?? serverDefault;
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [parameters, setParameters] = useState<ExtractedParameter[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const extractParametersFromTemplate = (templateContent: string): ExtractedParameter[] => {
    const parameters: ExtractedParameter[] = [];
    const paramNamesSeen = new Set<string>();
    const lines = templateContent.split("\n");
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Pattern 1: {# @param paramName {type} description #}
      let paramMatch = line.match(/\{#\s*@param\s+(\w+)\s*(?:\{(\w+)\})?\s*(.*)?\s*#\}/);
      
      if (paramMatch) {
        const paramName = paramMatch[1];
        const paramType = paramMatch[2] || "number";
        const paramDescription = paramMatch[3] || "";
        
        if (!paramNamesSeen.has(paramName)) {
          // Look for default value in next few lines
          let defaultValue: any = 0;
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const varLine = lines[j].trim();
            const setMatch = varLine.match(
              new RegExp(`\\{%\\s*set\\s+${paramName}\\s*=\\s*([^%]+)\\s*%\\}`, 'i')
            );
            
            if (setMatch) {
              const defaultStr = setMatch[1].trim();
              if (defaultStr.toLowerCase() === "true") defaultValue = true;
              else if (defaultStr.toLowerCase() === "false") defaultValue = false;
              else if (!isNaN(Number(defaultStr))) {
                defaultValue = parseFloat(defaultStr);
              } else if (
                (defaultStr.startsWith('"') && defaultStr.endsWith('"')) ||
                (defaultStr.startsWith("'") && defaultStr.endsWith("'"))
              ) {
                defaultValue = defaultStr.slice(1, -1);
              }
              break;
            }
          }
          
          parameters.push({
            name: paramName,
            type: paramType,
            description: paramDescription,
            default: defaultValue,
          });
          paramNamesSeen.add(paramName);
        }
      }
      
      // Pattern 2: variableName = {{PARAMETER_NAME}};
      const jinjaVarMatch = line.match(/(\w+)\s*=\s*\{\{(\w+)\}\}\s*;/);
      
      if (jinjaVarMatch) {
        const localVar = jinjaVarMatch[1];  // e.g., "height"
        const paramName = jinjaVarMatch[2];  // e.g., "HEIGHT"
        
        if (!paramNamesSeen.has(paramName)) {
          // Look for comment on same line or previous line
          let description = "";
          const commentMatch = line.match(/\/\/\s*(.*)$/);
          if (commentMatch) {
            description = commentMatch[1].trim();
          } else if (i > 0) {
            const prevLine = lines[i - 1].trim();
            if (prevLine.startsWith("//")) {
              description = prevLine.substring(2).trim();
            }
          }
          
          parameters.push({
            name: paramName,
            type: "number",
            description: description || `${localVar} parameter`,
            default: 10,
          });
          paramNamesSeen.add(paramName);
        }
      }
    }
    
    return parameters;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      if (selectedFile.name.endsWith(".scad.j2")) {
        try {
          const content = await selectedFile.text();
          const extractedParams = extractParametersFromTemplate(content);
          setParameters(extractedParams);
          setShowPreview(true);
        } catch (error) {
          console.error("Error reading file:", error);
          setMessage({ type: "error", text: "Failed to read file" });
        }
      }
    }
  };

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
    if (!file.name.endsWith(".scad.j2")) {
      setMessage({ type: "error", text: "Only .scad.j2 files are supported" });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      // Read file content
      const templateContent = await file.text();
      
      // Prepare form data for backend upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", templateName);
      formData.append("description", description);
      formData.append("is_public", String(isPublic));
      formData.append("tags", tags);

      // Upload to backend
      const response = await fetch(`${apiBaseUrl}/templates/upload`, {
        method: "POST",
        headers: {
          "user-id": user.uid,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const result = await response.json();
      const templateId = result.template.id;

      // Save to Firestore
      await saveTemplateToFirestore(user.uid, {
        id: templateId,
        userId: user.uid,
        name: templateName,
        description: description,
        isPublic: isPublic,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        jsFile: `user-templates/${user.uid}/${templateId}/template.scad.j2`,
      });

      setMessage({ type: "success", text: "Template uploaded successfully!" });
      
      // Reset form
      setFile(null);
      setTemplateName("");
      setDescription("");
      setIsPublic(false);
      setTags("");
      setParameters([]);
      setShowPreview(false);
      
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Trigger callback
      onSuccess?.();
    } catch (error) {
      console.error("Upload error:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to upload template",
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
            Template Name *
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
            Template File (.scad.j2) *
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".scad.j2"
            onChange={handleFileChange}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-neutral-500 mt-1">
            Upload a Jinja2 OpenSCAD template file (.scad.j2)
          </p>
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium mb-1">
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., geometric, parametric, cube"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="is-public"
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded border-neutral-300 dark:border-neutral-700"
          />
          <label htmlFor="is-public" className="text-sm font-medium">
            Make template public (others can view and use)
          </label>
        </div>

        {showPreview && parameters.length > 0 && (
          <div className="rounded-md bg-neutral-50 dark:bg-neutral-900/30 p-4 border border-neutral-200 dark:border-neutral-800">
            <p className="text-sm font-medium mb-2">Detected Parameters:</p>
            <div className="space-y-2">
              {parameters.map((param) => (
                <div key={param.name} className="text-xs">
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {param.name}
                  </span>
                  <span className="text-neutral-500 ml-2">
                    ({param.type})
                  </span>
                  {param.description && (
                    <span className="text-neutral-600 dark:text-neutral-400 ml-2">
                      - {param.description}
                    </span>
                  )}
                  {param.default !== undefined && (
                    <span className="text-neutral-500 ml-2">
                      [default: {String(param.default)}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
