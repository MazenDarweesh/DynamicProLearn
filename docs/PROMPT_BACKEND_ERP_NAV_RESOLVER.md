# Prompt — انسخه كما هو للـ agent الشغال داخل مشروع `LMS_CO_Pilot` (FastAPI)

---

أنت تعمل داخل مشروع **LMS Co-Pilot** (FastAPI, Python, structlog, Gemini, Qdrant). المطلوب إضافة **endpointين** يدعمان مساعدًا ذكيًا داخل ERP اسمه DynamicPro (واجهة Angular). **اتبع نمط المشروع الحالي**: services singleton في `src/services/`، تسجيل في lifespan داخل `session.py`، logging بـ structlog، Pydantic models. ابحث عن routers/models/services الموجودة وأعد استخدامها (مثلاً LLM client وأي util لتطبيع العربية) ولا تكرر أي منطق. الـ routes الحالية بالشكل `/v1/...` (مثل `/v1/search/stream`) فاتبع نفس البادئة.

## القواعد
- لا commit/push. لا تثبّت dependencies جديدة بدون إبلاغي. لا أسرار hardcoded (config/env فقط).
- لا `except: pass`؛ سجّل الخطأ بـ structlog أو ارفع exception typed.
- YAGNI: لا abstractions زائدة. DRY: أعد استخدام الموجود.
- اكتب unit tests (pytest) وشغّلها + type-check/lint المتاح في المشروع. في الآخر أعطني ملخص ملفات معدّلة + أمثلة JSON.

## Endpoint 1 — `POST /v1/erp/navigation/resolve`
**الغرض:** المستخدم يكتب طلبًا (قد يكون غامضًا)، والواجهة ترسل قائمة الشاشات المرئية حاليًا؛ السيرفر يرتّبها ويقرر.

Request:
```json
{
  "user_message": "عايز اسجل فاتورة من المورد",
  "candidates": [
    {"id": "c1", "label": "الموردين و المشتريات", "path": ["الرئيسية"]},
    {"id": "c2", "label": "العملاء و المبيعات", "path": ["الرئيسية"]}
  ],
  "current_path": []
}
```
Response:
```json
{
  "decision": "go",
  "candidates": [
    {"id": "c1", "confidence": 0.91, "reason": "ذكر المورد والفاتورة"},
    {"id": "c2", "confidence": 0.12, "reason": "..."}
  ]
}
```
**منطق القرار (على السيرفر فقط، والقيم في settings قابلة للتهيئة):**
- `GO_THRESHOLD = 0.80`, `GAP_THRESHOLD = 0.25`, `CLARIFY_THRESHOLD = 0.30`.
- `decision = "go"` إذا top1 ≥ 0.80 **و** (top1 − top2) ≥ 0.25.
- `decision = "clarify"` إذا top1 < 0.30 (الواجهة ستسأل سؤالًا نصيًا).
- غير ذلك `decision = "ask"` ويرجع **أعلى 3** مرتبة تنازليًا.
- ترتيب: lexical prefilter (تطبيع عربي: إزالة التشكيل، أ/إ/آ→ا، ة→ه، ى→ي) ثم LLM rerank بـ structured JSON output.
- **Validation صارمة:** كل `id` في الرد ∈ `candidates` المُدخلة (امنع الهلوسة)، واقتطع القائمة لـ 3، واجعل confidence في [0,1].
- حدود: `candidates` ≤ 60 عنصرًا، `user_message` ≤ 500 حرف (422 عند التجاوز). نظّف النص ولا تسجّل رسالة المستخدم كاملة في اللوج.
- LLM timeout/فشل → fallback للـ lexical score فقط (لا 500)، وسجّل التحذير.

## Endpoint 2 — `POST /v1/erp/form-fill/resolve-leftover`
**الغرض:** بعد اختيار حقل في فورم الـ ERP تظهر حقول جديدة؛ نريد ملأها من البيانات التي استخرجها الـ AI سابقًا.

Request:
```json
{
  "user_message": "...",
  "extracted_data": {"supplier": "شركة التوحيد", "payment_method": "نقدي", "notes": "تسليم الأحد"},
  "filled": {"Supplier": "شركة التوحيد"},
  "new_fields": [
    {"key": "PaymentMethod", "label": "طريقة الدفع", "kind": "ng-select", "options": ["نقدي", "آجل"], "disabled": false},
    {"key": "Notes", "label": "ملاحظات", "kind": "text", "disabled": false}
  ]
}
```
Response:
```json
{"fields": {"PaymentMethod": "نقدي", "Notes": "تسليم الأحد"}, "ask_user": []}
```
**قواعد:**
- المفاتيح في `fields` و `ask_user` ⊆ مفاتيح `new_fields` فقط. تجاهل حقول `disabled`.
- إن كان للحقل `options` يجب أن تكون القيمة المختارة واحدة منها حرفيًا؛ وإلا ضعه في `ask_user`.
- لا تخترع قيمًا غير موجودة في `extracted_data`/الرسالة؛ الغامض → `ask_user`.
- `new_fields` ≤ 40.

## Models (Pydantic) — نفس الأسماء بالضبط (مطابقة لـ TypeScript في الواجهة)
`NavCandidateIn{id,label,path}`, `NavRequest`, `NavScored{id,confidence,reason}`, `NavResolution{decision: Literal['go','ask','clarify'], candidates}`, `FieldSignatureIn{key,label,kind,disabled,options?}`, `LeftoverRequest`, `LeftoverResponse`.

## Tests المطلوبة
1. طلب واضح → `go`. 2. طلب غامض بين شاشتين → `ask` بـ 3 كحد أقصى مرتبة. 3. هراء → `clarify`. 4. LLM يرجع id غير موجود → يُتجاهل. 5. LLM فشل → fallback بدون 500. 6. leftover: option غير موجودة → `ask_user`. 7. حقل disabled لا يُملأ. 8. تجاوز الحدود → 422.

عند الانتهاء: اعرض الملفات المعدّلة، وقائمة الـ routes الجديدة، ونتيجة الاختبارات، وأمثلة curl.
