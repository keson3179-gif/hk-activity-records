import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 偵測 URL 是否有被正確讀入，或是夾雜不可見字元
// 這段會在瀏覽器或 Node 的 console 中印出長度資訊
console.log("[Supabase] NEXT_PUBLIC_SUPABASE_URL length:", supabaseUrl?.length);
if (supabaseUrl) {
  console.log(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL trimmed length:",
    supabaseUrl.trim().length,
  );
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "缺少 Supabase 設定：請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


