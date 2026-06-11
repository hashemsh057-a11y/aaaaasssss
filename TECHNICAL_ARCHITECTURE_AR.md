# التوثيق التقني لمنصة EngiFlow

آخر تحديث: 11 يونيو 2026

## 1. ملخص النظام

EngiFlow منصة لإدارة طلبات الصيانة المؤسسية. تتكون من:

- واجهة عامة تعرض الخدمات وتوجّه الشركات والمهندسين إلى بواباتهم.
- بوابة شركة للدخول برمز بريد من 4 أرقام، تقديم الطلبات، ومتابعة السجل.
- بوابة مهندس للدخول برمز بريد، تحديث التوفر، تنفيذ المهام، وإرسال الملاحظات.
- لوحة عمليات لإدارة الطلبات والمهندسين والشركات والتقارير.
- API خلفي يطبق قواعد سير العمل ويحفظ البيانات والصور.
- إشعارات بريد للمهندس عند تعيين طلب صيانة مع سجل نجاح وفشل وإعادة إرسال.
- تحقق OTP للشركات والمهندسين عبر Brevo Transactional Email API، بصلاحية افتراضية خمس دقائق.
- مولد تقارير PDF وExcel.
- نشر منفصل: الواجهة على Cloudflare Pages والـ API والوسائط على PythonAnywhere.

## 2. المعمارية

المعمارية الحالية هي Client/Server بطبقات واضحة:

1. طبقة العرض:
   - Next.js App Router.
   - React components.
   - Tailwind CSS.
   - تصدير Static Export إلى Cloudflare Pages.

2. طبقة الاتصال:
   - REST API عبر HTTPS.
   - JSON للطلبات العادية.
   - Multipart Form Data للصور.
   - CORS بين Cloudflare Pages وPythonAnywhere.

3. طبقة التطبيق:
   - Django.
   - Django REST Framework.
   - Serializers للتحقق والتحويل.
   - Views/ViewSets لمعالجة الطلبات.
   - Permissions لعزل صلاحيات المستخدمين الداخليين.

4. طبقة المجال:
   - نماذج الشركات والمهندسين والطلبات والأدلة.
   - آلة حالات لطلب الصيانة.
   - تحقق من توافق تخصص المهندس مع نوع العطل.

5. طبقة البيانات:
   - MySQL في الإنتاج.
   - SQLite في التطوير المحلي عند عدم ضبط متغيرات MySQL.
   - Django ORM وMigrations.

6. طبقة التقارير:
   - `maintenance/reports/data.py`: تجهيز البيانات.
   - `maintenance/reports/pdf.py`: إنشاء PDF.
   - `maintenance/reports/excel.py`: إنشاء Excel.

7. طبقة الإشعارات:
   - `maintenance/notifications.py`: تكوين رسالة التعيين وإرسالها.
   - Brevo Transactional Email API أو Cloudflare Email Sending REST API أو SMTP.
   - الوضع `auto` يفضل Brevo عند اكتمال إعداداته، ثم Cloudflare، ثم SMTP.
   - إرسال بعد نجاح معاملة قاعدة البيانات حتى لا يلغي تعطل البريد عملية التعيين.
   - سجل دائم لكل محاولة مع إعادة إرسال من Django Admin.
   - رموز OTP من 4 أرقام، صلاحيتها الافتراضية 5 دقائق، وتستخدم مرة واحدة.

8. طبقة التوجيه:
   - تعيين آلي حسب تخصص العطل.
   - يشترط أن يكون المهندس متوفراً ولا يملك مهمة نشطة.
   - يبقى التعيين اليدوي متاحاً عند عدم وجود مهندس حر.

## 3. اللغات والإصدارات

### Backend

- Python في الإنتاج: 3.12.
- Python في البيئة المحلية الحالية: 3.14.0a7، وهي نسخة Alpha تجريبية.
- Django: 6.0.6.
- Django REST Framework: 3.17.1.

التوصية: استخدام Python 3.12 أو 3.13 محلياً وفي الإنتاج لتجنب اختلاف السلوك مع نسخة Alpha.

### Frontend

- TypeScript: 5.9.3 مثبت فعلياً.
- JavaScript runtime: Node.js 22.19.0.
- npm: 10.9.3.
- Next.js: 15.5.19 مثبت فعلياً.
- React: 19.2.7.
- React DOM: 19.2.7.
- Type definitions: `@types/node` 22.19.19، و`@types/react` 19.2.16، و`@types/react-dom` 19.2.3.
- HTML5 وCSS3.

### لغات واجهة المستخدم

- العربية، باتجاه RTL.
- الإنجليزية، باتجاه LTR.

## 4. قواعد البيانات

### الإنتاج

- المحرك: MySQL.
- الموصل: mysqlclient 2.2.8.
- الترميز: utf8mb4.
- وضع SQL: STRICT_TRANS_TABLES.
- إصدار خادم MySQL تديره PythonAnywhere وغير مثبت داخل المستودع.

