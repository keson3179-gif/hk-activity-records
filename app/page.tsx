"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
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

  const handleReset = () => {
    setIsSubmitted(false);
    setForm(initialForm);
    setSelectedCategory("");
    setSelectedClub("");
    setPhotoUrl(null);
    setPhotoInputKey((prev) => prev + 1);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

      setIsSubmitted(true);
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

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 font-sans text-zinc-900">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-10 text-center shadow-sm sm:px-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold tracking-tight text-zinc-900">
            教學紀錄已成功送出！
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-zinc-500">
            數據已進入課外組審核系統，無需繳交紙本。
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            再填一筆
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-6 font-sans text-zinc-900">
      <main className="mx-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <header className="mb-4 space-y-2 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            社團指導老師教學紀錄
          </h1>
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

      </main>
    </div>
  );
}

