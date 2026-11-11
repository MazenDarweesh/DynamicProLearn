import { Injectable, inject } from '@angular/core';
import {
  ErpLookupOption,
  StrictLookupFetchStatus
} from '../../../models/erp-bridge.models';
import { FormFieldSchema } from '../../../models/erp-form.models';
import { ErpBridgeService } from '../erp-bridge.service';
import { ErpTelemetryService } from '../erp-telemetry.service';
import {
  convertEasternToWesternNumerals,
  normalizeArabicText
} from '../form-driver/arabic-normalizer';
import {
  PURCHASES_CURRENCY_SYNONYM_GROUPS,
  PURCHASES_SAFE_HEADER_ORDER,
  PURCHASES_WAVE1_LOOKUP_TABLE,
  PurchasesWave1HeaderField,
  extractRowItemQuery,
  extractWave1HeaderTerm,
  mapKeyToWave1HeaderField
} from './purchases-wave1-registry';

export type EntityMatchStatus =
  | 'resolved'
  | 'ambiguous'
  | 'not_found'
  | 'not_loaded'
  | 'invalid_row_schema'
  | 'unsupported'
  | 'error';

export type MatchTier = 'user_selected' | 'exact' | 'synonym' | 'starts_with' | 'contains' | 'none';

export interface EntityMatchOutcome {
  status: 'resolved' | 'ambiguous' | 'not_found';
  matchTier: MatchTier;
  resolvedOption?: ErpLookupOption;
  candidates: ErpLookupOption[];
  reason?: 'numeric_item_rejected' | 'duplicate_exact_match' | 'preselected_option_missing';
}

export interface SchemaFieldCandidate {
  key: string;
  label: string;
  group?: string;
}

export interface SchemaFieldAmbiguity {
  normLabel: string;
  label: string;
  candidates: SchemaFieldCandidate[];
}

export interface ResolvedFieldOutcome {
  field: PurchasesWave1HeaderField;
  labelAr: string;
  droModel: string;
  rawTerm: string;
  status: EntityMatchStatus;
  matchTier: MatchTier;
  resolvedId?: string | number;
  resolvedLabel?: string;
  candidates: ErpLookupOption[];
  ambiguityKind?: 'lookup_value' | 'field_schema';
  fieldCandidates?: SchemaFieldCandidate[];
  reason?: string;
}

export interface ResolvedRowItemOutcome {
  rowIndex: number;
  rawTerm: string;
  qty?: number;
  price?: number;
  droModel: string;
  status: EntityMatchStatus;
  matchTier: MatchTier;
  resolvedId?: string | number;
  resolvedLabel?: string;
  candidates: ErpLookupOption[];
  reason?: string;
}

export interface EntityResolutionIssue {
  scope: 'header' | 'row' | 'schema';
  fieldKey: string;
  labelAr: string;
  rawTerm: string;
  status: EntityMatchStatus;
  ambiguityKind?: 'lookup_value' | 'field_schema';
  candidates: ErpLookupOption[];
  fieldCandidates?: SchemaFieldCandidate[];
  rowIndex?: number;
  message: string;
}

export interface PurchasesResolveInput {
  fields?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  schema?: FormFieldSchema[];
  preselectedLookupIds?: Partial<Record<PurchasesWave1HeaderField, string | number>>;
  preselectedRowItemIds?: Record<number, string | number>;
  resolvedSchemaFields?: Record<string, string>;
  fetchOptions?: { maxEmptyRetries?: number; retryDelayMs?: number };
}

export interface PurchasesWave1ResolutionResult {
  readyToApply: boolean;
  headerResolutions: Partial<Record<PurchasesWave1HeaderField, ResolvedFieldOutcome>>;
  rowResolutions: ResolvedRowItemOutcome[];
  fieldAmbiguities: SchemaFieldAmbiguity[];
  ignoredNonWave1Fields: string[];
  blockingIssues: EntityResolutionIssue[];
  metricsSummary: {
    resolved: number;
    ambiguous: number;
    notFound: number;
    notLoadedOrError: number;
    fieldAmbiguous: number;
    itemResolved: number;
    itemAmbiguous: number;
    itemNotFound: number;
    itemAmbiguityRate: number;
  };
}

const NEGATION_TOKENS = new Set(['غير', 'بدون', 'بلا', 'لا', 'عدم']);
const PURE_NUMBER_REGEX = /^[+-]?\d+(?:[.,]\d+)?$/;

