"use client";

import { useEffect, useState } from "react";
import { listDocuments, deleteDocument, type Document } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

const typeColors: Record<string, string> = {
  lab_report: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  prescription: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  imaging: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function DocumentsPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  useEffect(() => {
    if (!token) return;
    listDocuments(token, { limit: 50 })
      .then((data) => setDocuments(data.items))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(docId: string) {
    if (!token) return;
    if (!confirm("Delete this document?")) return;
    await deleteDocument(token, docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  const filtered = filter === "all"
    ? documents
    : documents.filter((d) => d.document_type === filter);

  return (
    <div className="flex flex-col flex-1 p-8 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white">Documents</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
        >
          + Upload
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "lab_report", "prescription", "imaging", "other"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === t
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {t === "all" ? "All" : t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <span className="text-3xl">📄</span>
          <p className="text-zinc-500 dark:text-zinc-400">No documents found</p>
          <Link href="/dashboard/upload" className="text-sm font-medium text-black dark:text-white hover:underline">
            Upload your first →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-4">
                <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${typeColors[doc.document_type] || typeColors.other}`}>
                  {doc.document_type.replace("_", " ")}
                </span>
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">
                    {doc.summary ? doc.summary.slice(0, 80) + "…" : "No summary"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(doc.created_at).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                    {" · "}
                    <span className="uppercase">{doc.file_type}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-xs text-zinc-400 hover:text-red-500 transition-colors px-3 py-1"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