### التطوير

- المحرك الافتراضي: SQLite.
- الملف: `db.sqlite3`.

## 5. عدد الجداول

عدد الجداول الحالي: 19 جدولاً.

- 10 جداول مجال رئيسية خاصة بالمنصة.
- 9 جداول داخلية للمصادقة والصلاحيات والجلسات وDjango.

تشمل الجداول الجديدة تحديات OTP وسجل نشاط الطلبات.

## 6. جداول المجال

### 6.1 `maintenance_user`

الغرض: المستخدم الأساسي للنظام والمصادقة وتحديد الدور.

أهم الحقول:

- `id`: المفتاح الأساسي.
- `username`: اسم الدخول، فريد.
- `email`: البريد، فريد.
- `password`: كلمة المرور المشفرة.
- `first_name`, `last_name`: الاسم.
- `role`: ADMIN أو ENGINEER أو CLIENT_COMPANY أو QUALITY_CONTROLLER.
- `is_staff`, `is_superuser`, `is_active`: صلاحيات Django.
- `last_login`, `date_joined`: تواريخ الحساب.

### 6.2 `maintenance_companyprofile`

الغرض: معلومات الشركة أو الكلية صاحبة طلب الصيانة.

الحقول:

- `id`: المفتاح الأساسي.
- `user_id`: علاقة One-to-One مع `maintenance_user`.
- `company_name`: اسم الشركة أو الجهة.
- `commercial_register`: السجل التجاري.
- `contact_phone`: هاتف التواصل.
- `address`: العنوان.
- `is_archived`: أرشفة الحساب دون حذف سجل الصيانة.

### 6.3 `maintenance_engineerprofile`

الغرض: ملف المهندس الداخلي الذي لديه حساب مستخدم كامل.

الحقول:

- `id`: المفتاح الأساسي.
- `user_id`: علاقة One-to-One مع المستخدم.
- `employee_id`: الرقم الوظيفي، فريد.
- `department`: القسم.
- `specialty`: التخصص.
- `phone`: الهاتف.
- `avatar`: الصورة.
- `availability_status`: متوفر أو في موقع عمل أو في إجازة.
- `experience_years`: سنوات الخبرة.

### 6.4 `maintenance_publicengineer`

الغرض: ملف المهندس المسجل من الواجهة العامة دون إنشاء مستخدم Django كامل.

الحقول:

- `id`: المفتاح الأساسي.
- `name`: الاسم.
- `phone`: الهاتف.
- `email`: البريد.
- `department`: القسم.
- `specialty`: التخصص.
- `profession`: المهنة.
- `avatar`: صورة WebP بعد المعالجة.
- `experience_years`: سنوات الخبرة.
- `is_available`: متوفر أو غير متوفر للعمل.
- `availability_token`: رمز إدارة سري لتغيير حالة التوفر.
- `device_id_hash`: بصمة HMAC لمعرف الجهاز العشوائي، ولا يخزن MAC.
- `device_label`: وصف مثل Chrome on Windows.
- `device_last_seen_at`: آخر وقت تعرف فيه النظام على الجهاز.
- `created_at`: وقت التسجيل.

هوية الجهاز:

- المتصفح ينشئ UUID عشوائياً ويحفظه في Local Storage.
- الخادم لا يخزن UUID الخام، بل بصمة HMAC مرتبطة بمفتاح Django.
- تستخدم البصمة لاستعادة ملف المهندس والبريد على نفس المتصفح.
- المتصفح لا يستطيع قراءة MAC Address، ولا يجب محاولة ذلك لأسباب أمنية وخصوصية.
- حذف بيانات المتصفح أو استخدام متصفح آخر ينتج هوية جهاز مختلفة.
- هذه الآلية لتحسين الاستمرارية وليست بديلاً عن المصادقة بالبريد وكلمة المرور أو OTP.

### 6.5 `maintenance_maintenancerequest`

الغرض: طلب الصيانة وسجل سير العمل.

الحقول:

- `id`: رقم التذكرة.
- `client_company_id`: الشركة صاحبة الطلب.
- `issue_type`: نوع العطل.
- `priority`: LOW أو MEDIUM أو HIGH أو CRITICAL.
- `location_details`: موقع العطل.
- `description`: وصف المشكلة.
- `preferred_date`: الموعد المطلوب.
- `is_hazardous`: وجود خطورة تشغيلية.
- `cost`: تكلفة الصيانة.
- `status`: حالة الطلب.
- `assigned_engineer_id`: مهندس داخلي.
- `assigned_public_engineer_id`: مهندس من الدليل العام.
- `assigned_at`: وقت التعيين.
- `in_progress_at`: وقت بدء العمل.
- `waiting_spare_parts_at`: وقت انتظار القطع.
- `completed_at`: وقت الإنجاز.
- `closed_at`: وقت الإغلاق.
- `rejected_at`: وقت الرفض.
- `created_at`, `updated_at`: الإنشاء وآخر تعديل.

