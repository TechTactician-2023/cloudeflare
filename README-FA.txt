پورتفولیوی Mahmood Sahebi — نسخه بازبینی و اصلاح‌شده

مهم برای دیپلوی: این پروژه یک Cloudflare Worker به‌همراه Static Assets و D1 است، نه سایت ایستای مستقل Cloudflare Pages. فایل wrangler.toml را در ریشهٔ مخزن نگه دارید و Worker را از ریشه با Wrangler منتشر کنید؛ انتشار فقط پوشهٔ dist به‌صورت Pages باعث می‌شود API و رسانهٔ D1 اجرا نشوند. اتصال GitHub باید ریشهٔ همین مخزن را به Worker متصل کند و متغیرهای ADMIN_PASSWORD و ADMIN_TOKEN_SECRET فقط در Cloudflare Secrets تنظیم شوند.

ساختار پروژه:
- Worker و API: src/index.js
- صفحات و فایل‌های ثابت سایت: dist/
- دیتابیس Cloudflare D1: اتصال PORTFOLIO_DB
- مایگریشن‌ها: migrations/
- تست‌های API: tests/smoke-test.mjs
- ویدیوی پیش‌نمایش محلی: preview-video/ (به‌صورت خودکار در سایت منتشر نمی‌شود)

قابلیت‌های سایت:
- صفحه آغازین سایت About است؛ صفحه Contact از مسیر contact.html در دسترس است.
- صفحات About، Expertise، Experience، Projects و Contact
- تغییر زبان بین انگلیسی، دری/فارسی، پشتو، روسی، آلمانی و فرانسوی
- تم روشن/تاریک با ذخیره انتخاب کاربر
- منوی همبرگری در نمایشگرهای کوچک
- طراحی واکنش‌گرا و راست‌چین برای دری/فارسی و پشتو
- شش کارت تخصص در صفحه Expertise
- متن‌های ترجمه‌شده و داستانی برای سوابق کاری پیش‌فرض
- محتوای پیش‌فرض HTML تا زمانی که محتوای CMS موجود نباشد حفظ می‌شود؛ موارد CMS کارت هم‌عنوان را به‌روزرسانی می‌کنند و موارد جدید به فهرست اضافه می‌شوند.

امکانات پنل مدیریت:
- ورود با ADMIN_PASSWORD و توکن امضاشده با ADMIN_TOKEN_SECRET
- ایجاد، مشاهده، ویرایش و حذف متن سوابق کاری
- ایجاد، مشاهده، ویرایش و حذف متن پروژه‌ها
- فیلدهای عنوان، شرکت/دسته‌بندی، تاریخ، توضیحات، بولت‌ها و تگ‌ها
- پنل مدیریت امکان ویرایش متن سوابق و پروژه‌ها و بارگذاری عکس/ویدیو برای آن‌ها را دارد.
- در بخش About می‌توان تصویر معرفی، چهار ویدیوی هایلایت، عنوان و متن هر ویدیو و پوستر اختیاری هر ویدیو را مدیریت کرد؛ تغییرات رسانه‌ای را با دکمه Save About media ذخیره کنید.
- ویدیوها از MP4/M4V، WebM، OGG/OGV و لینک عمومی YouTube/Vimeo پشتیبانی می‌کنند؛ برای پخش بین‌مرورگری، MP4 با کدک H.264 و صدای AAC پیشنهاد می‌شود. هر پسوندی به‌تنهایی تضمین‌کننده پخش نیست؛ کدک داخل فایل هم باید با مرورگر سازگار باشد.
- پنل فعلی برای متن‌های سفارشی CMS فیلد ترجمهٔ جداگانه برای هر زبان ندارد؛ متن‌های پیش‌فرض سایت در شش زبان پشتیبانی می‌شوند و محتوای سفارشی به همان زبانی نمایش داده می‌شود که در پنل وارد شده است.

