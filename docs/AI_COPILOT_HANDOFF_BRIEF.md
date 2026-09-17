# 📡 وثيقة التنسيق والتسليم الفني المشترك مع محرك الذكاء الاصطناعي
## (LMS AI Co-Pilot Integration Handoff Brief)

> **موجهة إلى:** فريق تطوير محرك الذكاء الاصطناعي (`LMS_CO_Pilot` - Python / FastAPI / Qdrant)  
> **صادرة من:** فريق تطوير المنصة الأساسية (`DynamicProLearn` - .NET 10 Web API & Angular 19 UI)  
> **تاريخ الإصدار:** 16 سبتمبر 2026  
> **حالة الوثيقة:** معتمدة ونهائية للتكامل المتزامن (Canonical Handoff Standard)

---

## 🎯 الغرض من هذه الوثيقة
إحاطة فريق الذكاء الاصطناعي (Python Engine) بكافة التحديثات والتحسينات المعمارية التي تم بناؤها في مشروعي الـ **Backend (.NET)** والـ **Frontend (Angular)**، وتوضيح العقود الدقيقة (Contracts & Behaviors) المعتمدة للربط المشترك لضمان تشغيل خالي تماماً من الأخطاء (Zero Runtime Mismatch).

---

## 1️⃣ البنية المعمارية المعتمدة وخريطة المسارات

- **الرابط المعتمد لمحرك بايثون:** `http://localhost:8000`
- **البادئة الموحدة:** يعتمد تطبيق .NET و Angular مسارات `/v1/` رسمياً مع دعم بايثون الموازي لـ `/api/`.
- **نظام التوثيق:** توثيق موحد عبر `Authorization: Bearer <JWT_TOKEN>` مشفر وموقّع بنفس المفتاح السري `JWT_SECRET` وخوارزمية `HS256`.

---

## 2️⃣ الأمور التي تم إنجازها وتأكيدها في المنصة (.NET & Angular)

### أ. زر إعادة المحاولة وتجاوز الكاش (Retry with Cache Bypass) 🔄
- عند عدم رضا المستخدم عن الإجابة أو رغبته في إعادة التوليد، يضغط زر **🔄 إعادة المحاولة**.
- **البايلود المرسل من Angular إلى `POST /v1/search/stream`:**
  ```json
  {
    "query": "نص السؤال الأصلي",
    "lesson_id": "optional-uuid",
    "scope": "lesson",
    "skip_cache": true
  }
  ```
- **السلوك المتوقع من بايثون:**
  - تجاهل الـ Exact Cache (Tier-1).
  - تجاهل الـ Semantic Cache في Qdrant (Tier-2).
  - تنفيذ بحث دلالي كامل واستدعاء Gemini لتوليد إجابة حية جديدة تماماً.

### ب. تفريغ كاش الذكاء الاصطناعي للمشرفين (Flush All Caches) 🧹
- تم تفعيل مسار وكيل (Proxy) داخل .NET:
  ```http
  POST /api/Admin/ai/cache/clear
  Authorization: Bearer <ADMIN_JWT_TOKEN>
  ```
- يقوم .NET بالتحقق من صلاحية `AdminOnly` ثم يستدعي فوراً:
  ```http
  POST http://localhost:8000/v1/admin/cache/clear
  Authorization: Bearer <ADMIN_JWT_TOKEN>
  ```
- أُضيف في واجهة شات المشرفين زر خاص `🧹 تفريغ الكاش` مع إشعار بالنجاح أو الفشل.

### ج. تقييمات الطلاب والملاحظات (Feedback 👍 👎) 🎓
- تم ربط الشات بمسار `POST /v1/search/feedback`.
- عند ضغط 👎 يظهر Popover يتيح للطالب اختيار أسباب سريعة وكتابة تعليق نصي اختياري `comment`.
- تُرسل الحقول: `query`, `answer`, `rating` (`UP` أو `DOWN`), `comment`, `lesson_id`, `thread_id`.

### د. توليد الاختبارات والملخصات التلقائية (Quiz & Summary) 📝
- تم ربط أزرار توليد الكويز والملخص في محرر الدروس في Angular مع دوت نت، والتي تستدعي:
  - `POST /v1/admin/lessons/{lesson_id}/generate-quiz`
  - `POST /v1/admin/lessons/{lesson_id}/generate-summary`
- يقوم دوت نت باستلام كائن JSON وحفظه نهائياً في قاعدة بيانات SQL Server.

---

## 3️⃣ الأمور الهامة التي نحتاج إخطار فريق الذكاء الاصطناعي (بايثون) بها

### 📌 1. حارس الجاهزية (AI Readiness Guard)
- **ما تم في Angular:**
  - عند فتح نافذة الشات، تقوم الواجهة بفحص `GET http://localhost:8000/v1/ready`.
  - إذا أعاد بايثون `503 Service Unavailable` أو `ready: false`، يتم تعطيل حقل الإدخال وزر الإرسال تلقائياً، ويظهر شريط لطيف: *"جاري تهيئة محرك الذكاء الاصطناعي... ⏳"*، مع عمل Polling كل ثانيتين حتى يستجيب السيرفر بـ `200 OK` و `ready: true`.