الحالات:

- NEW.
- UNDER_REVIEW.
- ASSIGNED.
- IN_PROGRESS.
- WAITING_SPARE_PARTS.
- COMPLETED.
- REJECTED.
- CLOSED.

### 6.6 `maintenance_requestevidence`

الغرض: صور توثيق العمل قبل وأثناء وبعد التنفيذ.

الحقول:

- `id`: المفتاح الأساسي.
- `request_id`: طلب الصيانة.
- `stage`: BEFORE_EXECUTION أو DURING_EXECUTION أو AFTER_EXECUTION.
- `image`: الصورة.
- `uploaded_by_id`: المستخدم الرافع.
- `uploaded_at`: وقت الرفع.

### 6.7 `maintenance_publiccontactinquiry`

الغرض: رسائل واستفسارات التواصل العامة.

الحقول:

- `id`: المفتاح الأساسي.
- `contact_name`: اسم المسؤول.
- `company_name`: الشركة.
- `email`: البريد.
- `phone`: الهاتف.
- `message`: الرسالة.
- `status`: NEW أو CONTACTED أو QUALIFIED أو CLOSED.
- `created_at`, `updated_at`.

### 6.8 `maintenance_assignmentnotification`

الغرض: تسجيل إشعار البريد الذي ينشأ عند تعيين طلب صيانة إلى مهندس.

الحقول:

- `id`: المفتاح الأساسي.
- `request_id`: طلب الصيانة.
- `public_engineer_id`: المهندس العام إن كان هو المعيّن.
- `engineer_profile_id`: المهندس الداخلي إن كان هو المعيّن.
- `recipient_email`: البريد المستلم.
- `subject`: عنوان الرسالة.
- `provider`: BREVO أو CLOUDFLARE أو SMTP أو DISABLED.
- `status`: PENDING أو SENT أو FAILED أو SKIPPED.
- `attempts`: عدد محاولات الإرسال.
- `provider_response`: استجابة مزود البريد بصيغة JSON.
- `error_message`: سبب الفشل أو التخطي.
- `sent_at`: وقت نجاح الإرسال.
- `created_at`, `updated_at`: وقت الإنشاء وآخر تحديث.

يمكن للأدمن تحديد السجلات الفاشلة من Django Admin واستخدام إجراء إعادة الإرسال.

### 6.9 `maintenance_portalotpchallenge`

الغرض: حفظ تحدي التحقق المؤقت لتسجيل أو دخول الشركة والمهندس.

الحقول:

- `email`: البريد المستهدف.
- `role`: COMPANY أو ENGINEER.
- `purpose`: LOGIN أو REGISTER.
- `code_hash`: بصمة الرمز، ولا يحفظ الرمز الخام.
- `payload`: بيانات التسجيل المؤقتة.
- `attempts`: المحاولات الخاطئة.
- `expires_at`, `consumed_at`, `created_at`: الصلاحية والاستخدام والإنشاء.

### 6.10 `maintenance_requestactivity`

الغرض: سجل الملاحظات وتغيرات الحالة والتعيين الآلي المرتبطة بالطلب.

الحقول:

- `request_id`: طلب الصيانة.
- `public_engineer_id`: المهندس صاحب التحديث.
- `event_type`: NOTE أو STATUS أو ACCEPTED أو AUTO_ASSIGNED.
- `message`: الملاحظة أو وصف الحدث.
- `created_at`: وقت الحدث.

## 7. جداول Django الداخلية

### `auth_group`

مجموعات الصلاحيات.

### `auth_group_permissions`

ربط المجموعات بالصلاحيات.

### `auth_permission`

الصلاحيات المعرفة لكل Model.

### `django_admin_log`

سجل عمليات Django Admin.

### `django_content_type`

فهرس أنواع النماذج المستخدمة في نظام الصلاحيات.

### `django_migrations`

سجل الـ migrations المطبقة.

### `django_session`

جلسات Django.

### `maintenance_user_groups`

ربط المستخدمين بالمجموعات.

### `maintenance_user_user_permissions`

الصلاحيات المباشرة لكل مستخدم.

## 8. مكتبات Backend

- asgiref 3.11.1: دعم ASGI والمكونات غير المتزامنة.
- Django 6.0.6: إطار Backend وORM وAdmin.
- django-cors-headers 4.9.0: إعداد CORS.
- djangorestframework 3.17.1: REST API.
- djangorestframework-simplejwt 5.5.1: JWT.
- mysqlclient 2.2.8: الاتصال بـ MySQL.
- Pillow 12.2.0: معالجة الصور وتحويلها إلى WebP.
- PyJWT 2.13.0: التعامل مع JWT.
- python-dotenv 1.2.2: تحميل متغيرات `.env`.
- sqlparse 0.5.5: معالجة SQL ضمن Django.
- tzdata 2026.2: المناطق الزمنية.
- arabic-reshaper 3.0.1: تشكيل العربية في التقارير.
- python-bidi 0.6.10: اتجاه النص العربي.
- openpyxl 3.1.5: تقارير Excel.
- reportlab 4.5.1: تقارير PDF.

