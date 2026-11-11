# ERP Schema Duplicate Arabic Labels & Field-Level Ambiguity Reference

## 1. Root Cause Observed (`StoreID` vs `SystemStore`)
In ERP screen metadata and runtime DOM scans (`form_schema`), two distinct technical controls on the same screen can share an identical normalized Arabic `label`:
- Example observed in `LMS_CO_Pilot/tests/golden/cases.json` (`syn_03` / screen `350`):
  - `StoreID` (`type: "dropdown"`, `section: "header"`, `label: "المخزن"`)
  - `SystemStore` (`type: "dropdown"`, `section: "grid"`, `label: "المخزن"`)

When an AI extractor or form mapper encounters duplicate Arabic labels without disambiguation, it can deterministically pick the wrong technical field (for example populating `SystemStore` instead of `StoreID`), breaking downstream persistence.

## 2. Frontend Distinction: Single-Control Echo vs True Schema Collision
Runtime `collectFormSchema()` on Angular ERP screens (for example `Purchases` screen `289`) can emit a label alias entry alongside the real technical control:
- **Pseudo-label echo (NOT ambiguous):** `{ key: "المخزن", label: "المخزن" }` paired with `{ key: "StoreID", label: "المخزن" }`. Here only one technical key (`StoreID`) differs from the normalized Arabic label.
- **True schema collision (`field_schema` ambiguous):** `{ key: "StoreID", label: "المخزن", group: "header" }` paired with `{ key: "SystemStore", label: "المخزن", group: "grid" }`. Both technical keys differ from the normalized Arabic label.

## 3. Resolution Policy Implemented (`detectDuplicateArabicFieldLabels`)
1. `detectDuplicateArabicFieldLabels(schema)` indexes fields by normalized Arabic label (`normalizeEntityForExact`) and flags any label mapped to `>= 2` distinct technical field keys as a `SchemaFieldAmbiguity`.
2. In `PurchasesEntityResolverService.resolveWave1()`, whenever an active extracted field targets an ambiguous label group and `resolvedSchemaFields[normLabel]` has not been explicitly chosen by the user:
   - The field is marked **`status: 'ambiguous'`** (`ambiguityKind: 'field_schema'`) with candidate field descriptors (`key`, `label`, `group`).
   - Schema collision detection checks `input.schema` keys directly (e.g. `StoreID` and `SystemStore` sharing `"المخزن"`), never relying on static field aliases.
   - Host lookup mutation is blocked until the user explicitly chooses which field (`StoreID` vs `SystemStore`) applies.

## 4. Negation Guard Behavior (`hasNegationMismatch`)
- Partial candidate matching checks standalone Arabic negation tokens (`غير`, `بدون`, `بلا`, `لا`, `عدم`) after normalization (`normalizeEntityForExact`).
- Any candidate whose negation polarity differs from the search term is excluded from partial matches in **both directions**:
  - Searching `"مباشرة"` excludes `"مشتريات غير مباشرة"`.
  - Searching `"غير مباشرة"` excludes `"مشتريات مباشرة"` while keeping `"مشتريات غير مباشرة"`.
- This prevents inverse selection when only the opposite option exists or when both appear as partial candidates.

## 5. Currency Synonyms Architecture (`PURCHASES_CURRENCY_SYNONYM_GROUPS`)
- Currency synonyms (`"مصري"` / `"جنيه"` <-> `'EGP'`, `"دولار"` <-> `'USD'` / `'دولار أمريكي'`) are maintained in a small closed static table inside [`purchases-wave1-registry.ts`](file:///e:/Mazen/DynamicProLearn/learn-dynamic-pro-ui/src/app/core/services/erp-automation/entity-resolver/purchases-wave1-registry.ts) rather than delegated solely to the backend Extractor, because the Extractor cannot inspect live `fetchLookupData('Currancy')` formatting in the host ERP.
- Safety invariant: if the host `Currancy` catalog contains multiple conflicting currencies matching partial tokens alongside a synonym (e.g. both `'دولار أمريكي'` and `'دولار كندي'`), the resolver reports **`ambiguous`** instead of auto-selecting.


