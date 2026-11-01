راهنمای راه‌اندازی سایت و پنل مدیریت Mahmood Sahebi روی Cloudflare (پلن رایگان)
================================================================================

این پروژه به سرور/VPS جداگانه نیاز ندارد؛ از Cloudflare Pages Functions و D1 استفاده می‌کند. توجه: «بدون سرور جداگانه» است، اما برای ذخیره دائمی و مشترک محتوا، API ابری و دیتابیس لازم‌اند.

مهم: صرف Drag-and-drop پوشه dist در داشبورد Pages کافی نیست، چون روش آپلود استاتیک، پوشه functions و binding دیتابیس را راه‌اندازی نمی‌کند. از Git اتصال بده یا با Wrangler منتشر کن.

فایل‌ها
-------
dist/                  سایت عمومی و admin.html
functions/api/         API سمت Cloudflare
migrations/             ساختار D1
wrangler.toml           تنظیمات پروژه (باید database_id را تنظیم کنی)

راه پیشنهادی: Git + Cloudflare Pages
------------------------------------
1. فایل ZIP را استخراج کن و کل محتویات را در یک مخزن GitHub جدید قرار بده.
2. در Cloudflare Dashboard > Workers & Pages یک Pages project از طریق اتصال Git بساز.
3. Root directory را ریشه پروژه (جایی که wrangler.toml و پوشه functions قرار دارند) تنظیم کن؛ Build command را خالی بگذار و Build output directory را dist بگذار.
4. در Cloudflare Dashboard بخش Storage > D1 SQL Database یک دیتابیس بساز؛ مثلاً mahmood-portfolio-content.
5. شناسه دیتابیس (Database ID) را در wrangler.toml به جای REPLACE_WITH_YOUR_D1_DATABASE_ID قرار بده. فایل را commit/push کن.
6. در تنظیمات پروژه Pages بخش Settings > Functions > D1 database bindings، متغیر PORTFOLIO_DB را به همان دیتابیس وصل کن.
7. جدول را بساز: در D1 Console دیتابیس، محتوای فایل migrations/0001_content_items.sql را اجرا کن. (این کار را فقط یک بار انجام بده.)
8. در Settings > Variables and Secrets، دو Secret اضافه کن:
   ADMIN_PASSWORD = رمز قوی و منحصربه‌فردی که خودت انتخاب می‌کنی
   ADMIN_TOKEN_SECRET = رشته تصادفی محرمانه حداقل 32 بایت؛ آن را با کسی به اشتراک نگذار.
9. یک بار دیگر Deploy کن.
10. پنل: https://YOUR-SITE.pages.dev/admin.html
    سایت: https://YOUR-SITE.pages.dev/

روش جایگزین: Wrangler از کامپیوتر
--------------------------------
- Node.js نسخه LTS را نصب کن.
- در ریشه پروژه ترمینال باز کن و اجرا کن:
    npm install -g wrangler
    npx wrangler login
- دیتابیس D1 را از داشبورد بساز و database_id واقعی را در wrangler.toml بگذار.
- قبل از انتشار، binding و Secrets را در تنظیمات Pages هم اضافه کن.
- برای پروژه Pages موجود، از دستور انتشار Wrangler با نام دقیق پروژه استفاده کن؛ مطمئن شو پوشه functions در ریشه پروژه و خروجی dist وجود دارد.

استفاده از پنل
--------------
- وارد /admin.html شو.
- با ADMIN_PASSWORD وارد شو.
- در تب Experiences یا Projects مورد جدید اضافه کن، آیتم را ویرایش یا حذف کن.
- فیلد Image آدرس تصویر HTTPS یا مسیر نسبی فایل است. برای تصویر محلی، آن را داخل dist/assets/images قرار بده و مسیر مانند assets/images/my-photo.webp بنویس.
- تغییرات در D1 ذخیره می‌شوند و برای همه بازدیدکنندگان قابل مشاهده خواهند بود.

محدودیت‌های نسخه فعلی
---------------------
- پنل در این نسخه تجربه‌های کاری و پروژه‌ها را مدیریت می‌کند؛ متن همه بخش‌های About، Expertise، Contact و Resume هنوز از پنل قابل ویرایش نیست.
- آپلود باینری عکس از فرم مدیریت هنوز پیاده‌سازی نشده؛ باید عکس را در فایل‌های سایت قرار بده یا از URL تصویر HTTPS استفاده کن.
- برای اینکه عکس‌های HTTPS خارجی نمایش داده شوند، Content Security Policy در dist/_headers اجازه تصاویر HTTPS را می‌دهد.
- ایمیل نمونه، تاریخ‌های نمونه و محتوای رزومه را قبل از عمومی‌کردن اصلاح کن.
- هیچ رمز پیش‌فرضی در پروژه قرار داده نشده است. رمز را فقط در Cloudflare Secrets تنظیم کن؛ هرگز رمز را در HTML یا JavaScript ننویس.

هزینه
-----
این معماری معمولاً برای پورتفولیوی کم‌ترافیک در سهمیه پلن رایگان Cloudflare قابل استفاده است. سهمیه‌ها و قیمت‌ها ممکن است تغییر کنند؛ مصرف حساب را در داشبورد بررسی کن.