## 9. مكتبات Frontend

- Next.js 15.5.19: App Router والبناء والتصدير الثابت.
- React 19.2.7: بناء المكونات.
- React DOM 19.2.7: عرض React في المتصفح.
- TypeScript 5.9.3: الأنواع والتحقق وقت البناء.
- `@types/node` 22.19.19: أنواع Node.js.
- `@types/react` 19.2.16: أنواع React.
- `@types/react-dom` 19.2.3: أنواع React DOM.
- Tailwind CSS 3.4.17: التصميم.
- Framer Motion 12.40.0: الحركة والانتقالات.
- Lucide React 0.468.0: الأيقونات.
- React CountUp 6.5.3: تحريك الأرقام.
- Autoprefixer 10.5.0: توافق CSS.

## 10. التحديث الحي

النظام لا يستخدم WebSocket حالياً. يستخدم Polling محسناً:

- لوحة العمليات: تحديث صامت كل 27 ثانية.
- بوابة المهندس: تحديث صامت كل 20 ثانية وعند استعادة التركيز.
- المؤشرات العامة: تحديث كل 54 ثانية.
- التحديث يتوقف عند إخفاء الصفحة لتقليل الاستهلاك.
- عند العودة للنافذة أو استعادة التركيز يتم تحديث البيانات.

هذا يمثل زيادة تقارب 10% مقارنة بدورات 30 و60 ثانية، مع تقليل الطلبات غير الضرورية.

## 11. الصور والوسائط

- صور المهندسين تقبل JPG وPNG وWebP.
- الحد الأقصى للرفع: 5 MB.
- الخادم يصحح اتجاه EXIF.
- يصغر الصورة إلى حد أقصى 1024x1024.
- يحول الصورة إلى WebP بجودة 84.
- الصور تحفظ تحت `media/engineers/public/YYYY/MM/`.
- PythonAnywhere يقدم الملفات عبر URL `/media/`.
- الواجهة توفر Lightbox لفتح الصورة بوضوح.

## 12. التقارير

الأنواع:

- تقرير صيانة شهري.
- تقرير حسب الكلية أو الشركة.
- تقرير حسب المهندس.
- تقرير الأعطال المتكررة.
- تقرير تكلفة الصيانة.

الصيغ:

- PDF عبر ReportLab.
- Excel عبر OpenPyXL.

## 13. النشر

### Cloudflare Pages

- يستضيف الواجهة الثابتة.
- أمر البناء: `npm run build`.
- مجلد الإخراج: `frontend/out`.
- متغير API:
  `NEXT_PUBLIC_API_URL=https://aaaaasssss.pythonanywhere.com/api`

### PythonAnywhere

- يستضيف Django API.
- WSGI.
- Virtualenv باسم `techmaintenance-env`.
- مسار المشروع: `/home/aaaaasssss/TechMaintenanceSystem`.
- Static mapping: `/static/`.
- Media mapping: `/media/`.
- يحتاج تطبيق migrations حتى `0010_alter_assignmentnotification_provider`.
- إعداد البريد يتم بمتغيرات البيئة ولا تحفظ مفاتيح API داخل المستودع.

### إعداد بريد التعيين

- `ASSIGNMENT_EMAIL_PROVIDER=brevo` هو الإعداد المستخدم حاليًا لإرسال OTP والبريد التشغيلي.
- يلزم `BREVO_API_KEY` وعنوان مرسل مؤكد في Brevo.
- لا يحتاج النظام كلمة مرور Gmail عند استخدام Brevo.
- يمكن استخدام `ASSIGNMENT_EMAIL_PROVIDER=cloudflare` عند توفر نطاق إرسال مملوك ومفعّل.
- يمكن استخدام `ASSIGNMENT_EMAIL_PROVIDER=smtp` كبديل.
- الوضع `auto` يختار Brevo، ثم Cloudflare، ثم SMTP، وإلا يسجل الإشعار SKIPPED.
- القيم الكاملة موثقة في `.env.pythonanywhere.example`.

## 14. الملفات والمسؤوليات