/**
 * Extended Arabic normalization for near-exact lookup equivalence ("التطابق شبه التام بعد التطبيع"):
 * removes invisible RTL/LTR bidi controls and collapses separator punctuation cleanly on top of
 * `normalizeArabicText`.
 */
export function normalizeEntityForExact(text: string): string {
  if (!text) return '';
  const cleaned = text
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .replace(/[،,;:/\\|_()[\]-]+/g, ' ');
  return normalizeArabicText(cleaned);
}

/**
 * Prevents quantities or pure numerals (`10`, `٢٠`, `5.5`) from matching item names or item codes.
 * Real item names containing letters alongside digits (`"سن 10"`) are allowed.
 */
export function isPureNumericItemTerm(rawTerm: unknown): boolean {
  if (rawTerm === null || rawTerm === undefined) return false;
  if (typeof rawTerm === 'number') return Number.isFinite(rawTerm);
  const converted = convertEasternToWesternNumerals(String(rawTerm)).trim();
  if (!converted) return false;
  return PURE_NUMBER_REGEX.test(converted);
}

/**
 * Prevents partial-match polarity inversion in both directions:
 * excludes candidates carrying a standalone Arabic negation particle (`غير`, `بدون`, `بلا`, `لا`, `عدم`)
 * unless the query shares that exact polarity (e.g. `"مباشرة"` vs `"مشتريات غير مباشرة"`).
 */
function hasNegationMismatch(termNorm: string, optionNorm: string): boolean {
  const termWords = new Set(termNorm.split(' ').filter(Boolean));
  const optWords = new Set(optionNorm.split(' ').filter(Boolean));
  for (const neg of NEGATION_TOKENS) {
    if (termWords.has(neg) !== optWords.has(neg)) {
      return true;
    }
  }
  return false;
}

/**
 * Core strict matcher:
 * - Unique normalized exact/near-exact match -> `resolved`
 * - Optional closed-set synonym group match (unique with zero competing partials) -> `resolved` (`synonym`)
 * - Duplicate exact matches -> `ambiguous`
 * - Items (`scope === 'row'`) reject pure numbers before matching, then rank `exact -> startsWith -> contains`
 * - ANY non-exact match (even a single partial candidate) -> `ambiguous` (requires user confirmation)
 * - Zero matches -> `not_found`
 */
