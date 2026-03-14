"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/lib/supabase";
import { CLUB_CATEGORIES, CATEGORY_KEYS, type CategoryKey } from "@/lib/constants";

type FormData = {
  clubName: string;
  date: string;
  topic: string;
  content: string;
  attendees: string;
  teachingHours: string;
  reporterName: string;
  reporterTitle: string;
  confirmed: boolean;
};

type PdfData = FormData & {
  photoUrl: string | null;
};

const initialForm: FormData = {
  clubName: "",
  date: "",
  topic: "",
  content: "",
  attendees: "",
  teachingHours: "",
  reporterName: "",
  reporterTitle: "",
  confirmed: false,
};

export default function Home() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [pdfData, setPdfData] = useState<PdfData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | "">("");
  const [selectedClub, setSelectedClub] = useState("");

  const clubOptions =
    selectedCategory && selectedCategory in CLUB_CATEGORIES
      ? CLUB_CATEGORIES[selectedCategory as CategoryKey].clubs
      : [];

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as CategoryKey | "";
    setSelectedCategory(value);
    setSelectedClub("");
    setForm((prev) => ({ ...prev, clubName: "" }));
  };

  const handleClubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedClub(value);
    setForm((prev) => ({ ...prev, clubName: value }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("請上傳圖片檔案（jpg / png 等）。");
      setPhotoUrl(null);
      setPhotoInputKey((prev) => prev + 1);
      return;
    }

    setUploadingPhoto(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const fileName = `${timestamp}_${random}.jpg`;

      const { data, error } = await supabase
        .storage
        .from("teaching-photos")
        .upload(fileName, file);

      if (error) {
        console.error("[TeachingRecord] Photo upload error", error);
        alert(
          "照片上傳失敗：" +
            (error.message || "請稍後再試。"),
        );
        setPhotoUrl(null);
        setPhotoInputKey((prev) => prev + 1);
        return;
      }

      const { data: publicData } = supabase
        .storage
        .from("teaching-photos")
        .getPublicUrl(data.path);

      setPhotoUrl(publicData.publicUrl);
    } catch (err: unknown) {
      console.error("[TeachingRecord] Unexpected error during photo upload", err);
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((err as any).message as string) ??
            "照片上傳時發生未知錯誤，請稍後再試。"
          : "照片上傳時發生未知錯誤，請稍後再試。";

      alert("照片上傳失敗：" + message);
      setPhotoUrl(null);
      setPhotoInputKey((prev) => prev + 1);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`圖片載入失敗 (${response.status})`);
    }

    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("讀取圖片資料失敗"));
        }
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error("讀取圖片資料失敗"));
      };
      reader.readAsDataURL(blob);
    });
  };

  const downloadPDF = async () => {
    try {
      if (!pdfData) return;

      const element = document.getElementById("pdf-template");
      if (!element) {
        alert("找不到 PDF 模板，請重新整理頁面後再試。");
        return;
      }

      // 先將 Supabase 圖片抓回來轉成 base64，再塞回模板中的 <img>
      if (pdfData.photoUrl) {
        const imgEl = element.querySelector<HTMLImageElement>("[data-pdf-photo]");
        if (imgEl) {
          try {
            const dataUrl = await toBase64(pdfData.photoUrl);
            imgEl.src = dataUrl;
          } catch (err) {
            console.error("[TeachingRecord] 下載或轉換照片失敗", err);
            // 若失敗就清空圖片，避免 html2canvas 報 CORS 錯誤，但仍繼續產生 PDF
            imgEl.src = "";
          }
        }
      }

      // 暫時停用包含 lab() 顏色函式的樣式表，避免 html2canvas 解析失敗
      const styleSheets = Array.from(document.styleSheets || []);
      const disabledSheets: CSSStyleSheet[] = [];

      for (const sheet of styleSheets) {
        try {
          const cssSheet = sheet as CSSStyleSheet;
          const rules = cssSheet.cssRules;
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule.cssText.includes("lab(")) {
              cssSheet.disabled = true;
              disabledSheets.push(cssSheet);
              break;
            }
          }
        } catch {
          // 可能是跨網域樣式表，忽略
        }
      }

      // 1. 強制確保模板在擷取時是可見的
      const originalDisplay = element.style.display;
      element.style.display = "block";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // 擷取完就還原顯示狀態
      element.style.display = originalDisplay;

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF("p", "mm", "a4");

      // 2. A4 寬度 210mm，固定以寬度等比縮放
      const pageWidth = 210;
      const ratio = pageWidth / canvas.width;
      const pageHeight = canvas.height * ratio;

      // 3. 防呆：高度異常時給預設值
      const safeHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 297;

      // 4. 固定從 (0,0) 放入圖片
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, safeHeight);

      // 5. 檔名使用社團名稱（避免空白）
      const clubName =
        pdfData.clubName ||
        (document.querySelector<HTMLInputElement>('input[name="clubName"]')?.value ??
          "社團");

      pdf.save(`教學紀錄_${clubName}.pdf`);

      // 還原被停用的樣式表
      disabledSheets.forEach((sheet) => {
        sheet.disabled = false;
      });
    } catch (err) {
      console.error("[TeachingRecord] PDF generate error", err);
      alert("PDF 產生失敗，請確認 F12 Console 訊息");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!form.confirmed) {
      setErrorMessage("請先勾選確認聲明後再提交。");
      return;
    }

    if (!form.clubName || !form.date || !form.topic || !form.content) {
      setErrorMessage("請將必填欄位（社團名稱、指導日期、課程主題、教學內容描述）填寫完整。");
      return;
    }

    if (!form.teachingHours || Number(form.teachingHours) <= 0) {
      setErrorMessage("請填寫『本次輔導時數』，且須大於 0。");
      return;
    }

    if (!form.reporterName) {
      setErrorMessage("請填寫『填報人姓名』欄位，此為必填。");
      return;
    }

    if (uploadingPhoto) {
      setErrorMessage("照片仍在上傳中，請稍候完成後再提交。");
      return;
    }

    setSubmitting(true);
    try {
      const attendance_count = form.attendees
        ? Number(form.attendees)
        : null;
      const teaching_hours = Number(form.teachingHours) || 0;

      console.log("準備送出的資料：", {
        club_name: form.clubName,
        course_date: form.date,
        course_topic: form.topic,
        content: form.content,
        attendance_count,
        teaching_hours,
        submitter_name: form.reporterName,
        submitter_role: form.reporterTitle,
        integrity_check: form.confirmed,
        photo_url: photoUrl,
      });

      const { error } = await supabase.from("teaching_records").insert({
        club_name: form.clubName,
        course_date: form.date,
        course_topic: form.topic,
        content: form.content,
        attendance_count,
        teaching_hours,
        submitter_name: form.reporterName,
        submitter_role: form.reporterTitle,
        integrity_check: form.confirmed,
        photo_url: photoUrl,
      });

      if (error) {
        console.log("完整的錯誤回傳：", error);
        alert(
          "詳細錯誤原因：" +
            (error.message || "") +
            " (代碼：" +
            (error.code || "無") +
            ")",
        );
        setErrorMessage("提交失敗，請稍後再試或聯繫系統管理員。");
        return;
      }

      setSuccessMessage("提交成功！已完成教學紀錄填報。");
      setPdfData({
        ...form,
        photoUrl,
      });
      setForm(initialForm);
      setSelectedCategory("");
      setSelectedClub("");
      setPhotoUrl(null);
      setPhotoInputKey((prev) => prev + 1);
    } catch (err: unknown) {
      console.error("[TeachingRecord] Unexpected error during submit", err);

      const message =
        typeof err === "object" && err !== null && "message" in err
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((err as any).message as string) ??
            "提交發生未知錯誤，請稍後再試。"
          : "提交發生未知錯誤，請稍後再試。";

      if (typeof window !== "undefined") {
        window.alert(message);
      }

      setErrorMessage("提交失敗，請稍後再試或聯繫系統管理員。");
    } finally {
      setSubmitting(false);
    }
  };

  const disableSubmit = submitting || uploadingPhoto || !form.confirmed;

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-6 font-sans text-zinc-900">
      <main className="mx-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-4 space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            社團指導老師教學紀錄
          </h1>
          <p className="text-xs text-zinc-500">
            適合手機填寫的簡易紀錄表單
          </p>
        </header>

        <section className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-900">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span>重要提醒：誠實申報聲明</span>
          </div>
          <p>
            本教學紀錄為正式依據，請務必據實填寫。偽造紀錄者，視情節嚴重程度，最重將予以輔導停社處分。
          </p>
        </section>

        {successMessage && (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <p>{successMessage}</p>
            </div>
            {pdfData && (
              <button
                type="button"
                onClick={downloadPDF}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-500 bg-white px-3 py-1.5 text-xs font-medium text-sky-600 shadow-sm transition hover:bg-sky-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1"
              >
                <span>📥 下載本次紀錄 PDF</span>
              </button>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>
                  社團屬性 <span className="text-red-500">*</span>
                </span>
              </label>
              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
              >
                <option value="">請選擇社團屬性...</option>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>
                  社團名稱 <span className="text-red-500">*</span>
                </span>
              </label>
              <select
                value={selectedClub}
                onChange={handleClubChange}
                disabled={!selectedCategory}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">請選擇社團...</option>
                {clubOptions.map((club) => (
                  <option key={club} value={club}>
                    {club}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>
                  指導日期 <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>
                  課程主題 <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="text"
                name="topic"
                value={form.topic}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                placeholder="例如：期初幹部訓練、比賽舞序彩排"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
              <span>
                教學內容描述 <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-zinc-400">
                建議簡要條列重點
              </span>
            </label>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              className="min-h-[96px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
              placeholder="例：1. 說明本學期社課規劃‧‧‧"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>出席人數</span>
              </label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                name="attendees"
                value={form.attendees}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                placeholder="例如：25"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>
                  本次輔導時數 (小時) <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                inputMode="decimal"
                name="teachingHours"
                value={form.teachingHours}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                placeholder="例如：2"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
              <span>教學成果照片上傳 (限 1 張)</span>
              <span className="text-[11px] font-normal text-zinc-400">
                供成果紀錄使用，非必填
              </span>
            </label>
            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-xs text-zinc-500 transition hover:border-indigo-300 hover:bg-indigo-50">
              <input
                key={photoInputKey}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <UploadCloud className="mb-2 h-6 w-6 text-zinc-400 group-hover:text-indigo-500" />
              <span className="mb-1 font-medium text-zinc-700">
                點擊選擇照片或拖放檔案至此
              </span>
              <span className="text-[11px] text-zinc-400">
                建議上傳清晰、單張的教學照片
              </span>
              {uploadingPhoto && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[11px] text-indigo-700">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  照片上傳中，請稍候…
                </span>
              )}
              {photoUrl && !uploadingPhoto && (
                <div className="mt-3 flex w-full items-center gap-3 rounded-lg bg-white/60 p-2 text-[11px]">
                  <div className="h-10 w-10 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                    <img
                      src={photoUrl}
                      alt="已上傳教學成果照片預覽"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-zinc-600">
                    <p className="font-medium">照片已上傳完成</p>
                    <p className="text-[10px] text-zinc-400">
                      如需更換，請重新選擇照片。
                    </p>
                  </div>
                </div>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>填報人姓名</span>
              </label>
              <input
                type="text"
                name="reporterName"
                value={form.reporterName}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                placeholder="例如：王小明"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>職稱</span>
              </label>
              <input
                type="text"
                name="reporterTitle"
                value={form.reporterTitle}
                onChange={handleChange}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none ring-0 transition focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                placeholder="例如：社長、指導老師"
              />
            </div>
          </div>

          <div className="mt-2 space-y-3 rounded-xl bg-zinc-50 px-3 py-3">
            <label className="flex items-start gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                name="confirmed"
                checked={form.confirmed}
                onChange={handleCheckboxChange}
                className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                我已確認以上資料真實無誤，並了解虛報之法律與行政責任。
              </span>
            </label>
            <p className="text-[11px] text-zinc-400">
              送出後如需更正，請聯繫社團承辦或指導老師協助處理。
            </p>
          </div>

          <button
            type="submit"
            disabled={disableSubmit}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {(submitting || uploadingPhoto) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <span>
              {uploadingPhoto
                ? "照片上傳中..."
                : submitting
                  ? "提交中..."
                  : "送出教學紀錄"}
            </span>
          </button>
        </form>

        {/* PDF 模板（隱藏但可被 html2canvas 擷取） */}
        <div
          id="pdf-template"
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
                {pdfData?.clubName || form.clubName || "　"}
              </div>
            </div>
            <div className="grid grid-cols-4 border-b border-[#111827]">
              <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
                指導日期
              </div>
              <div className="col-span-3 px-2 py-1">
                {pdfData?.date || form.date || "　"}
              </div>
            </div>
            <div className="grid grid-cols-4 border-b border-[#111827]">
              <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
                課程主題
              </div>
              <div className="col-span-3 px-2 py-1">
                {pdfData?.topic || form.topic || "　"}
              </div>
            </div>
            <div className="grid grid-cols-4 border-b border-[#111827]">
              <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
                出席人數
              </div>
              <div className="col-span-3 px-2 py-1">
                {pdfData?.attendees || form.attendees || "　"}
              </div>
            </div>
            <div className="grid grid-cols-4 border-b border-[#111827]">
              <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
                本次輔導時數
              </div>
              <div className="col-span-3 px-2 py-1">
                {(pdfData?.teachingHours || form.teachingHours || "0") + " 小時"}
              </div>
            </div>
            <div className="grid grid-cols-4">
              <div className="col-span-1 border-r border-[#111827] bg-[#f3f4f6] px-2 py-1 font-semibold">
                填報人姓名 / 職稱
              </div>
              <div className="col-span-3 px-2 py-1">
                {(pdfData?.reporterName || form.reporterName || "　") +
                  " / " +
                  (pdfData?.reporterTitle || form.reporterTitle || "　")}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 border-b border-[#111827] pb-1 text-[11px] font-semibold">
              教學內容描述
            </div>
            <div className="min-h-[160px] border border-[#111827] px-3 py-2 text-[11px] leading-relaxed">
              {(pdfData?.content || form.content || "").split("\n").map((line, idx) => (
                <p key={idx}>{line || "　"}</p>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1 border-b border-[#111827] pb-1 text-[11px] font-semibold">
              教學成果照片
            </div>
            <div className="flex min-h-[220px] items-center justify-center border border-[#111827] bg-[#f9fafb]">
              {pdfData?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  data-pdf-photo
                  src={pdfData.photoUrl}
                  alt="教學成果照片"
                  className="max-h-[260px] max-w-[500px] object-contain"
                />
              ) : (
                <span className="text-[11px] text-[#9ca3af]">
                  （本次未上傳教學成果照片）
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-8 text-[11px]">
            <div>
              <div className="mb-6 border-b border-dashed border-[#374151] pb-8">
                指導老師簽名：
              </div>
            </div>
            <div>
              <div className="mb-6 border-b border-dashed border-[#374151] pb-8">
                課外組審核：
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

