"use client";

import { useEffect, useState } from "react";
import { getMe, updateMe } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function ProfilePage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; sex: string | null; clerk_id: string; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then(setUser)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSexChange(newSex: string) {
    if (!token || !user) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateMe(token, newSex);
      setUser({ ...user, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 p-8">
        <div className="animate-pulse space-y-4 max-w-md">
          <div className="h-8 bg-zinc-200 rounded w-1/3" />
          <div className="h-4 bg-zinc-200 rounded w-2/3" />
          <div className="h-12 bg-zinc-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-8 gap-8 max-w-xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white">Profile</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage your personal information and preferences.</p>
      </div>

      {/* User info card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Account</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block mb-1">Email</span>
            <span className="font-medium text-black dark:text-white">{user?.email ?? "—"}</span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block mb-1">Member since</span>
            <span className="font-medium text-black dark:text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-CH", { year: "numeric", month: "long", day: "numeric" }) : "—"}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block mb-1">User ID</span>
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{user?.id?.slice(0, 18) ?? "—"}…</span>
          </div>
        </div>
      </div>

      {/* Sex selector */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Health Profile</h2>

        <div>
          <label className="block text-sm font-medium text-black dark:text-white mb-3">
            Biological sex <span className="text-zinc-400 text-xs">(used for biomarker reference ranges)</span>
          </label>

          <div className="flex gap-4">
            {["M", "F"].map((s) => {
              const isSelected = user?.sex === s;
              return (
                <button
                  key={s}
                  onClick={() => handleSexChange(s)}
                  disabled={saving}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? s === "M"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-rose-500 bg-rose-50 dark:bg-rose-950"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  <span className="text-2xl">{s === "M" ? "♂" : "♀"}</span>
                  <span className={`text-sm font-semibold ${
                    isSelected
                      ? s === "M" ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}>
                    {s === "M" ? "Male" : "Female"}
                  </span>
                  {isSelected && (
                    <span className={`text-xs font-medium ${
                      s === "M" ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      ✓ Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-zinc-400 mt-2">
            Reference ranges for biomarkers (glucose, cholesterol, creatinine, etc.) are adjusted based on your sex.
          </p>

          {saving && (
            <p className="text-xs text-zinc-500 mt-2">Saving…</p>
          )}
          {saved && (
            <p className="text-xs text-emerald-600 mt-2">✓ Saved!</p>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200">
        <p className="font-medium mb-1">Why do we need this?</p>
        <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
          Men and women have different normal ranges for many biomarkers. Setting your sex helps HealthVault interpret your lab results correctly and give you better recommendations.
        </p>
      </div>
    </div>
  );
}