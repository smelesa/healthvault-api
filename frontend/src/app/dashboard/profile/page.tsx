"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe, updateMe, getConditions, type MeResponse, type Condition, type UserCondition } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";

const BMI_COLORS: Record<string, string> = {
  underweight: "text-amber-600 bg-amber-50",
  normal: "text-emerald-600 bg-emerald-50",
  overweight: "text-orange-600 bg-orange-50",
  obese: "text-red-600 bg-red-50",
};

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function computeBMI(h_cm: number, w_kg: number): number {
  return w_kg / ((h_cm / 100) ** 2);
}

const COUNTRIES = [
  "Switzerland", "Italy", "France", "Germany", "Spain", "Portugal", "United Kingdom",
  "United States", "Canada", "Australia", "Austria", "Belgium", "Netherlands",
  "Sweden", "Norway", "Denmark", "Finland", "Greece", "Poland", "Czech Republic",
  "Brazil", "Argentina", "Mexico", "Japan", "China", "India", "South Korea",
  "Singapore", "UAE", "Saudi Arabia", "Other",
];

const SMOKING_OPTIONS = [
  { value: "never", label: "Never smoked" },
  { value: "former", label: "Former smoker" },
  { value: "current", label: "Current smoker" },
];

const ALCOHOL_OPTIONS = [
  { value: "none", label: "None" },
  { value: "light", label: "Light (1-2 drinks/day)" },
  { value: "moderate", label: "Moderate (3-4 drinks/day)" },
  { value: "heavy", label: "Heavy (5+ drinks/day)" },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary (little to no exercise)" },
  { value: "light", label: "Light (1-2 days/week)" },
  { value: "moderate", label: "Moderate (3-4 days/week)" },
  { value: "active", label: "Active (5+ days/week)" },
];

const CATEGORY_COLORS: Record<string, string> = {
  endocrine: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cardiovascular: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  renal: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  hepatic: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  respiratory: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  hematologic: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  mental: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  musculoskeletal: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{children}</h3>;
}

