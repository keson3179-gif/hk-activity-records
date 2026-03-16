"use client";

import { Fragment, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
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
  const [mergingClub, setMergingClub] = useState<string | null>(null);
  const [isMergingPDF, setIsMergingPDF] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfRecord, setPdfRecord] = useState<any>(null);
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(new Set());

  const authAttempted = useRef(false);

  useEffect(() => {
    document.title = "社團記錄管理後台";
  }, [isAuthenticated]);

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
  const renderRecordToCanvas = useCallback(async (record: any) => {
    setPdfRecord(record);
    await new Promise((r) => setTimeout(r, 120));

    const element = document.getElementById("admin-pdf-template");
    if (!element) throw new Error("找不到 PDF 模板");

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
    disabledSheets.forEach((s) => { s.disabled = false; });

    return canvas;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadPDF = useCallback(async (record: any) => {
    setDownloadingId(record.id);
    try {
      const canvas = await renderRecordToCanvas(record);
      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const ratio = pageWidth / canvas.width;
      const pageHeight = canvas.height * ratio;
      const safeHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 297;

      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, safeHeight);
      pdf.save(`教學紀錄_${record.club_name || "社團"}_${record.course_date || "未知日期"}.pdf`);
    } catch (err) {
      console.error("[Admin] PDF generate error", err);
      alert("PDF 產生失敗，請確認 F12 Console 訊息");
    } finally {
      setDownloadingId(null);
    }
  }, [renderRecordToCanvas]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadClubAllPDFs = useCallback(async (clubName: string, clubRecords: any[]) => {
    if (clubRecords.length === 0) return;
    setMergingClub(clubName);
    setIsMergingPDF(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const totalPages = clubRecords.length + 1;

      let categoryName = "";
      for (const key of CATEGORY_KEYS) {
        if (CLUB_CATEGORIES[key].clubs.includes(clubName)) {
          categoryName = key;
          break;
        }
      }

      const stats = getClubStats(records, clubName);
      const submitter = clubRecords[0]?.submitter_name || "—";
      const totalHoursDisplay = stats.totalHours;
      const statusText = stats.qualified ? "✅ 已達標" : "❌ 未達標";
      const statusColor = stats.qualified ? "#059669" : "#d97706";

      const tocRows = clubRecords
        .map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any, i: number) =>
            `<tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:6px 10px;text-align:center;color:#6b7280;">${i + 1}</td>
              <td style="padding:6px 10px;">${r.course_date || "—"}</td>
              <td style="padding:6px 10px;">${r.course_topic || "—"}</td>
              <td style="padding:6px 10px;text-align:center;">${r.teaching_hours ?? 0}h</td>
            </tr>`,
        )
        .join("");

      const tocHtml = `
        <div style="text-align:center;margin-bottom:32px;padding-top:24px;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">弘光科技大學 課外活動指導組</div>
          <div style="font-size:22px;font-weight:700;color:#111827;letter-spacing:0.5px;">
            114 學年度第 2 學期
          </div>
          <div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">
            ${clubName} — 教學紀錄彙整總表
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:12px;">
          <tr style="border-bottom:1px solid #111827;">
            <td style="padding:7px 10px;width:130px;background:#f3f4f6;font-weight:600;border-right:1px solid #d1d5db;">社團屬性</td>
            <td style="padding:7px 10px;">${categoryName}</td>
          </tr>
          <tr style="border-bottom:1px solid #111827;">
            <td style="padding:7px 10px;background:#f3f4f6;font-weight:600;border-right:1px solid #d1d5db;">社團名稱</td>
            <td style="padding:7px 10px;">${clubName}</td>
          </tr>
          <tr style="border-bottom:1px solid #111827;">
            <td style="padding:7px 10px;background:#f3f4f6;font-weight:600;border-right:1px solid #d1d5db;">指導老師（填報人）</td>
            <td style="padding:7px 10px;">${submitter}</td>
          </tr>
          <tr style="border-bottom:1px solid #111827;">
            <td style="padding:7px 10px;background:#f3f4f6;font-weight:600;border-right:1px solid #d1d5db;">總填報次數 / 總時數</td>
            <td style="padding:7px 10px;">${stats.totalCount} 次 / ${totalHoursDisplay} 小時</td>
          </tr>
          <tr>
            <td style="padding:7px 10px;background:#f3f4f6;font-weight:600;border-right:1px solid #d1d5db;">津貼核銷狀態</td>
            <td style="padding:7px 10px;font-weight:600;color:${statusColor};">${statusText}</td>
          </tr>
        </table>

        <div style="font-size:13px;font-weight:600;border-bottom:2px solid #111827;padding-bottom:4px;margin-bottom:10px;">
          教學紀錄目錄
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f3f4f6;border-bottom:2px solid #d1d5db;">
              <th style="padding:6px 10px;text-align:center;width:50px;">序號</th>
              <th style="padding:6px 10px;text-align:left;">填報日期</th>
              <th style="padding:6px 10px;text-align:left;">課程主題</th>
              <th style="padding:6px 10px;text-align:center;width:70px;">時數</th>
            </tr>
          </thead>
          <tbody>${tocRows}</tbody>
        </table>
      `;

      const tocDiv = document.createElement("div");
      tocDiv.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;z-index:-9999;width:794px;padding:40px;background:#ffffff;font-family:system-ui,-apple-system,sans-serif;color:#111827;font-size:12px;line-height:1.6;box-sizing:border-box;";
      tocDiv.innerHTML = tocHtml;
      document.body.appendChild(tocDiv);

      const tocCanvas = await html2canvas(tocDiv, {
        scale: 2,
        logging: false,
        backgroundColor: "#ffffff",
      });
      document.body.removeChild(tocDiv);

      const tocImgData = tocCanvas.toDataURL("image/jpeg", 0.9);
      const tocRatio = pageWidth / tocCanvas.width;
      const tocPageH = tocCanvas.height * tocRatio;
      const safeTocH = Number.isFinite(tocPageH) && tocPageH > 0 ? tocPageH : 297;
      pdf.addImage(tocImgData, "JPEG", 0, 0, pageWidth, safeTocH);

      for (let i = 0; i < clubRecords.length; i++) {
        pdf.addPage();

        const canvas = await renderRecordToCanvas(clubRecords[i]);
        const imgData = canvas.toDataURL("image/jpeg", 0.9);
        const ratio = pageWidth / canvas.width;
        const pageHeight = canvas.height * ratio;
        const safeHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 297;

        pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, safeHeight);

        // 使用支援中文的字體來渲染頁碼，避免「第 / 頁 / 共」出現亂碼
        try {
          pdf.setFont("NotoSansTC" as unknown as string);
        } catch {
          // 若該字體尚未註冊，jsPDF 會自動 fallback，仍可正常顯示數字部分
        }
        pdf.setFontSize(9);
        pdf.setTextColor(160, 160, 160);
        pdf.text(
          `第 ${i + 2} 頁，共 ${totalPages} 頁`,
          pageWidth / 2,
          290,
          { align: "center" },
        );
      }

      pdf.save(`114-2_${clubName}_教學紀錄全彙整.pdf`);
    } catch (err) {
      console.error("[Admin] Merge PDF error", err);
      alert("合併 PDF 產生失敗，請確認 F12 Console 訊息");
    } finally {
      setMergingClub(null);
      setIsMergingPDF(false);
    }
  }, [records, renderRecordToCanvas]);

  const currentCategory = CLUB_CATEGORIES[activeTab];
  const clubs = currentCategory.clubs;

  const qualifiedCount = useMemo(
    () => clubs.filter((c) => getClubStats(records, c).qualified).length,
    [clubs, records],
  );
  const totalClubCount = clubs.length;
  const progressPercent =
    totalClubCount > 0 ? Math.round((qualifiedCount / totalClubCount) * 100) : 0;

  const clubRecordsMap = useMemo(() => {
    const map: Record<string, typeof records> = {};
    for (const club of clubs) {
      map[club] = records.filter((r) => r.club_name === club);
    }
    return map;
  }, [records, clubs]);

  const toggleClub = useCallback((clubName: string) => {
    setExpandedClubs((prev) => {
      const next = new Set(prev);
      if (next.has(clubName)) {
        next.delete(clubName);
      } else {
        next.add(clubName);
      }
      return next;
    });
  }, []);

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
    <div className="relative min-h-screen bg-gray-50 px-4 py-6 font-sans text-gray-900 sm:px-8">
      {isMergingPDF && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white px-6 py-6 text-center shadow-xl">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            </div>
            <p className="mb-1 text-sm font-semibold text-gray-900">
              📄 正在為您彙整全學期紀錄...
            </p>
            <p className="text-xs text-gray-500">
              系統正在生成高畫質 PDF，請勿關閉網頁。
            </p>
          </div>
        </div>
      )}

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
            disabled={isMergingPDF}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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

        {/* ── 社團摺疊表格 (Accordion) ── */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  社團名稱
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  累計次數
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  累計時數
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  達標狀態
                </th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((clubName) => {
                const stats = getClubStats(records, clubName);
                const clubRecords = clubRecordsMap[clubName] || [];
                const isExpanded = expandedClubs.has(clubName);
                const hasRecords = clubRecords.length > 0;

                return (
                  <Fragment key={clubName}>
                    {/* 母列 */}
                    <tr
                      onClick={() => hasRecords && toggleClub(clubName)}
                      className={`border-b border-gray-100 transition ${
                        hasRecords ? "cursor-pointer hover:bg-gray-50" : ""
                      } ${stats.qualified ? "bg-white" : "bg-red-50/40"}`}
                    >
                      <td className="px-3 py-3 text-center text-gray-400">
                        {hasRecords ? (
                          <ChevronRight
                            className={`inline-block h-4 w-4 transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        ) : (
                          <span className="inline-block h-4 w-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {clubName}
                        {!hasRecords && (
                          <span className="ml-2 text-[11px] font-normal text-gray-400">
                            尚無紀錄
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {stats.totalCount}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                        {stats.totalHours}h
                      </td>
                      <td className="px-4 py-3">
                        {stats.qualified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                            ✅ 已達標
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                            ⚠️ 未達標
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 合併下載按鈕列 */}
                    {isExpanded && hasRecords && (
                      <tr className="border-b border-gray-100 bg-indigo-50/50">
                        <td className="px-3 py-2" />
                        <td colSpan={4} className="px-4 py-2">
                          <button
                            type="button"
                            disabled={isMergingPDF || mergingClub === clubName}
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadClubAllPDFs(clubName, clubRecords);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60"
                          >
                            {mergingClub === clubName ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                正在彙整目錄與分頁…
                              </>
                            ) : (
                              <>📥 合併下載此社團全學期紀錄 (PDF)</>
                            )}
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* 展開的子列 */}
                    {isExpanded &&
                      clubRecords.map((record) => {
                        const isLoading = downloadingId === record.id;
                        return (
                          <tr
                            key={record.id}
                            className="border-b border-gray-50 bg-gray-50/70"
                          >
                            <td className="px-3 py-2" />
                            <td className="px-4 py-2 text-gray-600">
                              {record.course_topic || "—"}
                            </td>
                            <td className="px-4 py-2 text-center tabular-nums text-gray-500">
                              {record.course_date}
                            </td>
                            <td className="px-4 py-2 text-center tabular-nums text-gray-500">
                              {record.teaching_hours ?? 0}h
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                disabled={isMergingPDF || isLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadPDF(record);
                                }}
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
                  </Fragment>
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
