"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  CLUB_CATEGORIES,
  CATEGORY_KEYS,
  type CategoryKey,
} from "@/lib/constants";

const HOURS_THRESHOLD = 8;
const COUNT_THRESHOLD = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClubStats(records: any[], clubName: string) {
  const matched = records.filter((r) => r.club_name === clubName);
  const totalCount = matched.length;
  const totalHours = matched.reduce(
    (sum, r) => sum + (Number(r.teaching_hours) || 0),
    0,
  );
  const qualified =
    totalHours >= HOURS_THRESHOLD || totalCount >= COUNT_THRESHOLD;

  return { totalCount, totalHours, qualified };
}

const ADMIN_PASSWORD = "15001500";

export default function AdminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryKey>(CATEGORY_KEYS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const input = prompt("請輸入管理員密碼：");
    if (input === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchRecords();
    } else {
      alert("密碼錯誤，即將返回首頁");
      window.location.href = "/";
    }
  }, []);

  async function fetchRecords() {
    const { data, error } = await supabase
      .from("teaching_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("抓取失敗:", error);
    } else {
      setRecords(data || []);
    }
  }

  const currentCategory = CLUB_CATEGORIES[activeTab];
  const clubs = currentCategory.clubs;

  const qualifiedCount = useMemo(
    () =>
      clubs.filter((c) => getClubStats(records, c).qualified).length,
    [clubs, records],
  );
  const totalCount = clubs.length;
  const progressPercent =
    totalCount > 0 ? Math.round((qualifiedCount / totalCount) * 100) : 0;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-sans text-gray-400">
        <p className="text-sm">驗證中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 font-sans text-gray-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            弘光社團紀錄 — 管理後台
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            依社團屬性追蹤津貼核銷達標狀態（達標條件：輔導時數 ≥ {HOURS_THRESHOLD}h 或 填報次數 ≥ {COUNT_THRESHOLD} 次）
          </p>
        </header>

        {/* ── 屬性切換標籤 ── */}
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((key) => {
            const meta = CLUB_CATEGORIES[key];
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm transition ${
                  isActive
                    ? `${meta.color} ${meta.activeText}`
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* ── 進度統計 ── */}
        <div className="mb-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium text-gray-700">
              {activeTab} 津貼達標進度
            </span>
            <span className="tabular-nums text-gray-500">
              {qualifiedCount} / {totalCount} 已達標
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${currentCategory.color}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── 社團津貼核銷狀態表 ── */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  社團名稱
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  總填報次數
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  累計輔導時數
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  津貼核銷狀態
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clubs.map((clubName) => {
                const stats = getClubStats(records, clubName);

                return (
                  <tr
                    key={clubName}
                    className={stats.qualified ? "bg-white" : "bg-red-50/60"}
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {clubName}
                    </td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-700">
                      {stats.totalCount}
                    </td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-700">
                      {stats.totalHours}h
                    </td>
                    <td className="px-5 py-3">
                      {stats.qualified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          ✅ 已達標
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          ⚠️ 未達標 (目前: {stats.totalCount}次 / {stats.totalHours}h)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <a
          href="/"
          className="mt-6 inline-block text-sm text-blue-600 hover:underline"
        >
          ← 回到填報頁面
        </a>
      </div>
    </div>
  );
}