export default function ProfilePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<MeResponse | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = useRef(false);
  const hasLoaded = useRef(false);

  // Form state
  const [sex, setSex] = useState<string>("M");
  const [dob, setDob] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [country, setCountry] = useState<string>("Switzerland");
  const [smoking, setSmoking] = useState<string>("never");
  const [alcohol, setAlcohol] = useState<string>("none");
  const [activity, setActivity] = useState<string>("moderate");
  const [notes, setNotes] = useState<string>("");
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [diagnosedConditions, setDiagnosedConditions] = useState<Set<string>>(new Set());

  useEffect(() => { getToken().then(setToken); }, [getToken]);

  useEffect(() => {
    if (!token) return;
    Promise.all([getMe(token), getConditions()])
      .then(([meData, condData]) => {
        setData(meData);
        setConditions(condData);
        // Populate form
        setSex(meData.sex || "M");
        setDob(meData.profile.date_of_birth || "");
        setHeight(meData.profile.height_cm ? String(meData.profile.height_cm) : "");
        setWeight(meData.profile.weight_kg ? String(meData.profile.weight_kg) : "");
        setCountry(meData.profile.country || "Switzerland");
        setSmoking(meData.profile.smoking_status || "never");
        setAlcohol(meData.profile.alcohol_use || "none");
        setActivity(meData.profile.physical_activity || "moderate");
        setNotes(meData.profile.additional_notes || "");
        setSelectedConditions(new Set(meData.conditions.map((c: UserCondition) => c.code)));
        setDiagnosedConditions(new Set(meData.conditions.filter((c: UserCondition) => c.is_diagnosed).map((c: UserCondition) => c.code)));
      })
      .catch(console.error)
      .finally(() => {
        hasLoaded.current = true;
        setLoading(false);
      });
  }, [token]);

  const save = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      const result = await updateMe(token, {
        sex,
        date_of_birth: dob || undefined,
        height_cm: height ? parseFloat(height) : undefined,
        weight_kg: weight ? parseFloat(weight) : undefined,
        country,
        smoking_status: smoking,
        alcohol_use: alcohol,
        physical_activity: activity,
        additional_notes: notes || undefined,
        condition_codes: Array.from(selectedConditions),
        is_diagnosed_map: Object.fromEntries(
          Array.from(selectedConditions).map(code => [code, diagnosedConditions.has(code)])
        ),
      });
      setData(result);
      isDirty.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [token, sex, dob, height, weight, country, smoking, alcohol, activity, notes, selectedConditions, diagnosedConditions]);

  // Debounced auto-save on any field change (300ms)
  useEffect(() => {
    if (!hasLoaded.current) return; // don't save before first load
    if (saveTimer.current) clearTimeout(saveTimer.current);
    isDirty.current = true;
    saveTimer.current = setTimeout(save, 300);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [sex, dob, height, weight, country, smoking, alcohol, activity, notes, selectedConditions, diagnosedConditions]);

  // Save immediately when navigating away (page unload or tab switch)
  useEffect(() => {
    if (!hasLoaded.current) return;

    // Save on page unload (browser back, URL change, tab close)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty.current) return;
      e.preventDefault();
      // Can't block reliably in modern browsers, but we try
      save(); // fire and forget — might not complete in time
    };

    // Save when tab becomes hidden (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden && isDirty.current) {
        if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
        isDirty.current = false;
        save();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [save]);

  const bmi = (height && weight) ? computeBMI(parseFloat(height), parseFloat(weight)) : null;
  const bmiClass = bmi ? bmiCategory(bmi) : null;

  // Group conditions by category
  const byCategory: Record<string, Condition[]> = {};
  for (const c of conditions) {
    (byCategory[c.category] ??= []).push(c);
  }

  function toggleCondition(code: string) {
    setSelectedConditions(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 p-8">
        <div className="animate-pulse space-y-4 max-w-2xl">
          <div className="h-8 bg-zinc-200 rounded w-1/3" />
          <div className="h-4 bg-zinc-200 rounded w-2/3" />
          <div className="h-48 bg-zinc-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-8 gap-6 max-w-3xl overflow-y-auto">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white">Profile</h1>
          <p className="text-zinc-500 mt-1">Your health profile — used to contextualize biomarker analysis.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {saving && <span className="text-zinc-400">Saving…</span>}
          {saved && <span className="text-emerald-600 font-medium">✓ Saved</span>}
        </div>
      </div>

      {/* Sex selector */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <GroupLabel>Biological Sex</GroupLabel>
        <div className="flex gap-3">
          {([["M", "Male", "♂"], ["F", "Female", "♀"]] as [string, string, string][]).map(([v, label, icon]) => (
            <button
              key={v}
              onClick={() => setSex(v)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold transition-all ${
                sex === v
                  ? v === "M" ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200"
                    : "border-rose-500 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-200"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-400 mt-2">Used to adjust biomarker reference ranges.</p>
      </div>

      {/* Personal info */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <GroupLabel>Personal Information</GroupLabel>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Country</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm"
            >
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Height (cm)</label>
            <input
              type="number"
              value={height}
              onChange={e => setHeight(e.target.value)}
              placeholder="e.g. 178"
              min={100} max={250}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Weight (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 75"
              min={30} max={300}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm"
            />
          </div>
        </div>

        {/* BMI badge */}
        {bmi && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-zinc-500">BMI:</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${BMI_COLORS[bmiClass!]}`}>
              {bmi.toFixed(1)} — {bmiClass?.charAt(0).toUpperCase() + bmiClass!.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Lifestyle */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <GroupLabel>Lifestyle</GroupLabel>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Smoking</label>
            <select value={smoking} onChange={e => setSmoking(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm">
              {SMOKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Alcohol</label>
            <select value={alcohol} onChange={e => setAlcohol(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm">
              {ALCOHOL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Physical Activity</label>
            <select value={activity} onChange={e => setActivity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm">
              {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <GroupLabel>Health Conditions</GroupLabel>
            <p className="text-xs text-zinc-400 mt-0.5">Check any conditions that apply to you. This helps contextualize your biomarker analysis.</p>
          </div>
          <span className="text-xs text-zinc-400">{selectedConditions.size} selected</span>
        </div>

        {Object.entries(byCategory).map(([category, conds]) => (
          <div key={category} className="mb-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 capitalize mb-2">{category}</p>
            <div className="grid grid-cols-2 gap-2">
              {conds.map(cond => {
                const checked = selectedConditions.has(cond.code);
                const diagnosed = diagnosedConditions.has(cond.code);
                return (
                  <label
                    key={cond.code}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all text-sm ${
                      checked
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCondition(cond.code)}
                      className="mt-0.5 rounded border-zinc-400"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{cond.name}</span>
                      {checked && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs cursor-pointer">
                            <input type="checkbox" checked={diagnosed}
                              onChange={() => setDiagnosedConditions(prev => {
                                const next = new Set(prev);
                                if (next.has(cond.code)) next.delete(cond.code); else next.add(cond.code);
                                return next;
                              })}
                              className="rounded border-zinc-400"
                            />
                            <span className="text-zinc-600 dark:text-zinc-400">Diagnosed</span>
                          </label>
                          {!diagnosed && (
                            <span className="text-xs text-zinc-400">family history / suspected</span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
        <GroupLabel>Additional Notes</GroupLabel>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any other health information you want your coach to know about…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-black dark:text-white text-sm resize-none"
        />
        <p className="text-xs text-zinc-400 mt-1.5">This information is private and used only to improve your health analysis.</p>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-medium mb-0.5">Why do we need this?</p>
        <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
          Biological sex, age, lifestyle factors, and health conditions all influence normal biomarker reference ranges. This data helps HealthVault interpret your lab results more accurately and give you better, personalized recommendations.
        </p>
      </div>
    </div>
  );
}