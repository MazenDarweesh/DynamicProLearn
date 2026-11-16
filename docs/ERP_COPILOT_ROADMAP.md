# ERP Copilot: Roadmap & Checklist (شاشة المشتريات 289)

**آخر تحديث:** 2026-11-16 | **حجم الحزمة الحالي:** `793.4 KB` (`183.59 KB` transfer) | **اختبارات ERP Copilot:** `104 / 104 SUCCESS`

---

## 0. القواعد الثابتة (تسري على كل خطوة)
- [ ] لا `git commit` ولا `git push` إلا بأمر صريح.
- [ ] لا اختبار حي ولا تعديل على الداتابيز ولا `devtunnel stop` إلا بإذن صريح.
- [ ] قبل أي كود: ملخص الفكرة، ثم موافقة، ثم الكود.
- [ ] KISS / YAGNI: لا تجريد جديد قبل وجود حالة ثانية فعلية تحتاجه.
- [ ] كل قرار عن موديل أو مفتاح يُبنى على دليل (كود أو داتابيز أو لوج)، لا على تخمين.

---

## 1. ما أُغلق رسمياً

### Wave 1
- [x] تطبيع الشاشة النشطة (`getActiveScreen`) — Commit `8a1db29`
- [x] منع الفتح المزدوج، وتنظيف الـ Observer — Commit `6ff871c`
- [x] عزل فلاتر القائمة (`*_gd`)
- [x] الانتقال البحت بدون `ERP_ACTION_GUIDE` — Commit `2af0876`
- [x] ميتاداتا 289 الاحتياطية (`CurrancyID`, `SafeAccounId`) — Backend Commit `52e6caa`

### Wave 2
- [x] `ProjectID` -> `ProductNonInventory` (`ProID`/`ProName`) — مؤكد من `ListSetups` و`133` سجل مشروعات فقط (`Modality = 4139`)
- [x] `SafeAccounId` -> `MonyAccount` (`AcID`/`AcName`) — مؤكد من `19` سجل و`purchases.component.html`
- [x] حذف المفاتيح البديلة (`altValueKeys` / `altTextKeys` — YAGNI)
- [x] ترتيب الملء الآمن: `POSetting -> CurrancyID -> SupplierID -> StoreID -> ProjectID -> SafeAccounId`
- [x] Commit `0370efc` (`DynamicProLearn`)

### Host Bridge & الأداء
- [x] `b651c2bb` (`Dynamicpro/FrontEnd`): توحيد `fallbackModels.SafeAccounId` + `item.AcID` + دعم `columnList`/`coulmnList` (هبوط زمن الخزينة من `~6.1s` إلى **`69ms`**)
- [x] `67ed4858` (`Dynamicpro/FrontEnd`): Lazy Load لحزمة `lms-copilot.bundle.js?v=2.5.0` عند أول نقرة فقط (`0ms` على إقلاع الـ ERP)
- [x] تحقق حي (`session_20261116_160534_ey2x.jsonl`, `trc_khmdm2`): حفظ `POID 13777` (`#241`), ملء كامل في **`565ms`**, `triggerAddNew` واحد

---

## 2. بنود إغلاق معلّقة (قبل Wave 3)
- [x] Commit تحسينات الأداء في `DynamicProLearn` (`3db48ba`: `angular.json` بدون `zone.js` مكرر، إزالة `Router`، `OnPush` في `CopilotHeaderComponent`، وتحديث `copilot-chat-v250-resolver.component.spec.ts`).
- [ ] التأكد أن الـ 13 فشلاً في مكونات LMS (`NullInjectorError: HttpClient`) موجودة قبل Wave 2، بتشغيلها على commit سابق، وتسجيلها كدَين معروف.
- [ ] تحديد موعد الـ `git push` (بأمر صريح فقط).

---

## 3. Wave 3: السداد النقدي (`POPaidCurrancy`)

### 3.0 اكتشاف (بدون كود)
- [x] هل يستخرج الـ extractor مبلغاً مدفوعاً أصلاً؟ (`POPaidCurrancy` غير موجود في `fields_ctx_json` لأن `collectFormSchema` يمسح `<ng-select>` فقط؛ أُضيف `paid_amount` + `paid_cash` على مستوى أعلى في `erp_action_extractor.py`).
- [x] هل `POPaidCurrancy` يُحسب أو يُصفَّر عند إضافة الأصناف؟ (لا يُصفّر؛ يُملأ بعد `addTableRow` حتى يكون `TotalOrder` محسوباً).
- [x] تأكيد أن `RemindCurrancy` يُعاد حسابه تلقائياً بعد تعيين `POPaidCurrancy` (مؤكد من `PurchaseRepository.cs` + `calculateSum()` في `purchases.component.ts`).

### 3.1 قواعد القرار (معتمدة)
- [x] مبلغ صريح (`"والمدفوع 200"`): `POPaidCurrancy = 200`.
- [x] **القاعدة 2: نقداً بلا مبلغ = `POPaidCurrancy` بإجمالي الفاتورة (سند صرف تلقائي). قرار: مازن، 16/11/2026.** (تُعرض في المعاينة بعبارة واضحة: `سيُسجَّل مدفوعاً بالكامل: X`).
- [x] لا ذكر للدفع: يبقى `0` وتُحفظ آجلة، ويُملأ `SafeAccounId` فقط إن ذُكرت خزينة.
- [x] المدفوع أكبر من الإجمالي: يتوقف التنفيذ برسالة واضحة (`partial_failure`)، ولا يُحفظ.
- [x] خزينة محددة والمدفوع `0`: تحذير في المعاينة (`"تم تحديد الخزينة لكن المبلغ المدفوع 0 — ستُحفظ الفاتورة آجلة."`)، بدون منع.

