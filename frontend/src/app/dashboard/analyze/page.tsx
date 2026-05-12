"use client";

import { useEffect, useState } from "react";
import { analyzeDocuments, listBiomarkers, type Observation } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";

const biomarkerLabels: Record<string, string> = {
  GLU: "Glucose", HbA1c: "HbA1c", CHOL: "Cholesterol",
  HDL: "HDL", LDL: "LDL", TG: "Triglycerides",
  CREAT: "Creatinine", BUN: "BUN", ALT: "ALT",
  AST: "AST", ALP: "ALP", HGB: "Hemoglobin",
  WBC: "WBC", RBC: "RBC", PLT: "Platelets",
  TSH: "TSH", VITD: "Vitamin D", IRON: "Iron", FERR: "Ferritin",
};

const interpColors: Record<string, string> = {
  normal: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  low: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  critical_low: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  critical_high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

interface AnalysisResult {
  biomarkers: Observation[];
  deviations: Observation[];
  risk_factors: string[];
  recommendations: string[];
  summary: string;
  confidence: number;
}

export default function AnalyzePage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [biomarkers, setBiomarkers] = useState<Observation[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  useEffect(() => {
    if (!token) return;
    listBiomarkers(token, {})
      .then((data) => setBiomarkers(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function runAnalysis() {
    if (!token) return;
    setAnalyzing(true);
    try {
      const result = await analyzeDocuments(token);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }

  const deviations = biomarkers.filter(
    (b) => b.interpretation !== "normal"
  );

  const byCode = Object.fromEntries(biomarkers.map((b) => [b.code, b]));

  return (
    <div className="flex flex-col flex-1 p-8 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white">Biomarker Analysis</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {biomarkers.length === 0
              ? "No biomarkers to analyze yet."
              : `${biomarkers.length} biomarker readings from ${Object.keys(byCode).length} types`}
          </p>
        </div>
        {biomarkers.length > 0 && !analysis && (
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {analyzing ? "Analyzing…" : "AI Analysis →"}
          </button>
        )}
      </div>

      {/* AI Analysis result */}
      {analysis && (
        <div className="flex flex-col gap-4 p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-black dark:text-white mb-2">AI Health Summary</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {analysis.risk_factors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-black dark:text-white mb-2">Risk Factors</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.risk_factors.map((r) => (
                  <span key={r} className="text-xs px-3 py-1 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-full">
                    ⚠ {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-black dark:text-white mb-2">Recommendations</h3>
              <ul className="space-y-1">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Deviation alert */}
      {deviations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-black dark:text-white mb-3">
            Values Outside Normal Range ({deviations.length})
          </h2>
          <div className="space-y-2">
            {deviations.map((obs) => {
              const interp = obs.interpretation || "high";
              const interpClass = interpColors[interp] || interpColors.high;
              return (
                <div key={`${obs.code}-${obs.effective_date}`} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${interpClass}`}>
                      {interp.replace("_", " ")}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">{biomarkerLabels[obs.code] || obs.code}</p>
                      {obs.reference_range_low && obs.reference_range_high && (
                        <p className="text-xs text-zinc-400">
                          Normal: {obs.reference_range_low}–{obs.reference_range_high} {obs.unit}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-black dark:text-white">
                      {obs.value?.toFixed(obs.unit === "%" ? 1 : 0) ?? "—"}
                    </span>
                    <span className="text-xs text-zinc-400 ml-1">{obs.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All biomarkers grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : biomarkers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <span className="text-3xl">📊</span>
          <p className="text-zinc-500 dark:text-zinc-400">No biomarker data yet</p>
          <p className="text-xs text-zinc-400">Upload a lab report to extract your biomarkers</p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-black dark:text-white mb-3">All Biomarkers</h2>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(byCode).map(([code, obs]) => {
              const interp = obs.interpretation || "normal";
              const interpClass = interpColors[interp] || interpColors.normal;
              return (
                <div key={code} className="flex flex-col gap-2 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400">{biomarkerLabels[code] || code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${interpClass}`}>{interp}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold text-black dark:text-white">
                      {obs.value != null ? obs.value.toFixed(obs.unit === "%" ? 1 : 0) : "—"}
                    </span>
                    <span className="text-xs text-zinc-400 mb-1">{obs.unit}</span>
                  </div>
                  {obs.reference_range_low != null && obs.reference_range_high != null && (
                    <p className="text-xs text-zinc-400">Ref: {obs.reference_range_low}–{obs.reference_range_high}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}