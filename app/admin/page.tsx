"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import {
  CLUB_CATEGORIES,
  CATEGORY_KEYS,
  type CategoryKey,
} from "@/lib/constants";

const HOURS_THRESHOLD = 8;
const COUNT_THRESHOLD = 4;
const ADMIN_PASSWORD = "15001500";

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

async function toBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`圖片載入失敗 (${response.status})`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("讀取圖片資料失敗"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("讀取圖片資料失敗"));
    reader.readAsDataURL(blob);
  });
}

export default function AdminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryKey>(CATEGORY_KEYS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfRecord, setPdfRecord] = useState<any>(null);

  const authAttempted = useRef(false);

  useEffect(() => {
    document.title = "社團記錄管理後台";
  }, []);

  useEffect(() => {
    if (authAttempted.current) return;
    authAttempted.current = true;

    const timer = setTimeout(() => {
      const input = prompt("請輸入管理員密碼：");
      if (input === ADMIN_PASSWORD) {
        setIsAuthenticated(true);
        fetchRecords();
      } else {
        alert("密碼錯誤，即將返回首頁");
        window.location.href = "/";
      }
    }, 100);

    return () => clearTimeout(timer);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadPDF = useCallback(async (record: any) => {
    const id = record.id;
    setDownloadingId(id);
    setPdfRecord(record);

    await new Promise((r) => setTimeout(r, 100));

    try {
      const element = document.getElementById("admin-pdf-template");
      if (!element) {
        alert("找不到 PDF 模板");
        return;
      }

      if (record.photo_url) {
        const imgEl = element.querySelector<HTMLImageElement>("[data-pdf-photo]");
        if (imgEl) {
          try {
            imgEl.src = await toBase64(record.photo_url);
          } catch {
            imgEl.src = "";
          }
        }
      }

      const styleSheets = Array.from(document.styleSheets || []);
      const disabledSheets: CSSStyleSheet[] = [];
      for (const sheet of styleSheets) {
        try {
          const css = sheet as CSSStyleSheet;
          for (let i = 0; i < css.cssRules.length; i++) {
            if (css.cssRules[i].cssText.includes("lab(")) {
              css.disabled = true;
              disabledSheets.push(css);
              break;
            }
          }
        } catch {
          /* cross-origin */
        }
      }

      const prev = element.style.display;
      element.style.display = "block";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      element.style.display = prev;

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const ratio = pageWidth / canvas.width;
      const pageHeight = canvas.height * ratio;
      const safeHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 297;

      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, safeHeight);

      const club = record.club_name || "社團";
      const date = record.course_date || "未知日期";
      pdf.save(`教學紀錄_${club}_${date}.pdf`);

      disabledSheets.forEach((s) => { s.disabled = false; });
    } catch (err) {
      console.error("[Admin] PDF generate error", err);
      alert("PDF 產生失敗，請確認 F12 Console 訊息");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const currentCategory = CLUB_CATEGORIES[activeTab];
  const clubs = currentCategory.clubs;

  const qualifiedCount = useMemo(
    () => clubs.filter((c) => getClubStats(records, c).qualified).length,
    [clubs, records],
  );
  const totalClubCount = clubs.length;
  const progressPercent =
    totalClubCount > 0 ? Math.round((qualifiedCount / totalClubCount) * 100) : 0;

  const filteredRecords = useMemo(
    () => records.filter((r) => clubs.includes(r.club_name)),
    [records, clubs],
  );

  const exportExcel = useCallback(() => {
    const rows: Record<string, string | number>[] = [];

    for (const catKey of CATEGORY_KEYS) {
      const cat = CLUB_CATEGORIES[catKey];
      for (const club of cat.clubs) {
        const { totalCount, totalHours, qualified } = getClubStats(records, club);
        rows.push({
          屬性: catKey,
          社團名稱: club,
          總填報次數: totalCount,
          累計輔導時數: totalHours,
          津貼核銷狀態: qualified ? "✅已達標" : "❌未達標",
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 18 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "核銷總表");
    XLSX.writeFile(wb, "弘光科大114-2社團指導紀錄核銷表.xlsx");
  }, [records]);

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
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              弘光社團紀錄 — 管理後台
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              依社團屬性追蹤津貼核銷達標狀態（達標條件：輔導時數 ≥ {HOURS_THRESHOLD}h 或 填報次數 ≥ {COUNT_THRESHOLD} 次）
            </p>
          </div>
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800"
          >
            📊 匯出 114-2 核銷總表
          </button>
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
              {qualifiedCount} / {totalClubCount} 已達標
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${currentCategory.color}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── 社團津貼核銷摘要 ── */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
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
                    <td className="px-5 py-3 font-medium text-gray-900">{clubName}</td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-700">{stats.totalCount}</td>
                    <td className="px-5 py-3 text-center tabular-nums text-gray-700">{stats.totalHours}h</td>
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

        {/* ── 個別填報紀錄 ── */}
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          填報紀錄明細
        </h2>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  社團名稱
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  日期
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell">
                  課程主題
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  時數
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">
                    此屬性尚無填報紀錄
                  </td>
                </tr>
              )}
              {filteredRecords.map((record) => {
                const isLoading = downloadingId === record.id;
                return (
                  <tr key={record.id} className="bg-white hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {record.club_name}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">
                      {record.course_date}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                      {record.course_topic || "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                      {record.teaching_hours ?? 0}h
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => downloadPDF(record)}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-500 bg-white px-3 py-1 text-xs font-medium text-sky-600 shadow-sm transition hover:bg-sky-500 hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            產生中…
                          </>
                        ) : (
                          "📥 下載 PDF"
                        )}
                      </button>
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

      {/* ── 隱藏 PDF 模板（html2canvas 擷取用） ── */}
      <div
        id="admin-pdf-template"
        className="pointer-events-none fixed left-0 top-0 -z-50 m-0 box-border hidden w-[794px] bg-[#ffffff] p-8 text-[12px] leading-relaxed text-[#111827] print:block"
      >
        <div className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-wide text-[#111827]">
            弘光科技大學社團指導老師教學紀錄表
          </h1>
        </div>

        <div className="mb-4 border border-[#111827] text-[11px]">
          <div className="grid grid-cols-4 border-b border-[#111827]">
            <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
              社團名稱
            </div>
            <div className="col-span-3 px-2 py-1">
              {pdfRecord?.club_name || "　"}
            </div>
          </div>
          <div className="grid grid-cols-4 border-b border-[#111827]">
            <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
              指導日期
            </div>
            <div className="col-span-3 px-2 py-1">
              {pdfRecord?.course_date || "　"}
            </div>
          </div>
          <div className="grid grid-cols-4 border-b border-[#111827]">
            <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
              課程主題
            </div>
            <div className="col-span-3 px-2 py-1">
              {pdfRecord?.course_topic || "　"}
            </div>
          </div>
          <div className="grid grid-cols-4 border-b border-[#111827]">
            <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
              出席人數
            </div>
            <div className="col-span-3 px-2 py-1">
              {pdfRecord?.attendance_count ?? "　"}
            </div>
          </div>
          <div className="grid grid-cols-4 border-b border-[#111827]">
            <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
              本次輔導時數
            </div>
            <div className="col-span-3 px-2 py-1">
              {(pdfRecord?.teaching_hours ?? 0) + " 小時"}
            </div>
          </div>
          <div className="grid grid-cols-4">
            <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
              填報人姓名 / 職稱
            </div>
            <div className="col-span-3 px-2 py-1">
              {(pdfRecord?.submitter_name || "　") + " / " + (pdfRecord?.submitter_role || "　")}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1 border-b border-[#111827] pb-1 text-[11px] font-semibold">
            教學內容描述
          </div>
          <div className="min-h-[240px] border border-[#111827] px-3 py-2 text-[11px] leading-relaxed">
            {(pdfRecord?.content || "").split("\n").map((line: string, idx: number) => (
              <p key={idx}>{line || "　"}</p>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 border-b border-[#111827] pb-1 text-[11px] font-semibold">
            教學成果照片
          </div>
          <div className="flex min-h-[300px] items-center justify-center border border-[#111827] bg-[#f9fafb]">
            {pdfRecord?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                data-pdf-photo
                src={pdfRecord.photo_url}
                alt="教學成果照片"
                className="max-h-[380px] max-w-[600px] object-contain"
              />
            ) : (
              <span className="text-[11px] text-[#9ca3af]">
                （本次未上傳教學成果照片）
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
