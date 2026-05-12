"use client";

import { useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { uploadDocument } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; observations: unknown[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setFile(file);
    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const data = await uploadDocument(token, file);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleUpload(dropped);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (chosen) handleUpload(chosen);
  }

  const observations = result?.observations as Array<{
    code: string;
    value: number;
    unit: string;
    interpretation: string;
  }> | undefined;

  return (
    <div className="flex flex-col flex-1 p-8 gap-6">
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white">Upload Lab Report</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Upload a PDF or image of your lab report. We&apos;ll extract and analyze your biomarkers automatically.
        </p>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? "border-black dark:border-white bg-zinc-50 dark:bg-zinc-800"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="text-4xl">{dragging ? "↓" : "↑"}</div>
          <div className="text-center">
            <p className="text-base font-medium text-black dark:text-white">
              {dragging ? "Drop it here" : "Drag & drop or click to select"}
            </p>
            <p className="text-sm text-zinc-400 mt-1">PDF, JPG, PNG — max 20MB</p>
          </div>

          {file && (
            <div className="mt-2 text-sm text-zinc-500">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </div>
          )}
        </div>
      )}

      {/* Uploading state */}
      {uploading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Analyzing your lab report…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => { setError(null); setFile(null); }}
            className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Lab report uploaded successfully!</p>
              {observations && observations.length > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {observations.length} biomarker{observations.length !== 1 ? "s" : ""} extracted
                </p>
              )}
              {observations && observations.length === 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  No biomarkers detected — try a clearer scan
                </p>
              )}
            </div>
          </div>

          {observations && observations.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {observations.map((obs) => (
                <div key={obs.code} className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-medium text-zinc-400">{obs.code}</span>
                  <div className="flex items-end gap-1 mt-1">
                    <span className="text-2xl font-bold text-black dark:text-white">
                      {obs.value.toFixed(obs.unit === "%" ? 1 : 0)}
                    </span>
                    <span className="text-xs text-zinc-400 mb-1">{obs.unit}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${
                    obs.interpretation === "normal"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : obs.interpretation === "high" || obs.interpretation === "low"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}>
                    {obs.interpretation}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setFile(null); }}
              className="px-4 py-2 text-sm font-medium text-black dark:text-white bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Upload another
            </button>
            <button
              onClick={() => router.push("/dashboard/documents")}
              className="px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
            >
              View documents →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
