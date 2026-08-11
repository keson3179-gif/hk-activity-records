# PocketBase：`teaching_record` collection

目標實例：`https://db.keson.pro`  
實際 collection 名稱為 **單數** `teaching_record`（與前端 `TEACHING_RECORD_COLLECTION` 一致）。

## API Rules

在 Admin → Collections → `teaching_record` → **API Rules**：

| 規則 | 值 | 意義 |
|------|-----|------|
| listRule | `""`（空字串／Public） | 公開列出 |
| viewRule | `""` | 公開檢視 |
| createRule | `""` | 公開新增 |
| updateRule | `null`（Locked） | 僅超管可改 |
| deleteRule | `null` | 僅超管可刪 |

> 空字串 = 公開；`null` = 僅 superuser。

## 欄位

依 [`teaching_records_schema.json`](./teaching_records_schema.json)，重點欄位：

| 欄位 | 類型 | 說明 |
|------|------|------|
| club_name … photo | （既有） | 見 schema |
| **semester** | text | 學期代碼，例 `1151`、`1142`（非必填；舊資料可回填） |

前端常數見 `lib/semester.ts`（當前學期 `CURRENT_SEMESTER`）。

### 新增 semester（Admin）

1. Collections → `teaching_record` → New field → Text，名稱 `semester`。
2. 執行本機回填（標既有資料為 1142）：

```bash
python scripts/backfill_semester_1142.py
```

## 照片策略

- **舊資料**：`photo_url` 保留原 Supabase 公開網址。
- **新上傳**：`photo` file；前端優先 `pb.files.getURL`。

## 環境變數

```env
NEXT_PUBLIC_POCKETBASE_URL=https://db.keson.pro
PB_ADMIN_EMAIL=你的管理員信箱
PB_ADMIN_PASSWORD=你的管理員密碼
```