export function matchLookupOptionsStrict(
  rawTerm: unknown,
  options: readonly ErpLookupOption[],
  opts: {
    scope: 'header' | 'row';
    preselectedId?: string | number;
    synonymGroups?: readonly (readonly string[])[];
  }
): EntityMatchOutcome {
  if (
    opts.preselectedId !== undefined &&
    opts.preselectedId !== null &&
    String(opts.preselectedId).trim() !== ''
  ) {
    const selected = options.find((o) => String(o.id) === String(opts.preselectedId));
    if (selected) {
      return {
        status: 'resolved',
        matchTier: 'user_selected',
        resolvedOption: selected,
        candidates: []
      };
    }
    return {
      status: 'not_found',
      matchTier: 'none',
      candidates: [],
      reason: 'preselected_option_missing'
    };
  }

  const termStr = rawTerm == null ? '' : String(rawTerm).trim();
  if (!termStr) {
    return { status: 'not_found', matchTier: 'none', candidates: [] };
  }

  if (opts.scope === 'row' && isPureNumericItemTerm(rawTerm)) {
    return {
      status: 'not_found',
      matchTier: 'none',
      candidates: [],
      reason: 'numeric_item_rejected'
    };
  }

  const termNorm = normalizeEntityForExact(termStr);
  if (!termNorm) {
    return { status: 'not_found', matchTier: 'none', candidates: [] };
  }

  const indexed = options.map((opt) => ({
    opt,
    norm: normalizeEntityForExact(opt.label)
  }));

  const exactMatches = indexed.filter((x) => x.norm === termNorm);
  if (exactMatches.length === 1) {
    return {
      status: 'resolved',
      matchTier: 'exact',
      resolvedOption: exactMatches[0].opt,
      candidates: []
    };
  }
  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      matchTier: 'exact',
      candidates: exactMatches.map((x) => x.opt),
      reason: 'duplicate_exact_match'
    };
  }

  const eligible = indexed.filter((x) => !hasNegationMismatch(termNorm, x.norm));

  const matchedSynonymGroup = opts.synonymGroups
    ?.map((group) => group.map((g) => normalizeEntityForExact(g)).filter(Boolean))
    .find((normGroup) => normGroup.includes(termNorm));

  const synonymMatches = matchedSynonymGroup
    ? eligible.filter((x) => matchedSynonymGroup.includes(x.norm))
    : [];
  const synonymIds = new Set(synonymMatches.map((x) => String(x.opt.id)));

  const startsWithMatches = eligible
    .filter((x) => !synonymIds.has(String(x.opt.id)) && x.norm.startsWith(termNorm))
    .sort((a, b) => a.norm.length - b.norm.length || a.opt.label.localeCompare(b.opt.label, 'ar'));

  const startsWithIds = new Set(startsWithMatches.map((x) => String(x.opt.id)));

  const termWords = termNorm.split(' ').filter(Boolean);
  const containsContiguous = eligible
    .filter((x) => !synonymIds.has(String(x.opt.id)) && !startsWithIds.has(String(x.opt.id)) && x.norm.includes(termNorm))
    .sort((a, b) => a.norm.length - b.norm.length || a.opt.label.localeCompare(b.opt.label, 'ar'));

  const containsContiguousIds = new Set(containsContiguous.map((x) => String(x.opt.id)));
  const containsAllWords =
    termWords.length >= 2
      ? eligible
          .filter(
            (x) =>
              !synonymIds.has(String(x.opt.id)) &&
              !startsWithIds.has(String(x.opt.id)) &&
              !containsContiguousIds.has(String(x.opt.id)) &&
              termWords.every((w) => x.norm.includes(w))
          )
          .sort((a, b) => a.norm.length - b.norm.length || a.opt.label.localeCompare(b.opt.label, 'ar'))
      : [];

  const otherPartials = [...startsWithMatches, ...containsContiguous, ...containsAllWords];

  if (synonymMatches.length === 1 && otherPartials.length === 0) {
    return {
      status: 'resolved',
      matchTier: 'synonym',
      resolvedOption: synonymMatches[0].opt,
      candidates: []
    };
  }

  const orderedCandidates = [...synonymMatches, ...otherPartials].map((x) => x.opt);

  if (orderedCandidates.length >= 1) {
    return {
      status: 'ambiguous',
      matchTier: synonymMatches.length > 0 ? 'synonym' : startsWithMatches.length > 0 ? 'starts_with' : 'contains',
      candidates: orderedCandidates
    };
  }

  return { status: 'not_found', matchTier: 'none', candidates: [] };
}

/**
 * Detects duplicate Arabic labels across distinct technical schema keys (e.g. `StoreID` in header
 * and `SystemStore` in grid both labeled `"المخزن"`). Single-control label echoes where one entry's
 * key equals the Arabic label itself (`{ key: 'المخزن' }` + `{ key: 'StoreID' }`) are filtered out.
 */
export function detectDuplicateArabicFieldLabels(schema: readonly FormFieldSchema[]): SchemaFieldAmbiguity[] {
  if (!Array.isArray(schema) || schema.length === 0) return [];

  const byLabel = new Map<string, { displayLabel: string; entries: SchemaFieldCandidate[] }>();

  for (const field of schema) {
    if (!field || !field.key) continue;
    const rawLabel = (field.label || '').trim();
    const normLabel = normalizeEntityForExact(rawLabel);
    if (!normLabel) continue;

    let bucket = byLabel.get(normLabel);
    if (!bucket) {
      bucket = { displayLabel: rawLabel, entries: [] };
      byLabel.set(normLabel, bucket);
    }

    const exists = bucket.entries.some(
      (e) => e.key.toLowerCase() === field.key.toLowerCase() && (e.group || '') === (field.group || '')
    );
    if (!exists) {
      bucket.entries.push({
        key: field.key,
        label: rawLabel,
        group: field.group
      });
    }
  }

  const ambiguities: SchemaFieldAmbiguity[] = [];
  for (const [normLabel, bucket] of byLabel.entries()) {
    const technicalEntries = bucket.entries.filter((e) => normalizeEntityForExact(e.key) !== normLabel);
    const effective = technicalEntries.length >= 2 ? technicalEntries : technicalEntries.length === 0 ? bucket.entries : [];

    const uniqueTechKeys = new Set(effective.map((e) => e.key.toLowerCase()));
    if (uniqueTechKeys.size >= 2) {
      ambiguities.push({
        normLabel,
        label: bucket.displayLabel,
        candidates: effective
      });
    }
  }

  return ambiguities;
}

