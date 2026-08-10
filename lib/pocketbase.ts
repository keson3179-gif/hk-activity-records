import PocketBase, { type RecordModel } from "pocketbase";

const pocketbaseUrl =
  process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() || "https://db.keson.pro";

/** 與 db.keson.pro 實際 collection 名稱一致（單數） */
export const TEACHING_RECORD_COLLECTION = "teaching_record";

export const pb = new PocketBase(pocketbaseUrl);

/** 關閉自動取消，避免 React Strict Mode 雙重 effect 把請求取消 */
pb.autoCancellation(false);

export type TeachingRecord = RecordModel & {
  club_name: string;
  course_date: string;
  course_topic: string;
  content: string;
  attendance_count?: number | null;
  teaching_hours: number;
  submitter_name: string;
  submitter_role?: string;
  integrity_check?: boolean;
  photo_url?: string;
  photo?: string;
  /** 相容舊欄位名稱 */
  created_at?: string;
};

/** 優先使用 PB 檔案，其次舊 photo_url（含 Supabase 公開網址） */
export function getRecordPhotoUrl(record: TeachingRecord): string | null {
  if (record.photo) {
    try {
      return pb.files.getURL(record, record.photo);
    } catch {
      /* fall through */
    }
  }
  if (record.photo_url && String(record.photo_url).trim()) {
    return String(record.photo_url).trim();
  }
  return null;
}

/** 後台／PDF 使用的正規化資料列 */
export function normalizeTeachingRecord(record: TeachingRecord) {
  return {
    ...record,
    created_at: record.created || record.created_at,
    photo_url: getRecordPhotoUrl(record),
  };
}