قابلیت‌های API/ذخیره‌سازی باقی‌مانده:
- API عمومی محتوای experiences و projects از D1
- مسیرهای API قدیمی رسانه و تنظیمات رسانه About همچنان در Worker وجود دارند، اما از پنل متنی فعلی قابل مدیریت نیستند.
- فایل‌های رسانه D1 در جدول‌های media_files و media_chunks به قطعه‌های 256 KiB تقسیم می‌شوند.
- مسیر /media/... درخواست‌های Range برای پخش ویدیو را پشتیبانی می‌کند.
- محدودیت‌های قدیمی آپلود API: تصویر حداکثر 10 MiB و ویدیو حداکثر 25 MiB.
- این پروژه به Cloudflare R2 نیاز ندارد؛ ذخیره رسانه در D1 همچنان سهمیه فضای دیتابیس و عملیات خواندن/نوشتن مصرف می‌کند.

پیش از انتشار:
1. از مخزن GitHub و دیتابیس D1 نسخه پشتیبان بگیرید.
2. مطمئن شوید wrangler.toml به Worker و دیتابیس فعلی اشاره می‌کند؛ database_id را بدون قصد روشن تغییر ندهید.
3. با Node.js نسخه 22 یا بالاتر در ریشه پروژه اجرا کنید: npm install (نسخه Wrangler در package.json روی 4.152.0 ثابت شده است).
4. مایگریشن‌ها را فقط در صورتی اجرا کنید که هنوز اعمال نشده‌اند. ابتدا وضعیت را بررسی کنید: npx wrangler d1 migrations list mahmood-portfolio-content --remote
5. در Cloudflare Worker Variables/Secrets تنظیمات ADMIN_PASSWORD و ADMIN_TOKEN_SECRET را بررسی کنید؛ مقادیر محرمانه را در کد یا GitHub قرار ندهید.
6. تست‌ها: npm run test:smoke
7. بررسی نهایی تنظیمات و دارایی‌ها: npm run test:review و npm run deploy:dry
8. انتشار Worker به همراه دارایی‌های استاتیک: npm run deploy

یادداشت‌های این نسخه:
- اصلاح ترجمه سوابق کاری تا CMS دیگر محتوای ترجمه‌شده را با متن انگلیسی بازنویسی نکند.
- ترجمه کارت‌های شناخته‌شده بر اساس عنوان شغلی انجام می‌شود؛ متن سفارشی جدیدی که در پنل وارد شود خودکار به همه زبان‌ها ترجمه نمی‌شود و باید برای هر زبان جداگانه آماده شود.
- محتوای CMS دیگر باعث ناپدید شدن تمام کارت‌های HTML نمی‌شود: کارت هم‌عنوان جایگزین و محتوای جدید اضافه می‌شود.
- اصلاح خطای ورودی JSON برابر null در ورود مدیریت و تنظیمات About.
- اصلاح عنوان فرم هنگام جابه‌جایی بین «تجربه کاری» و «پروژه‌ها».
- حذف لینک تکراری فونت Google Fonts.
- تست‌های نحوی JavaScript، API، بررسی صفحات و لینک‌های محلی، CSP، مسیرهای Worker-first، سیاست کش، و تنظیمات Wrangler در workflow قابل اجرا هستند. این بررسی‌ها جایگزین تست دیپلوی واقعی روی حساب Cloudflare نیستند.
- پس از push به GitHub، workflow به‌صورت خودکار وابستگی‌ها را نصب می‌کند، تست‌ها را اجرا می‌کند و `wrangler deploy --dry-run` را برای ساخت باندل بدون انتشار روی محیط تولید اجرا می‌کند. باندل آزمایشی در artifact با نام `cloudflare-worker-dry-run` برای ۷ روز در GitHub Actions نگه‌داری می‌شود.


SEO Settings (added)
--------------------
After signing in to the admin panel, use SEO Settings to edit each public page's SEO title, meta description, canonical URL, Open Graph/Twitter sharing metadata, sharing image, and index/noindex setting. The Worker injects these values into the initial HTML response so crawlers can read them without running client-side JavaScript.

