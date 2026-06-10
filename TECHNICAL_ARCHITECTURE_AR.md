# التوثيق التقني لمنصة EngiFlow

آخر تحديث: 10 يونيو 2026

## 1. ملخص النظام

EngiFlow منصة لإدارة طلبات الصيانة المؤسسية. تتكون من:

- واجهة عامة لتسجيل الأعطال، تسجيل المهندسين، متابعة الطلبات، وإظهار المؤشرات.
- لوحة عمليات لإدارة الطلبات والمهندسين والشركات والتقارير.
- API خلفي يطبق قواعد سير العمل ويحفظ البيانات والصور.
- إشعارات بريد للمهندس عند تعيين طلب صيانة مع سجل نجاح وفشل وإعادة إرسال.
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
   - Cloudflare Email Sending REST API أو SMTP حسب متغيرات البيئة.
   - إرسال بعد نجاح معاملة قاعدة البيانات حتى لا يلغي تعطل البريد عملية التعيين.
   - سجل دائم لكل محاولة مع إعادة إرسال من Django Admin.

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

عدد الجداول الحالي: 17 جدولاً.

- 8 جداول مجال رئيسية خاصة بالمنصة.
- 9 جداول داخلية للمصادقة والصلاحيات والجلسات وDjango.

أضيف جدول مستقل لإشعارات تعيين المهندسين وتتبّع نتيجة الإرسال.

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
- `provider`: CLOUDFLARE أو SMTP أو DISABLED.
- `status`: PENDING أو SENT أو FAILED أو SKIPPED.
- `attempts`: عدد محاولات الإرسال.
- `provider_response`: استجابة مزود البريد بصيغة JSON.
- `error_message`: سبب الفشل أو التخطي.
- `sent_at`: وقت نجاح الإرسال.
- `created_at`, `updated_at`: وقت الإنشاء وآخر تحديث.

يمكن للأدمن تحديد السجلات الفاشلة من Django Admin واستخدام إجراء إعادة الإرسال.

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
- Tailwind CSS 3.4.17: التصميم.
- Framer Motion 12.40.0: الحركة والانتقالات.
- Lucide React 0.468.0: الأيقونات.
- React CountUp 6.5.3: تحريك الأرقام.
- Autoprefixer 10.5.0: توافق CSS.

## 10. التحديث الحي

النظام لا يستخدم WebSocket حالياً. يستخدم Polling محسناً:

- لوحة العمليات: تحديث صامت كل 27 ثانية.
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
- يحتاج تطبيق migration رقم `0008_assignmentnotification`.
- إعداد البريد يتم بمتغيرات البيئة ولا تحفظ مفاتيح API داخل المستودع.

### إعداد بريد التعيين

- `ASSIGNMENT_EMAIL_PROVIDER=cloudflare` لاستخدام Cloudflare Email Sending.
- يلزم نطاق إرسال مملوك ومفعّل في Cloudflare، مع Account ID وAPI Token.
- عنوان المرسل يجب أن يكون تحت النطاق المفعّل.
- يمكن استخدام `ASSIGNMENT_EMAIL_PROVIDER=smtp` كبديل.
- الوضع `auto` يختار Cloudflare عند اكتمال إعداداته، ثم SMTP، وإلا يسجل الإشعار SKIPPED.
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
- `maintenance/tests.py`: اختبارات Backend.
- `frontend/src/lib/api.ts`: عميل API.
- `frontend/src/lib/types.ts`: أنواع TypeScript.
- `frontend/src/lib/deviceIdentity.ts`: هوية الجهاز العشوائية.
- `frontend/src/components/PublicLanding.tsx`: الموقع العام.
- `frontend/src/components/PublicDashboard.tsx`: لوحة العمليات.
- `frontend/src/components/EngineerAvatar.tsx`: صورة المهندس وFallback.
- `frontend/src/components/ImageLightbox.tsx`: تكبير الصور.

## 15. ملاحظات أمنية

- لا يمكن لموقع ويب قراءة MAC Address.
- معرّف الجهاز الحالي عشوائي ومخزن محلياً ومشفّر كبصمة في الخادم.
- بوابة لوحة العمليات الحالية Client-side وليست حماية Backend كاملة.
- endpoints العامة للإدارة صممت ضمن النموذج الحالي المفتوح.
- قبل الاستخدام التجاري واسع النطاق يجب نقل إدارة الداشبورد إلى JWT حقيقي وصلاحيات Backend، وإضافة استعادة حساب عبر Email OTP.

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
