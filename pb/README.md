# PocketBase：`teaching_record` collection

目標實例：`https://db.keson.pro`  
實際 collection 名稱為 **單數** `teaching_record`（與前端 `TEACHING_RECORD_COLLECTION` 一致）。

## 必改：API Rules（目前若全是 null，表單／後台會 403）

在 Admin → Collections → `teaching_record` → **API Rules** 設成：

| 規則 | 值 | 意義 |
|------|-----|------|
| listRule | `""`（空字串，或 UI 勾選 Public） | 公開列出 |
| viewRule | `""` | 公開檢視 |
| createRule | `""` | 公開新增 |
| updateRule | `null`（Locked／僅超管） | 僅超管可改 |
| deleteRule | `null` | 僅超管可刪 |

> PocketBase：空字串 = 公開；`null` = 僅 superuser。你貼出的 JSON 目前四條都是 `null`，**必須先改 list／view／create**，否則免登入表單與後台列表都會失敗。

## 建議調整欄位型別

你目前的 `teaching_hours` 是 **text**；建議改成 **Number**（與 `attendance_count` 一致），後台加總／達標統計較不易出錯。前端目前會送數字；若暫維持 text，PB 通常仍可收下字串化的值。

其餘欄位名稱已對齊：`club_name`、`course_date`、`course_topic`、`content`、`attendance_count`、`submitter_name`、`submitter_role`、`integrity_check`、`photo_url`、`photo`。

欄位核對可用 [`teaching_records_schema.json`](./teaching_records_schema.json)。

## 照片策略

- **舊資料**：只寫入 `photo_url`（保留原 Supabase 公開網址），不搬檔。
- **新上傳**：寫入 `photo` file；前端以 `pb.files.getURL(record, filename)` 優先顯示。

## 環境變數

```env
NEXT_PUBLIC_POCKETBASE_URL=https://db.keson.pro
```

匯入腳本另需（僅本機 `.env.local`，勿提交）：

```env
PB_ADMIN_EMAIL=你的管理員信箱
PB_ADMIN_PASSWORD=你的管理員密碼
```

然後執行：

```bash
python scripts/import_teaching_records_to_pb.py
```