The Worker serves /robots.txt and /sitemap.xml. Pages marked noindex are omitted from the sitemap and receive a robots noindex directive. SEO settings are stored as JSON in the existing site_settings table under the key 'seo'; no new D1 migration is required. The admin page remains noindex.

Important multilingual limitation: the language selector currently changes content on the same page URL. SEO metadata is therefore managed per page, not per language-specific URL. To provide separate indexed metadata and hreflang annotations for every language, the site would first need distinct locale URLs (for example /fa/about.html and /en/about.html).


تصاویر محلی تجربه کاری (مهم):
- عکس Mikrogate در مسیر dist/assets/images/experience-mikrogate.jpg قرار دارد و در صفحه تجربه کاری نمایش داده می‌شود.
- برای تعویض عکس، همین نام فایل را نگه دارید؛ اگر نام را تغییر می‌دهید، مسیر داخل dist/experience.html را هم تغییر دهید.
- فایل‌های تصویری باید داخل dist باشند تا هنگام انتشار Cloudflare همراه سایت آپلود شوند.
- اگر رکورد تجربه کاری در پنل مدیریت وجود دارد ولی برای آن عکس تعیین نشده، کد عمومی سایت عکس محلی Mikrogate را حفظ می‌کند.
- برای افزودن عکس به تجربه‌های دیگر، فایل را در dist/assets/images/ بگذارید و placeholder همان کارت را در dist/experience.html با تگ img و مسیر /assets/images/نام-فایل.jpg جایگزین کنید.
- مسیرها به حروف بزرگ و کوچک حساس‌اند؛ نام فایل و مسیر باید دقیقاً یکسان باشند.


بررسی‌های کد و ترجمه:
- npm run test:smoke
- node tests/frontend-review.mjs
- npm run test:translations
این آزمون‌ها پوشش ترجمه‌ها، اعتبارسنجی ورودی و ساختار کد را بررسی می‌کنند؛ جایگزین آزمون بصری در مرورگر واقعی نیستند.


ویدیوهای صفحه About: از پنل مدیریت، بخش About page media and video slots، چهار جایگاه ویدیو را مدیریت کنید. آپلود D1 برای MP4/M4V، WebM و OGG/OGV با محدودیت 25 MiB برای هر ویدیو در نظر گرفته شده است؛ لینک مستقیم HTTPS و لینک عمومی YouTube/Vimeo نیز پشتیبانی می‌شود. برای استفاده از فایل محلی، آن را داخل dist/assets/videos/ بگذارید و مسیر /assets/videos/filename.mp4 را وارد کنید. بهتر است به MP4 (H.264 + AAC) یا WebM سازگار تبدیل کنید؛ مرورگرها همهٔ پسوندها و کدک‌ها را پشتیبانی نمی‌کنند.


بازبینی ترجمه‌ها (اکتبر ۲۰۲۶):
- زبان‌های عمومی سایت: English، دری/فارسی، پشتو، روسی، آلمانی و فرانسوی.
- ترجمهٔ عنوان‌ها، کارت‌های ثابت تخصص و پروژه، بخش ارتباط، بخش About، صفحه Experience، متادیتای SEO و متن‌های Video Highlights در bundle عمومی به‌روزرسانی شده است.
- پس از تغییر ترجمه‌ها شمارهٔ نسخهٔ فایل‌های CSS/JS در صفحات به‌روزرسانی می‌شود تا مرورگرها نسخهٔ قدیمی کش‌شده را استفاده نکنند.
- آزمون‌ها: `npm run test:review` و `npm run deploy:dry`. آزمون‌ها ساختار و پوشش کلیدهای قابل‌مشاهده را بررسی می‌کنند، اما جای بازبینی نهایی توسط ویراستار بومی پشتو/روسی/فرانسوی را نمی‌گیرند.