- `core/settings.py`: الإعدادات وقاعدة البيانات والأمان وCORS.
- `core/urls.py`: مسارات API.
- `maintenance/models.py`: نماذج البيانات وقواعد المجال.
- `maintenance/serializers.py`: التحقق وتحويل JSON والصور.
- `maintenance/views.py`: endpoints ومنطق العمليات.
- `maintenance/permissions.py`: الصلاحيات.
- `maintenance/services.py`: إحصائيات وخدمات المجال.
- `maintenance/notifications.py`: إشعارات تعيين المهندسين ومزودات البريد.
- `maintenance/portal.py`: OTP، جلسات البوابات، والتوجيه الآلي.
- `maintenance/tests.py`: اختبارات Backend.
- `frontend/src/lib/api.ts`: عميل API.
- `frontend/src/lib/types.ts`: أنواع TypeScript.
- `frontend/src/lib/deviceIdentity.ts`: هوية الجهاز العشوائية.
- `frontend/src/components/PublicLanding.tsx`: الموقع العام.
- `frontend/src/components/PublicDashboard.tsx`: لوحة العمليات.
- `frontend/src/components/CompanyPortal.tsx`: حساب الشركة وطلباتها.
- `frontend/src/components/EngineerPortal.tsx`: حساب المهندس ومهامه.
- `frontend/src/components/EngineerAvatar.tsx`: صورة المهندس وFallback.
- `frontend/src/components/ImageLightbox.tsx`: تكبير الصور.

## 15. ملاحظات أمنية

- لا يمكن لموقع ويب قراءة MAC Address.
- معرّف الجهاز الحالي عشوائي ومخزن محلياً ومشفّر كبصمة في الخادم.
- بوابة لوحة العمليات الحالية Client-side وليست حماية Backend كاملة.
- endpoints العامة للإدارة صممت ضمن النموذج الحالي المفتوح.
- قبل الاستخدام التجاري واسع النطاق يجب نقل إدارة الداشبورد إلى JWT حقيقي وصلاحيات Backend.
- بوابتا الشركة والمهندس تستخدمان جلسات Django موقعة بعد تحقق Email OTP.
- رمز OTP لا يحفظ بصورته الخام، بل يحفظ كـ HMAC hash.
- رمز OTP صالح افتراضيًا 5 دقائق، بحد أقصى 5 محاولات، وفاصل 60 ثانية بين طلبات الرموز.
- جلسة البوابة صالحة افتراضيًا 30 يومًا وتحفظ في Local Storage على جهاز المستخدم.
- ترويسة `X-Portal-Token` مسموحة صراحة في CORS بين Cloudflare Pages وPythonAnywhere.

