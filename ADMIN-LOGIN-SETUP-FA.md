# راه‌اندازی ورود پنل مدیریت در Cloudflare

خطای `Admin login configuration is incomplete` به این معنی است که Worker در محیطی که سایت را اجرا می‌کند، یک یا هر دو Secret زیر را دریافت نکرده است:

- `ADMIN_PASSWORD` — رمز ورود پنل مدیریت
- `ADMIN_TOKEN_SECRET` — کلید محرمانه برای امضای توکن ورود

این مقادیر عمداً داخل مخزن GitHub یا `wrangler.toml` قرار نمی‌گیرند. آن‌ها را در Cloudflare تنظیم کنید:

1. وارد Cloudflare Dashboard شوید.
2. به **Workers & Pages** بروید و Worker با نام **cloudeflare** را باز کنید.
3. وارد **Settings → Variables and Secrets** شوید.
4. دو مورد از نوع **Secret** بسازید؛ نام‌ها باید دقیقاً `ADMIN_PASSWORD` و `ADMIN_TOKEN_SECRET` باشند.
5. برای `ADMIN_PASSWORD` یک رمز قوی و اختصاصی انتخاب کنید.
6. برای `ADMIN_TOKEN_SECRET` یک مقدار تصادفی طولانی بسازید. روی سیستم دارای Node.js اجرا کنید:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

7. تغییرات را ذخیره و Worker را دوباره Deploy کنید. اگر چند Environment دارید، Secretها را در همان Environmentای تنظیم کنید که دامنهٔ عمومی سایت به آن متصل است.

همچنین می‌توانید از ترمینال در ریشه پروژه استفاده کنید:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_TOKEN_SECRET
npm run deploy
```

برای توسعه محلی، فایل `.dev.vars.example` را به `.dev.vars` کپی و مقادیر را فقط روی سیستم خودتان تنظیم کنید. فایل `.dev.vars` نباید به GitHub ارسال شود.

**نکته امنیتی:** هیچ رمز یا Secret را در چت، فایل README، کد JavaScript، `wrangler.toml` یا GitHub قرار ندهید. برای بررسی خطا فقط نام Secretهای تنظیم‌نشده لازم است، نه مقدار آن‌ها.