- **المطلوب من بايثون:**
  - التأكد من ثبات مسار `GET /v1/ready` وإرجاعه لكائن الجاهزية القياسي:
    ```json
    { "status": "ready", "ready": true, "startup_duration_seconds": 3.8 }
    ```

---

### 📌 2. شارات مصدر الإجابة وزمن الاستجابة (Answer Provenance & Badges)
- **ما تم في Angular:**
  - واجهة الشات تستمع لحدث `done` في الـ SSE وتستخرج الحقول التالية لعرض شارة أسفل كل رسالة (⚡ استجابة فورية / 🧠 توليد ذكي):
    - `provenance`: (`EXACT_CACHE` / `SEMANTIC_CACHE` / `RAG_GENERATION` / `INTENT_ROUTER`)
    - `cache_hit`: (`true` / `false`)
    - `latency_ms` أو `metrics.total_latency_ms`: زمن المعالجة بالمللي ثانية.
- **المطلوب من بايثون:**
  - الحفاظ على هذه الحقول دائماً داخل بايلود حدث `done`:
    ```
    event: done
    data: {"provenance":"EXACT_CACHE","cache_hit":true,"latency_ms":2.1,"metrics":{"total_latency_ms":2.1}}
    ```

---

### 📌 3. التجديد الصامت للتوكنات (Silent Refresh Token Architecture)
- **ما تم في المنصة (.NET & Angular):**
  - تم بناء مسار `POST /api/Auth/refresh-token` في .NET.
  - واجهة Angular مزودة بـ Silent Refresh Interceptor؛ في حال انتهاء صلاحية الـ Access Token (ظهور خطأ 401)، تقوم الواجهة بتجديد التوكن في الخلفية صامتاً في أقل من 200ms، ثم تعيد إرسال الطلب الأصلي فوراً.
  - في الشات المباشر (SSE `fetch`): عند استلام `401 Unauthorized` من بايثون، يقوم الشات بتجديد التوكن صامتاً وإعادة محاولة البث مباشرة دون إظهار أي خطأ للطالب.
- **المطلوب من بايثون:**
  - **لا يتطلب أي تغيير في كود بايثون!** فقط الاستمرار في رمي `401 Unauthorized` القياسي عندما تنتهي صلاحية الـ Bearer Token القديم، وسيتكفل الفرونت إند بالتجديد الفوري التلقائي.

---

### 📌 4. تأمين بايلود الويب هوك بمفتاحين (Dual-Key Webhook Payload)
- **ما تم في .NET (`WebhookDispatcher.cs`):**
  - عند تعديل أو حذف أي درس، يرسل .NET إشعاراً فورياً لمسار:
    `POST http://localhost:8000/v1/webhooks/lesson-updated`
  - الترويسة: `X-Service-Token: default_service_token`
  - لضمان التوافق مع بايثون سواء كان يعتمد التسمية بـ SnakeCase أو CamelCase، قمنا بإرسال كلا المفتاحين معاً في البايلود:
    ```json
    {
      "lesson_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "lessonId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "action": "Updated" // أو "Deleted"
    }
    ```
- **المطلوب من بايثون:**
  - تأكيد معالجة هذا الحدث في الخلفية وتحديث / مسح نقاط Qdrant وإبطال كاش الدرس المعني.

---

### 📌 5. شاشة الشات العائمة الحرة (Draggable Floating Widget)
- أصبحت نافذة الشات قابلة للسحب الحر بالماوس على كامل مساحة الشاشة عبر مكتبة `@angular/cdk` (`cdkDrag`)، مع رفع أولوية الطبقة `z-index: 99999`، وإضافة زر مسح تاريخ المحادثة 🗑️ لتسهيل بدء جلسات جديدة أثناء الاختبار والتطوير.

---

## 📋 ملخص نقاط التنسيق والتحقق المشترك (Sign-off Checklist)

| الميزة | من طرف .NET / Angular | من طرف Python AI Co-Pilot |
|---|---|---|
| **جاهزية السيرفر** | Polling عند `503` وتفعيل الشات عند `200` | توفير `GET /v1/ready` بمعلومات النماذج |
| **شارة الـ Provenance** | عرض شارة ⚡ و 🧠 وزمن الاستجابة | إرسال `provenance` و `cache_hit` في `done` |
| **تجاوز الكاش** | إرسال `"skip_cache": true` عند الـ Retry | تجاوز الكاش واستدعاء LLM حياً |
| **تفريغ الكاش** | مسار `POST /api/Admin/ai/cache/clear` | تفريغ كاش الذاكرة وكاش Qdrant |
| **تزامن الدروس** | إرسال الويب هوك مع `lesson_id` و `lessonId` | استقبال الويب هوك وإبطال الكاش وتحديث النقاط |
| **جلسات المستخدمين** | تجديد صامت فوري للتوكنات عند الـ 401 | فحص الـ JWT وإرجاع 401 عند الانتهاء |
