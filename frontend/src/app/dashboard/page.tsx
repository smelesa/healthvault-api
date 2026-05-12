"use client";

import { useEffect, useState } from "react";
import { listDocuments, listBiomarkers, type Document, type Observation } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

const biomarkerLabels: Record<string, string> = {
  GLU: "Glucose",
  HbA1c: "HbA1c",
  CHOL: "Cholesterol",
  HDL: "HDL",
  LDL: "LDL",
  TG: "Triglycerides",
  CREAT: "Creatinine",
  BUN: "BUN",
  ALT: "ALT",
  AST: "AST",
  ALP: "ALP",
  HGB: "Hemoglobin",
  WBC: "WBC",
  RBC: "RBC",
  PLT: "Platelets",
  TSH: "TSH",
  VITD: "Vitamin D",
  IRON: "Iron",
  FERR: "Ferritin",
};

const interpColors: Record<string, string> = {
  normal: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
  low: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  high: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  critical_low: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  critical_high: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [biomarkers, setBiomarkers] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      listBiomarkers(token).catch(() => ({ items: [] })),
      listDocuments(token, { limit: 5 }).catch(() => ({ items: [] })),
    ]).then(([bioData, docData]) => {
      setBiomarkers(bioData.items.slice(0, 9));
      setDocuments(docData.items);
      setLoading(false);
    });
  }, [token]);

  const latestByCode = Object.fromEntries(
    biomarkers.map((b) => [b.code, b])
  );

  return (
    <div className="flex flex-col flex-1 p-8 gap-8">
      {/* Hero */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">Your Health Overview</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Upload lab reports to track your biomarkers over time.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Lab Reports"
          value={documents.length}
          href="/dashboard/documents"
          sub="View all"
        />
        <StatCard
          label="Biomarkers Tracked"
          value={Object.keys(latestByCode).length}
          href="/dashboard/analyze"
          sub="View analysis"
        />
        <StatCard
          label="Upload"
          value="→"
          href="/dashboard/upload"
          sub="Add a lab report"
        />
      </div>

      {/* Biomarkers */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black dark:text-white">Latest Biomarkers</h2>
          <Link href="/dashboard/analyze" className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">
            Full analysis →
          </Link>
        </div>

        {loading ? (
          <BiomarkerSkeleton />
        ) : Object.keys(latestByCode).length === 0 ? (
          <EmptyState
            message="No biomarkers yet."
            sub="Upload your first lab report to get started."
            href="/dashboard/upload"
            hrefLabel="Upload lab report →"
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(latestByCode).slice(0, 9).map(([code, obs]) => (
              <BiomarkerCard key={code} code={code} obs={obs} />
            ))}
          </div>
        )}
      </section>

      {/* Recent documents */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black dark:text-white">Recent Documents</h2>
          <Link href="/dashboard/documents" className="text-sm text-zinc-500 hover:text-black dark:hover:text-white">
            View all →
          </Link>
        </div>

        {loading ? (
          <BiomarkerSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState
            message="No documents yet."
            sub="Upload your first lab report to get started."
            href="/dashboard/upload"
            hrefLabel="Upload lab report →"
          />
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-black dark:text-white capitalize">{doc.document_type.replace('_', ' ')}</p>
                  <p className="text-xs text-zinc-400">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs text-zinc-400 uppercase">{doc.file_type}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, href, sub }: { label: string; value: string | number; href: string; sub: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 p-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <span className="text-3xl font-bold text-black dark:text-white">{value}</span>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <span className="text-xs text-zinc-400">{sub}</span>
    </Link>
  );
}

function BiomarkerCard({ code, obs }: { code: string; obs: Observation }) {
  const interp = obs.interpretation || "normal";
  const interpClass = interpColors[interp] || interpColors.normal;

  return (
    <div className="flex flex-col gap-2 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{biomarkerLabels[code] || code}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${interpClass}`}>
          {interp}
        </span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-black dark:text-white">
          {obs.value != null ? obs.value.toFixed(obs.unit === "%" ? 1 : 0) : "—"}
        </span>
        <span className="text-xs text-zinc-400 mb-1">{obs.unit}</span>
      </div>
    </div>
  );
}

function EmptyState({ message, sub, href, hrefLabel }: { message: string; sub: string; href: string; hrefLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed">
      <p className="text-sm text-zinc-500 mb-2">{message}</p>
      <p className="text-xs text-zinc-400 mb-4">{sub}</p>
      <Link href={href} className="text-sm font-medium text-black dark:text-white hover:underline">
        {hrefLabel}
      </Link>
    </div>
  );
}

function BiomarkerSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