## 16. أوامر التحقق

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test maintenance
```

```bash
cd frontend
npm run typecheck
npm run build
```

## 17. صفحات الواجهة

### `/`

الموقع العام ويحتوي على:

- تعريف المنصة.
- إحصاءات التشغيل.
- تخصصات الصيانة التسعة.
- دليل المهندسين المتوفرين.
- تقديم طلب عام.
- تتبع الطلب برقم التذكرة.
- روابط بوابتي الشركة والمهندس.

### `/dashboard`

لوحة العمليات الرئيسية، وتشمل:

- إحصاءات الطلبات.
- إدارة دورة حياة الطلب.
- تعيين مهندس يدويًا.
- التعيين الآلي حسب التخصص والتوفر والحمل الحالي.
- إدارة المهندسين والشركات.
- عرض صور المهندسين.
- حذف أو أرشفة حساب الشركة.
- تعديل بيانات المهندس وحذفه.
- التقارير PDF وExcel.

### `/company`

بوابة الشركة، وتشمل:

- إنشاء حساب شركة أو تسجيل الدخول بالبريد.
- تحقق OTP من 4 أرقام.
- عرض طلبات الشركة الحالية والمنجزة والسابقة فقط.
- إنشاء طلب صيانة جديد.
- معرفة المهندس المعيّن.
- متابعة الحالة وآخر نشاط.
- حفظ جلسة الدخول على الجهاز.

### `/engineer`

بوابة المهندس، وتشمل:

- تسجيل مهندس جديد أو الدخول بالبريد.
- تحقق OTP من 4 أرقام.
- عرض الملف والصورة والتخصص والخبرة.
- التحكم في حالة التوفر.
- عرض المهام المسندة لهذا المهندس فقط.
- قبول المهمة وبدء العمل.
- الانتقال إلى انتظار قطع غيار.
- استئناف العمل أو إنهاؤه.
- إضافة ملاحظات فنية تظهر للإدارة والشركة.

### `/login`

صفحة دخول لوحة العمليات. التطبيق الحالي يعتمد حاجزًا محليًا في الواجهة، وليس نظام مصادقة Backend كاملاً لهذه الصفحة.

## 18. جرد REST API

### الصحة والإدارة

- `GET /health/`: فحص جاهزية الخادم.
- `/admin/`: Django Admin.
- `/api/`: جذر DRF Router.

### JWT

- `POST /api/auth/token/`: إصدار Access وRefresh Token.
- `POST /api/auth/token/refresh/`: تحديث Access Token.
- `POST /api/auth/token/verify/`: التحقق من Token.

### موارد DRF الداخلية

- `/api/users/`: المستخدمون.
- `/api/companies/`: ملفات الشركات.
- `/api/engineers/`: ملفات المهندسين الداخليين.
- `/api/maintenance-requests/`: طلبات الصيانة.
- `/api/request-evidences/`: أدلة وصور التنفيذ.

توفر هذه المسارات عمليات CRUD حسب ViewSet والصلاحيات المعرفة في `maintenance/permissions.py`.

### البيانات العامة

- `GET /api/dashboard/statistics/`: مؤشرات لوحة العمليات.
- `POST /api/public/contact/`: إرسال استفسار.
- `GET /api/public/capabilities/`: قدرات نسخة Backend.
- `GET /api/public/companies-list/`: قائمة الشركات.
- `GET|POST /api/public/engineers/`: قائمة أو تسجيل مهندس.
- `GET|PATCH|DELETE /api/public/engineers/{id}/`: عرض أو تعديل أو حذف مهندس.
- `POST /api/public/engineer-device-session/`: استعادة هوية المهندس على الجهاز.
- `POST /api/public/engineers/{id}/availability/`: تحديث توفر المهندس.
- `GET /api/public/impact/`: إحصاءات الأثر العام.
- `POST /api/public/requests/`: إنشاء طلب عام.
- `GET /api/public/requests-list/`: قائمة الطلبات العامة للوحة العمليات.
- `GET /api/public/track/{ticket}/`: تتبع تذكرة.

### إدارة الطلبات العامة

- `POST /api/public/admin/requests/{id}/transition/`: تغيير الحالة والتعيين.
- `POST /api/public/admin/requests/{id}/cost/`: ضبط تكلفة الصيانة.
- `DELETE /api/public/admin/companies/{id}/`: أرشفة الشركة وتعطيل حسابها.

### بوابة الشركة

- `POST /api/public/portal/company/request-code/`: طلب OTP للتسجيل أو الدخول.
- `POST /api/public/portal/company/verify/`: التحقق من OTP وإصدار جلسة.
- `GET /api/public/portal/company/dashboard/`: ملف الشركة وطلباتها فقط.
- `POST /api/public/portal/company/requests/`: إنشاء طلب باسم الشركة الحالية.

### بوابة المهندس

- `POST /api/public/portal/engineer/request-code/`: طلب OTP.
- `POST /api/public/portal/engineer/verify/`: التحقق وإصدار جلسة.
- `GET /api/public/portal/engineer/dashboard/`: ملف المهندس ومهامه فقط.
- `POST /api/public/portal/engineer/availability/`: تحديث التوفر.
- `POST /api/public/portal/engineer/requests/{id}/action/`: تحديث حالة المهمة أو إضافة ملاحظة.

### التقارير

- `GET /api/public/reports/{kind}/`: تنزيل تقرير.

القيم المدعومة لـ`kind`:

- `monthly`.
- `company`.
- `engineer`.
- `recurring`.
- `cost`.

الصيغة تحدد عبر `file_format=pdf` أو `file_format=xlsx`.

## 19. عزل البيانات

### حساب الشركة

- جلسة الشركة تحتوي على دور `COMPANY` ومعرف الشركة والبريد.
- `company_from_session()` يعيد الشركة المطابقة للجلسة فقط.
- استعلام لوحة الشركة يستخدم `company.maintenance_requests`.
- نتيجة ذلك أن أقسام الحالية والمنجزة والسجل الكامل تعرض طلبات الشركة الحالية فقط.

### حساب المهندس

- جلسة المهندس تحتوي على دور `ENGINEER` ومعرف المهندس والبريد.
- `engineer_from_session()` يتحقق من المعرف والبريد.
- لوحة المهندس ترشح الطلبات بواسطة `assigned_public_engineer=engineer`.
- لا يستطيع المهندس تحديث طلب غير مسند إليه.

### المستخدمون الداخليون

- صلاحيات الإدارة والمهندس والشركة ومراقب الجودة معرفة في `maintenance/permissions.py`.
- قواعد الانتقال بين الحالات معرفة داخل Model، وليست معتمدة على الواجهة فقط.

## 20. سير عمل طلب الصيانة

المسار الأساسي:

```text
NEW
  -> UNDER_REVIEW
      -> ASSIGNED
          -> IN_PROGRESS
              -> WAITING_SPARE_PARTS
                  -> IN_PROGRESS
              -> COMPLETED
                  -> CLOSED
