# 樂頤生雲端財務系統

手機、平板與電腦使用同一個帳號，即可讀寫同一本雲端帳本。GitHub 僅存程式，帳務保存在 Supabase PostgreSQL。每個帳號的帳本彼此隔離；本版未提供不同帳號共同編輯與角色管理。

## 使用方式

1. 由管理者在 Supabase Authentication 建立帳號並設定密碼。
2. 開啟網站登入，新增、修改、複製收支，或設定每週／每月批次記帳。
3. 儲存成功後才顯示完成。其他裝置按「重新整理」，或在沒有未完成表單時等待最多約 20 秒，即可讀取相同帳務。
4. 首次使用可按「匯入」選擇原版 JSON 備份。匯入會取代這個帳號的整本雲端帳本，請先下載現有備份。
5. 定期下載「完整備份」。CSV 包含目前帳號全部已載入紀錄，不受畫面篩選影響。

手機可由 Safari／Chrome 加到主畫面。離線快取只包含程式介面；帳務不放進瀏覽器持久儲存或 Service Worker 快取。頁面已開啟時斷線，仍可查看及備份已載入的帳務，但無法儲存修改。關閉後重新離線開啟，無法重新載入帳本。

帳號登入資訊保存在目前分頁的 sessionStorage；登出後清除帳務畫面。下載的備份檔仍由使用者自行保存。清空與刪除會影響所有裝置，未備份時無法從應用程式還原。

## 上線

- 建立專用 Supabase 專案，啟用 Data API。避免自動公開所有新資料表。
- 在 SQL Editor 執行 `supabase/setup.sql` 一次。腳本會建立 `finance_ledgers`、RLS 與 RPC，不會修改其他業務資料表。重複執行會在既有資料表處停止並回滾，請勿刪表重建。
- 在 Authentication 關閉公開註冊與匿名登入；由管理者建立／維護登入帳號。
- 前端只使用 **publishable key**。不要把 secret、service_role、資料庫密碼或私密備份加入儲存庫。
- GitHub Settings → Pages → Source 設為 GitHub Actions。
- 工作流程只發布 `site/`。測試、SQL 與使用說明都不會成為網站下載內容。
- 可設定 Repository Variables：`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`，工作流程會產生 `site/config.js`。兩者都是前端公開連線設定。
- 如已直接填好 `site/config.js`，網站可直接使用該設定；後續仍建議設定 Variables 方便部署管理。
- 請為維運帳號啟用服務提供者支援的帳號保護方式，並定期檢查 Supabase 使用量與備份政策。本程式沒有新增付費訂閱。

## 儲存與衝突處理

每個帳本是一份有版本的 JSON 文件，含收支、範本與 Logo。單次儲存透過 PostgreSQL RPC 在同一個交易中比對版本並鎖定帳本。同時編輯發生衝突時，伺服器拒絕舊版本，保留本機表單，要求重新整理。網路失敗而結果不明時，暫停後續寫入，先讀回雲端確認，避免重複記帳。

RLS 使用 `auth.uid()` 限定資料所有者。RPC 為 SECURITY INVOKER，不繞過 RLS。未登入不能查詢資料表或呼叫讀寫 RPC；UPDATE 同時檢查既有及新所有者。前端與資料庫都有資料格式檢查。

限制：每帳本最多 10,000 筆、200 個範本、Logo 1 MB，帳本約 4 MB；新臺幣正整數，每筆不超過十億元。適合小型公司收支紀錄，資料量成長後可再擴充為逐筆資料表與分頁查詢。每月重複記帳會把不存在的月底日期調至該月最後一天；批次紀錄是立即建立，並非到期自動收款。

## 驗證

Node.js 22 或更新版本：

```
npm ci
npm test
npm run test:db
```

測試覆蓋日期與備份驗證、雲端確認後更新、版本衝突、失敗後保留資料、阻擋重複送出及登出清除；資料庫測試使用獨立 PGlite PostgreSQL，驗證匿名拒絕、跨帳號隔離、原子寫入、重複請求、版本衝突與資料驗證。這些測試不會接觸正式帳務。

正式上線後仍需使用你自行建立的登入帳號驗收：登入 → 新增測試紀錄 → 另一裝置讀取 → 修改 → 備份與還原 → 登出。舊 App 資料不會自動上傳。

## 官方參考

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [前端公開金鑰](https://supabase.com/docs/guides/api/api-keys)
- [資料庫函式](https://supabase.com/docs/guides/database/functions)
- [GitHub Pages 工作流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