function mapFetchFailureToStatus(status: StrictLookupFetchStatus): EntityMatchStatus {
  if (status === 'not_loaded') return 'not_loaded';
  if (status === 'invalid_row_schema') return 'invalid_row_schema';
  if (status === 'unsupported') return 'unsupported';
  if (status === 'empty') return 'not_found';
  return 'error';
}

@Injectable({
  providedIn: 'root'
})
export class PurchasesEntityResolverService {
  private bridge = inject(ErpBridgeService);
  private telemetry = inject(ErpTelemetryService, { optional: true });

  async resolveWave1(input: PurchasesResolveInput): Promise<PurchasesWave1ResolutionResult> {
    const headerResolutions: Partial<Record<PurchasesWave1HeaderField, ResolvedFieldOutcome>> = {};
    const rowResolutions: ResolvedRowItemOutcome[] = [];
    const blockingIssues: EntityResolutionIssue[] = [];
    const ignoredNonWave1Fields: string[] = [];

    const fieldAmbiguities = detectDuplicateArabicFieldLabels(input.schema || []);
    if (fieldAmbiguities.length > 0) {
      this.telemetry?.log(
        'SCAN',
        'Detected duplicate Arabic field labels in active schema',
        { ambiguities: fieldAmbiguities },
        'WARN'
      );
    }

    const inputFields = input.fields || {};
    const effectiveFields: Record<string, unknown> = { ...inputFields };
    const blockedFieldsBySchema = new Set<PurchasesWave1HeaderField>();
    const schemaCapturedKeys = new Set<string>();

    let resolvedCount = 0;
    let ambiguousCount = 0;
    let notFoundCount = 0;
    let notLoadedOrErrorCount = 0;
    let fieldAmbiguousCount = 0;

    // Schema-driven duplicate Arabic label collision check (NOT driven by field aliases)
    for (const amb of fieldAmbiguities) {
      const candidateKeySet = new Set(amb.candidates.map((c) => c.key.toLowerCase()));
      const matchedEntry = Object.entries(inputFields).find(([rawKey, val]) => {
        if (val == null || String(val).trim() === '') return false;
        const lower = rawKey.toLowerCase();
        return candidateKeySet.has(lower) || normalizeEntityForExact(rawKey) === amb.normLabel;
      });
      if (!matchedEntry) continue;

      const [matchedSourceKey, matchedVal] = matchedEntry;
      schemaCapturedKeys.add(matchedSourceKey.toLowerCase());
      const chosenSchemaKey = input.resolvedSchemaFields?.[amb.normLabel];

      if (!chosenSchemaKey) {
        fieldAmbiguousCount++;
        ambiguousCount++;

        const relatedWave1Field =
          mapKeyToWave1HeaderField(matchedSourceKey) ||
          amb.candidates.map((c) => mapKeyToWave1HeaderField(c.key)).find((f): f is PurchasesWave1HeaderField => !!f);

        if (relatedWave1Field) {
          blockedFieldsBySchema.add(relatedWave1Field);
          const spec = PURCHASES_WAVE1_LOOKUP_TABLE[relatedWave1Field];
          headerResolutions[relatedWave1Field] = {
            field: relatedWave1Field,
            labelAr: spec.labelAr,
            droModel: spec.droModel,
            rawTerm: String(matchedVal).trim(),
            status: 'ambiguous',
            matchTier: 'none',
            candidates: [],
            ambiguityKind: 'field_schema',
            fieldCandidates: amb.candidates,
            reason: 'duplicate_schema_label'
          };
        }

        blockingIssues.push({
          scope: 'schema',
          fieldKey: amb.normLabel,
          labelAr: amb.label,
          rawTerm: String(matchedVal).trim(),
          status: 'ambiguous',
          ambiguityKind: 'field_schema',
          candidates: [],
          fieldCandidates: amb.candidates,
          message: `الاسم "${amb.label}" مكرر لأكثر من حقل في الشاشة (${amb.candidates.map((c) => c.key).join(' / ')}). حدد الحقل المقصود.`
        });
      } else {
        // Carry mis-attributed sibling key value cleanly onto the user-selected technical field
        if (effectiveFields[chosenSchemaKey] == null) {
          effectiveFields[chosenSchemaKey] = matchedVal;
        }
      }
    }

    for (const rawKey of Object.keys(inputFields)) {
      if (
        inputFields[rawKey] != null &&
        !mapKeyToWave1HeaderField(rawKey) &&
        !schemaCapturedKeys.has(rawKey.toLowerCase())
      ) {
        ignoredNonWave1Fields.push(rawKey);
      }
    }

    // Resolve Wave 1 header fields in safe ERP order
    for (const field of PURCHASES_SAFE_HEADER_ORDER) {
      if (blockedFieldsBySchema.has(field)) continue;
      const spec = PURCHASES_WAVE1_LOOKUP_TABLE[field];
      const extracted = extractWave1HeaderTerm(effectiveFields, field);
      if (!extracted) continue;

      const fetchRes = await this.bridge.fetchLookupRowsStrict(spec, input.fetchOptions);
      if (fetchRes.status !== 'ok') {
        const mappedStatus = mapFetchFailureToStatus(fetchRes.status);
        if (mappedStatus === 'not_found') notFoundCount++;
        else notLoadedOrErrorCount++;

        const outcome: ResolvedFieldOutcome = {
          field,
          labelAr: spec.labelAr,
          droModel: spec.droModel,
          rawTerm: extracted.rawValue,
          status: mappedStatus,
          matchTier: 'none',
          candidates: [],
          reason: fetchRes.errorMessage || fetchRes.status
        };
        headerResolutions[field] = outcome;
        blockingIssues.push({
          scope: 'header',
          fieldKey: field,
          labelAr: spec.labelAr,
          rawTerm: extracted.rawValue,
          status: mappedStatus,
          candidates: [],
          message:
            mappedStatus === 'not_loaded'
              ? `قائمة "${spec.labelAr}" (${spec.droModel}) لم تكتمل تحميلها في النظام بعد.`
              : `تعذر جلب بيانات "${spec.labelAr}" (${spec.droModel}): ${fetchRes.status}`
        });
        continue;
      }

      const match = matchLookupOptionsStrict(extracted.rawValue, fetchRes.options, {
        scope: 'header',
        preselectedId: input.preselectedLookupIds?.[field],
        synonymGroups: field === 'CurrancyID' ? PURCHASES_CURRENCY_SYNONYM_GROUPS : undefined
      });

      const outcome: ResolvedFieldOutcome = {
        field,
        labelAr: spec.labelAr,
        droModel: spec.droModel,
        rawTerm: extracted.rawValue,
        status: match.status,
        matchTier: match.matchTier,
        resolvedId: match.resolvedOption?.id,
        resolvedLabel: match.resolvedOption?.label,
        candidates: match.candidates,
        ambiguityKind: match.status === 'ambiguous' ? 'lookup_value' : undefined,
        reason: match.reason
      };
      headerResolutions[field] = outcome;

      if (match.status === 'resolved') {
        resolvedCount++;
      } else if (match.status === 'ambiguous') {
        ambiguousCount++;
        blockingIssues.push({
          scope: 'header',
          fieldKey: field,
          labelAr: spec.labelAr,
          rawTerm: extracted.rawValue,
          status: 'ambiguous',
          ambiguityKind: 'lookup_value',
          candidates: match.candidates,
          message: `يوجد أكثر من مطابقة أو تطابق غير تام لحقل "${spec.labelAr}" ("${extracted.rawValue}").`
        });
      } else {
        notFoundCount++;
        blockingIssues.push({
          scope: 'header',
          fieldKey: field,
          labelAr: spec.labelAr,
          rawTerm: extracted.rawValue,
          status: 'not_found',
          candidates: [],
          message: `لم يتم العثور على "${extracted.rawValue}" في قائمة "${spec.labelAr}".`
        });
      }
    }

    // Resolve Wave 1 row items (`Product` -> ProID / ProName)
    let itemResolved = 0;
    let itemAmbiguous = 0;
    let itemNotFound = 0;

    const rows = input.rows || [];
    if (rows.length > 0) {
      const itemSpec = PURCHASES_WAVE1_LOOKUP_TABLE.ProductID;
      const productFetch = await this.bridge.fetchLookupRowsStrict(itemSpec, input.fetchOptions);

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const extractedRow = extractRowItemQuery(rows[rowIndex]);

        if (productFetch.status !== 'ok') {
          const mappedStatus = mapFetchFailureToStatus(productFetch.status);
          if (mappedStatus === 'not_found') {
            notFoundCount++;
            itemNotFound++;
          } else {
            notLoadedOrErrorCount++;
          }
          const rowOut: ResolvedRowItemOutcome = {
            rowIndex,
            rawTerm: extractedRow.rawTerm,
            qty: extractedRow.qty,
            price: extractedRow.price,
            droModel: itemSpec.droModel,
            status: mappedStatus,
            matchTier: 'none',
            candidates: [],
            reason: productFetch.errorMessage || productFetch.status
          };
          rowResolutions.push(rowOut);
          blockingIssues.push({
            scope: 'row',
            rowIndex,
            fieldKey: itemSpec.field,
            labelAr: `صنف سطر #${rowIndex + 1}`,
            rawTerm: extractedRow.rawTerm,
            status: mappedStatus,
            candidates: [],
            message:
              mappedStatus === 'not_loaded'
                ? `قائمة "${itemSpec.labelAr}" (${itemSpec.droModel}) لم تكتمل تحميلها في النظام بعد.`
                : `تعذر جلب قائمة الأصناف (${itemSpec.droModel}): ${productFetch.status}`
          });
          continue;
        }

        const match = matchLookupOptionsStrict(extractedRow.rawTerm, productFetch.options, {
          scope: 'row',
          preselectedId: input.preselectedRowItemIds?.[rowIndex]
        });

        const rowOut: ResolvedRowItemOutcome = {
          rowIndex,
          rawTerm: extractedRow.rawTerm,
          qty: extractedRow.qty,
          price: extractedRow.price,
          droModel: itemSpec.droModel,
          status: match.status,
          matchTier: match.matchTier,
          resolvedId: match.resolvedOption?.id,
          resolvedLabel: match.resolvedOption?.label,
          candidates: match.candidates,
          reason: match.reason
        };
        rowResolutions.push(rowOut);

        if (match.status === 'resolved') {
          resolvedCount++;
          itemResolved++;
        } else if (match.status === 'ambiguous') {
          ambiguousCount++;
          itemAmbiguous++;
          blockingIssues.push({
            scope: 'row',
            rowIndex,
            fieldKey: itemSpec.field,
            labelAr: `صنف سطر #${rowIndex + 1}`,
            rawTerm: extractedRow.rawTerm,
            status: 'ambiguous',
            ambiguityKind: 'lookup_value',
            candidates: match.candidates,
            message: `الصنف "${extractedRow.rawTerm}" في السطر #${rowIndex + 1} غير محسوم أو متعدد المرشحين.`
          });
        } else {
          notFoundCount++;
          itemNotFound++;
          blockingIssues.push({
            scope: 'row',
            rowIndex,
            fieldKey: itemSpec.field,
            labelAr: `صنف سطر #${rowIndex + 1}`,
            rawTerm: extractedRow.rawTerm,
            status: 'not_found',
            candidates: [],
            message:
              match.reason === 'numeric_item_rejected'
                ? `القيمة "${extractedRow.rawTerm}" رقمية وتشبه الكمية وليست اسم صنف.`
                : `الصنف "${extractedRow.rawTerm}" غير موجود في دليل الأصناف.`
          });
        }
      }
    }

    const totalItemsEvaluated = itemResolved + itemAmbiguous + itemNotFound;
    const itemAmbiguityRate =
      totalItemsEvaluated > 0 ? Number((itemAmbiguous / totalItemsEvaluated).toFixed(4)) : 0;

    return {
      readyToApply: blockingIssues.length === 0,
      headerResolutions,
      rowResolutions,
      fieldAmbiguities,
      ignoredNonWave1Fields,
      blockingIssues,
      metricsSummary: {
        resolved: resolvedCount,
        ambiguous: ambiguousCount,
        notFound: notFoundCount,
        notLoadedOrError: notLoadedOrErrorCount,
        fieldAmbiguous: fieldAmbiguousCount,
        itemResolved,
        itemAmbiguous,
        itemNotFound,
        itemAmbiguityRate
      }
    };
  }
}