```

المسارات البديلة:

```text
NEW -> REJECTED
UNDER_REVIEW -> REJECTED
WAITING_SPARE_PARTS -> COMPLETED
```

ضوابط المجال:

- لا يمكن وضع الطلب في حالة تشغيلية دون مهندس.
- يجب أن يطابق تخصص المهندس نوع العطل.
- الشركة لا تغير حالة سير العمل.
- المهندس لا يعدل إلا الطلبات المسندة إليه.
- وقت كل مرحلة يحفظ في حقل مستقل.
- تكلفة الصيانة لا تقبل قيمة سالبة.

## 21. التعيين الآلي

ينفذ في `maintenance/portal.py` وفق القواعد التالية:

1. مطابقة تخصص المهندس مع `issue_type`.
2. اشتراط `is_available=True`.
3. استبعاد المهندس الذي لديه طلب نشط.
4. اختيار المهندس الأقل حملًا، ثم الأقدم تسجيلًا عند التساوي.
5. تحويل الطلب إلى `ASSIGNED`.
6. إنشاء حدث `AUTO_ASSIGNED`.
7. إنشاء إشعار بريد للمهندس.

إذا لم يوجد مهندس مناسب يبقى الطلب دون تعيين ليعالجه الأدمن يدويًا.

## 22. OTP والجلسات

تدفق الدخول:

1. المستخدم يدخل بريده.
2. الخادم يتحقق من وجود حساب مطابق للدور.
3. يولد رمزًا عشوائيًا من 4 أرقام.
4. يحفظ HMAC hash للرمز، وليس الرمز الخام.
5. يرسل الرمز عبر Brevo أو مزود البريد المحدد.
6. المستخدم يدخل الرمز.
7. الخادم يتحقق من الصلاحية والمحاولات وعدم الاستخدام السابق.
8. يصدر جلسة Django موقعة تحمل الدور والمعرف والبريد.
9. الواجهة تحفظ الجلسة في Local Storage وترسلها في `X-Portal-Token`.

القيم الافتراضية:

- صلاحية OTP: 5 دقائق.
- أقصى محاولات: 5.
- الفاصل بين طلبات الرموز: 60 ثانية.
- صلاحية جلسة البوابة: 30 يومًا.
- إظهار رمز التطوير: معطل افتراضيًا.

## 23. البريد الإلكتروني

الرسائل الحالية:

- رمز دخول أو تسجيل الشركة.
- رمز دخول المهندس.
- إشعار تعيين طلب صيانة للمهندس.

المزودات المدعومة:

1. Brevo Transactional Email API.
2. Cloudflare Email Sending REST API.
3. SMTP عبر Django.
4. Disabled لتعطيل الإرسال.

Brevo يستخدم:

- Endpoint: `https://api.brevo.com/v3/smtp/email`.
- مصادقة عبر `api-key`.
- عنوان مرسل مؤكد في حساب Brevo.
- محتوى HTML عربي باتجاه RTL.

لا تحفظ المفاتيح في GitHub. تحفظ في `.env` على PythonAnywhere.

## 24. إعدادات البيئة

أهم المتغيرات:

### Django

- `DJANGO_DEBUG`.
- `DJANGO_SECRET_KEY`.
- `DJANGO_ALLOWED_HOSTS`.
- `DJANGO_TIME_ZONE`.
- `FRONTEND_URL`.

### قاعدة البيانات

- `DB_ENGINE`.
- `DB_NAME`.
- `DB_USER`.
- `DB_PASSWORD`.
- `DB_HOST`.
- `DB_PORT`.

### CORS وCSRF

- `CORS_ALLOWED_ORIGINS`.
- `CSRF_TRUSTED_ORIGINS`.

### JWT

- `JWT_ACCESS_TOKEN_MINUTES`.
- `JWT_REFRESH_TOKEN_DAYS`.

### OTP

- `PORTAL_OTP_TTL_MINUTES`.
- `PORTAL_OTP_MAX_ATTEMPTS`.
- `PORTAL_OTP_COOLDOWN_SECONDS`.
- `PORTAL_SESSION_MAX_AGE_SECONDS`.
- `PORTAL_OTP_EXPOSE_CODE`.

### Brevo

- `ASSIGNMENT_EMAIL_PROVIDER=brevo`.
- `BREVO_API_KEY`.
- `BREVO_FROM_ADDRESS`.
- `BREVO_FROM_NAME`.
- `BREVO_REPLY_TO`.

### Cloudflare Email

- `CLOUDFLARE_EMAIL_ACCOUNT_ID`.
- `CLOUDFLARE_EMAIL_API_TOKEN`.
- `CLOUDFLARE_EMAIL_FROM_ADDRESS`.
- `CLOUDFLARE_EMAIL_FROM_NAME`.
- `CLOUDFLARE_EMAIL_REPLY_TO`.

### SMTP

- `EMAIL_HOST`.
- `EMAIL_PORT`.
- `EMAIL_HOST_USER`.
- `EMAIL_HOST_PASSWORD`.
- `EMAIL_USE_TLS`.
- `EMAIL_USE_SSL`.

### Frontend

- `NEXT_PUBLIC_API_URL`.
- البديل المدعوم: `NEXT_PUBLIC_API_BASE_URL`.

## 25. بروتوكولات وصيغ البيانات

- HTTPS بين المتصفح وخدمات النشر.
- REST فوق HTTP.
- JSON للطلبات والاستجابات العادية.
- `multipart/form-data` لرفع الصور.
- JWT للمصادقة الداخلية.
- Django signed tokens لجلسات بوابات OTP.
- PDF وXLSX للتقارير.
- WebP للصور المحسنة.
- WSGI لتشغيل Django على PythonAnywhere.
- Static HTML/CSS/JavaScript للواجهة المنشورة على Cloudflare Pages.

## 26. الاختبارات وضمان الجودة

