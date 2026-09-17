# 📡 وثيقة التكامل الفني والتسليم لمحرك الذكاء الاصطناعي
# LMS AI Co-Pilot Top Filter Bar Integration & Handoff Spec

- **المشروع المصدر:** `DynamicProLearn` (.NET 10 Web API & Angular 19 UI)
- **المشروع المستلم:** `LMS_CO_Pilot` (Python / FastAPI / Qdrant)
- **الحالة:** تم اكتمال التنفيذ في المنصة الأساسية وجاهز للتكامل (Ready for AI Engine Integration)

---

## 🎯 1. نظرة عامة (Overview)

تم بنجاح بناء وتفعيل **شريط الفلاتر الذكي (Top Filter Bar)** في واجهة محادثة الطالب مع المساعد الذكي `LMS AI Co-Pilot`.
يتيح هذا الشريط للطالب تحديد وحصر نطاق البحث وتوليد الإجابات عبر 4 نطاقات رئيسية:
1. `🌐 كامل المحتوى (all)`
2. `📚 موديول محدد (module)`
3. `📑 وحدة محددة (unit)`
4. `🎯 درس محدد (lesson)`

بالإضافة إلى فلاتر فرعية إضافية حسب:
- **المستوى (Level):** مبتدئ / متوسط / متقدم ... إلخ.
- **نوع المحتوى (Type):** فيديو 🎬 / مستند PDF 📄 / عملي ⚙️.

---

## 🔌 2. العقد الشبكي المرسل إلى محرك البحث (HTTP Request Contract)

يتم إرسال الطلب عبر Server-Sent Events (SSE) إلى نقطة النهاية:
`POST http://localhost:8000/v1/search/stream`

### 📦 جسم الطلب (JSON Request Payload):
يدعم النظام كلاً من `camelCase` و `snake_case` لضمان التوافق التام:

```json
{
  "query": "ما هي خطوات إنشاء أمر تشغيل في موديول الإنتاج؟",
  "scope": "module",
  "moduleId": "b53f6081-305f-4613-a4e9-11440d463ef1",
  "module_id": "b53f6081-305f-4613-a4e9-11440d463ef1",
  "unitId": null,
  "unit_id": null,
  "lessonId": null,
  "lesson_id": null,
  "levelId": "1c55208f-2f74-4b53-906d-7419f4476ce2",
  "level_id": "1c55208f-2f74-4b53-906d-7419f4476ce2",
  "typeId": null,
  "type_id": null,
  "threadId": "conv-987654",
  "thread_id": "conv-987654",
  "skipCache": false,
  "skip_cache": false
}
```

### 📋 قيم الحقول وأنواعها:
| الحقل (Field) | النوع (Type) | إجباري؟ | الوصف |
| :--- | :--- | :--- | :--- |
| `query` | `string` | نعم | نص السؤال المطروح من الطالب |
| `scope` | `string` | نعم | أحد القيم: `'all'`, `'module'`, `'unit'`, `'lesson'` |
| `moduleId` / `module_id` | `UUID / string` | نعم إذا كان `scope` هو `'module'` أو `'unit'` أو `'lesson'` | معرف الموديول المختار |
| `unitId` / `unit_id` | `UUID / string` | نعم إذا كان `scope` هو `'unit'` أو `'lesson'` | معرف الوحدة المختارة |
| `lessonId` / `lesson_id` | `UUID / string` | نعم إذا كان `scope` هو `'lesson'` | معرف الدرس المختار |
| `levelId` / `level_id` | `UUID / string` | اختياري | فلتر المستوى التعليمي (مبتدئ / متوسط / متقدم) |
| `typeId` / `type_id` | `UUID / string` | اختياري | فلتر نوع المحتوى (فيديو / PDF / إلخ) |
| `threadId` / `thread_id` | `string` | اختياري | معرف جلسة المحادثة المتسلسلة |
| `skipCache` / `skip_cache` | `boolean` | اختياري (افتراضي `false`) | تجاوز الكاش الدلالي وتوليد إجابة جديدة |

---

## 🐍 3. التعديلات المطلوبة في مشروع بايثون (`LMS_CO_Pilot`)

### أ. تحديث نموذج Pydantic للطلب (`schemas.py` أو `search_schemas.py`):
```python
from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID

class SearchStreamRequest(BaseModel):
    query: str
    scope: Literal["all", "module", "unit", "lesson"] = "all"
    module_id: Optional[str] = Field(None, alias="moduleId")
    unit_id: Optional[str] = Field(None, alias="unitId")
    lesson_id: Optional[str] = Field(None, alias="lessonId")
    level_id: Optional[str] = Field(None, alias="levelId")
    type_id: Optional[str] = Field(None, alias="typeId")
    thread_id: Optional[str] = Field(None, alias="threadId")
    skip_cache: bool = Field(False, alias="skipCache")

    class Config:
        populate_by_name = True
```

### ب. تطبيق شروط التصفية في استعلام Qdrant (`qdrant_service.py` أو `search_service.py`):
```python
from qdrant_client.http import models

def build_qdrant_filter(req: SearchStreamRequest) -> models.Filter:
    must_conditions = []

    # 1. Scope Filtering
    if req.scope == "lesson" and req.lesson_id:
        must_conditions.append(
            models.FieldCondition(key="lesson_id", match=models.MatchValue(value=str(req.lesson_id)))
        )
    elif req.scope == "unit" and req.unit_id:
        must_conditions.append(
            models.FieldCondition(key="unit_id", match=models.MatchValue(value=str(req.unit_id)))
        )
    elif req.scope == "module" and req.module_id:
        must_conditions.append(
            models.FieldCondition(key="module_id", match=models.MatchValue(value=str(req.module_id)))
        )

    # 2. Metadata Filtering (Level & Type)
    if req.level_id:
        must_conditions.append(
            models.FieldCondition(key="level_id", match=models.MatchValue(value=str(req.level_id)))
        )
    if req.type_id:
        must_conditions.append(
            models.FieldCondition(key="type_id", match=models.MatchValue(value=str(req.type_id)))
        )

    return models.Filter(must=must_conditions) if must_conditions else None
```

---

## 🔒 4. الضمانات الأمنية وصلاحيات الوصول (Security & RBAC)

1. تم تأمين نقطة النهاية `GET /api/student/copilot-filters` في `.NET 10`:
   - ترجع **فقط** الموديولات والوحدات والدروس المصرح بها لقسم الطالب الحالي.
   - لا يمكن للطالب عبر الواجهة اختيار أي محتوى خارج صلاحياته.
2. عند استقبال الطلب في بايثون عبر توكن JWT، يمكن التحقق من هوية الطالب وقسمه كطبقة حماية إضافية (Defense in Depth).

---

## 🚀 5. حالة الجاهزية (Status & Deliverables)

- [x] **Backend API:** جاهز ويعمل بـ 0 أخطاء و 0 تحذيرات (`dotnet build src/LearnDynamicPro.API`).
- [x] **Frontend UI:** شريط الفلاتر مدمج ومفعل بالكامل مع التصميم الزجاجي، القوائم المتتالية، شرائح الفلاتر، والالتقاط التلقائي للدرس النشط (`ng build` Succeeded).
- [x] **Contract:** موحد ومتوافق مع `FastAPI` و `Qdrant`.
