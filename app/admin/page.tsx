"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  CLUB_CATEGORIES,
  CATEGORY_KEYS,
  type CategoryKey,
} from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRecord(records: any[], clubName: string) {
  return records.find((r) => r.club_name === clubName);
}

export default function AdminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryKey>(CATEGORY_KEYS[0]);

  useEffect(() => {
    fetchRecords();
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
  const submittedCount = clubs.filter((c) => findRecord(records, c)).length;
  const totalCount = clubs.length;
  const progressPercent = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 font-sans text-gray-900 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            弘光社團紀錄 — 管理後台
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            依社團屬性追蹤各社教學紀錄繳交狀態
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
              {activeTab}繳交進度
            </span>
            <span className="tabular-nums text-gray-500">
              {submittedCount} / {totalCount}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${currentCategory.color}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── 社團繳交狀態表 ── */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  社團名稱
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  繳交狀態
                </th>
                <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">
                  填寫日期
                </th>
                <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">
                  課程主題
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clubs.map((clubName) => {
                const record = findRecord(records, clubName);
                const submitted = !!record;

                return (
                  <tr
                    key={clubName}
                    className={submitted ? "bg-white" : "bg-red-50/60"}
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {clubName}
                    </td>
                    <td className="px-5 py-3">
                      {submitted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          ✅ 已填寫
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                          ❌ 未填寫
                        </span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3 text-gray-500 sm:table-cell">
                      {record?.course_date || "—"}
                    </td>
                    <td className="hidden px-5 py-3 text-gray-500 md:table-cell">
                      {record?.course_topic || "—"}
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