### 3.2 المكونات المتأثرة
- [x] Backend (`LMS_CO_Pilot`): `src/core/prompts.py` + `src/services/cognitive_search/search/erp_action_extractor.py` (`paid_amount` + `paid_cash`) + `tests/unit/test_extraction_prompts.py`.
- [x] Frontend (`DynamicProLearn`): `copilot.models.ts` + `copilot-chat.component.{ts,html}` + `purchases-v250-executor.service.{ts,spec.ts}`.

### 3.3 بوابات القبول
- [x] `pytest`: `22 passed` (تشمل: مبلغ صريح / نقداً بلا مبلغ / بلا ذكر / غير صالح).
- [x] Karma (ERP Copilot): `108 / 108 SUCCESS` (تشمل: مدفوع جزئي / نقداً كامل / أكبر من الإجمالي / خزينة بلا مدفوع).
- [x] `tsc` للإعدادين: `tsconfig.element.json` و`tsconfig.spec.json` -> Exit `0`.
- [x] `npm run build:element` ينجح، وحجم الحزمة `797.7 KB` (`< 800 KB`).
- [ ] اختبار حي بسيناريوهات (بإذنك): (أ) جزئي، (ب) نقداً بلا مبلغ، (ج) آجل بلا خزينة، (د) خزينة بلا مدفوع، (هـ) `"دفعت 200 جنيه"` الغامض، والتحقق في اللوج أن `RemindCurrancy = Total - paid` وأن `calculateSum()` تحدّث فعلاً بعد `setFieldValue`.

---

## 4. Wave 4: اكتشاف ما تبقى في شاشة 289
- [ ] جرد حقول الهيدر والأصناف في الميتاداتا مقابل ما هو مفعّل (قراءة فقط).
- [ ] تصنيفها بحسب الاستخدام الفعلي: (إلزامي / شائع / نادر).
- [ ] تفعيل حقل واحد في كل خطوة بنفس نمط Wave 2: دليل الموديل والمفاتيح أولاً، ثم `registry`، ثم اختبارات، ثم لوج.
- [ ] حقول الأصناف (كمية، سعر، خصم، وحدة، ضريبة): كل واحد على حدة، مع تحقق من أن إجمالي الصنف يطابق حساب الـ ERP.
- [ ] تحسين الغموض (`ambiguous` مثل `"خامات"`): عرض المرشحين للمستخدم للاختيار (يعمل حالياً، يُراجع فقط إن ظهر احتكاك).

---

## 5. Wave 5: شاشة ثانية (مثلاً المبيعات)
- [ ] ابدأها فقط بعد استقرار 289 واحتياج فعلي.
- [ ] لا تعمّم الـ `registry` مسبقاً؛ اجعل الشاشة الثانية تثبت أي جزء مشترك فعلياً (قاعدة الثلاث مرات).
- [ ] نفس بوابات التحقق، مع مراجعة أن فتح النموذج والـ observer لا يتأثران بشاشة أخرى.

---

## 6. بوابة التحقق الموحدة (لكل خطوة)

### 6.1 اختبارات وبناء
- [ ] `npx tsc -p tsconfig.element.json --noEmit` -> Exit `0`
- [ ] `npx tsc -p tsconfig.spec.json --noEmit` -> Exit `0`
- [ ] Karma لاختبارات ERP Copilot: لا تراجع في العدد (`>= 104`)، والكل ينجح
- [ ] `pytest` للباك إند: الكل ينجح
- [ ] `npm run build:element` + تحديث `public/lms-copilot.bundle.js` + تسجيل الحجم
- [ ] `git status` يظهر فقط الملفات المقصودة قبل أي `commit`

### 6.2 فحص اللوج الحي (`session_*.jsonl`)
- [ ] `triggerAddNew` مرة واحدة لكل فاتورة.
- [ ] ترتيب الاستدعاءات: `clearTableRows` -> حقول الهيدر بالترتيب الآمن -> الأصناف (-> المدفوع في Wave 3).
- [ ] كل `selectLookup` أقل من نحو `500ms`، وأي مهلة `6s` تُعد خللاً.
- [ ] كل حقل حُلّ من الموديل المتوقع، بدون استخدام `fallback`.
- [ ] الحالات الغامضة توقفت كـ `ambiguous` ولم تُخمَّن.
- [ ] القيم المحفوظة (`POID`, `Total`, `POPaidCurrancy`, `RemindCurrancy`, `ProjectID`, `SafeAccounId`) تطابق المتوقع.
- [ ] لا توكنز في الانتقال البحت، ولا `ERP_ACTION_GUIDE`.
- [ ] لا أخطاء أو تحذيرات `ignored-field` كاذبة.

### 6.3 قالب سجل النتيجة (يُنسخ لكل خطوة)
| البند | المتوقع | الفعلي (سطر اللوج) | ✅/❌ |
|---|---|---|---|

---

## 7. ديون معروفة (تُراجع كل Wave)
- [ ] 13 فشلاً في اختبارات مكونات LMS عامة (`NullInjectorError: HttpClient`)
- [ ] أي fallback في Host Bridge يخالف الـ registry (يُجرد دورياً)
- [ ] مراجعة حجم الحزمة قبل Wave 4 (الهدف: عدم تجاوز `800 KB`، الحالي `797.7 KB` — هامش `2.3 KB` فقط)