الاختبارات الحالية: 31 اختبار Backend.

تغطي:

- صلاحيات المستخدمين.
- انتقالات حالات الطلب.
- تعيين المهندسين.
- رفض المهندس غير المتوفر.
- إشعارات SMTP وCloudflare وBrevo.
- تسجيل ودخول الشركة عبر OTP.
- دخول المهندس عبر OTP.
- عدم كشف رمز OTP.
- صلاحية الرمز لخمس دقائق.
- CORS لترويسة `X-Portal-Token`.
- تحديث توفر المهندس.
- تحديث حالات المهام والملاحظات.
- حذف وأرشفة الشركة.
- تقارير PDF وExcel.
- ضبط تكلفة الصيانة.

فحوص Frontend:

- `tsc --noEmit` مع `strict=true`.
- `next build`.
- Static generation لجميع الصفحات.

آخر نتيجة تحقق في 11 يونيو 2026:

- 31/31 اختبار Django ناجح.
- `python manage.py check` ناجح.
- `makemigrations --check --dry-run` دون تغييرات.
- `npm run typecheck` ناجح.
- `npm run build` ناجح.

## 27. حجم الكود الحالي

الأرقام تقريبية وتستبعد `node_modules` و`.next` و`venv`:

- Python: 32 ملفًا، نحو 5,602 سطر.
- TypeScript/TSX: 23 ملفًا، نحو 7,888 سطر.
- CSS: ملف رئيسي واحد، نحو 984 سطر.
- Migrations: من `0001` إلى `0010`.

## 28. مسار البناء والنشر

### Backend

```text
تعديل الكود
  -> Git commit
  -> Push إلى GitHub main
  -> git pull في PythonAnywhere
  -> تفعيل virtualenv
  -> pip install عند تغير requirements
  -> python manage.py migrate
  -> python manage.py check
  -> Reload لتطبيق Web
```

### Frontend

```text
Push إلى GitHub main
  -> Cloudflare Pages يكتشف التغيير
  -> npm install
  -> npm run build
  -> Static export إلى out/
  -> نشر pages.dev
```

## 29. نقاط القوة

- فصل واضح بين Frontend وBackend.
- نماذج مجال وقواعد انتقال داخل Django Model.
- دعم عربي RTL.
- صور WebP محسنة.
- تقارير PDF وExcel.
- بوابات مستقلة للشركات والمهندسين.
- عزل طلبات كل شركة ومهام كل مهندس.
- OTP لا يخزن بصورته الخام.
- دعم عدة مزودات بريد.
- اختبارات Backend تغطي المسارات الحساسة.
- نشر Static للواجهة يقلل حمل الخادم.

## 30. المخاطر والتحسينات المقترحة

### أولوية عالية

- نقل حماية لوحة العمليات من بيانات ثابتة داخل Frontend إلى JWT وصلاحيات Backend حقيقية.
- حماية مسارات `public/admin` باستخدام مصادقة وصلاحيات؛ اسم المسار لا يعد حماية.
- إلغاء أي API Key ظهر في سجل أو محادثة وإنشاء مفتاح بديل.
- إضافة Rate Limiting مركزي لطلبات OTP وواجهات التسجيل.
- إضافة سجل Audit Log موحد لعمليات الأدمن.

### أولوية متوسطة

- إضافة اختبارات Frontend باستخدام Playwright أو Vitest.
- إضافة GitHub Actions لتشغيل الاختبارات والبناء قبل النشر.
- نقل إرسال البريد إلى Queue عند زيادة الحمل.
- إضافة مراقبة أخطاء مثل Sentry.
- إضافة نسخ احتياطي مجدول لقاعدة MySQL والوسائط.
- إضافة سياسة تنظيف لتحديات OTP القديمة.

### أولوية مستقبلية

- WebSocket أو Server-Sent Events بدل Polling عند الحاجة لتحديث لحظي فعلي.
- Object Storage مثل Cloudflare R2 للصور بدل قرص PythonAnywhere.
- نطاق مخصص وبريد مرسل من نفس النطاق لتحسين قابلية تسليم البريد.
- فصل تطبيق Django إلى وحدات Domain أكبر عند توسع المشروع.

## 31. الخلاصة التقنية

المشروع تطبيق Full Stack بواجهة Next.js/React/TypeScript وخلفية Django/DRF وقاعدة MySQL. الواجهة تنشر كتطبيق Static على Cloudflare Pages، بينما يعمل Backend والوسائط على PythonAnywhere. النظام يدعم إدارة دورة صيانة كاملة، بوابات OTP للشركات والمهندسين، تعيينًا آليًا، إشعارات بريد، صورًا محسنة، وتقارير PDF وExcel.

النسخة الحالية مناسبة كنظام تشغيلي أولي، لكن الانتقال إلى استخدام تجاري واسع يتطلب قبل ذلك إغلاق مسارات الإدارة العامة ونقل دخول لوحة العمليات إلى مصادقة Backend كاملة.
