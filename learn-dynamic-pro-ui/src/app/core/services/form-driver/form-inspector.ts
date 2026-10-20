import {
  FormFieldSchema,
  FieldKind,
  FieldGroup,
} from '../../models/erp-form.models';
import { getActiveFormRoot } from './dom-synchronizer';

/**
 * Compares two form schemas to identify newly revealed or newly enabled fields.
 */
export function diffSchemas(
  before: FormFieldSchema[],
  after: FormFieldSchema[]
): { newlyAppeared: FormFieldSchema[]; newlyEnabled: FormFieldSchema[] } {
  const beforeMap = new Map(before.map((f) => [f.key, f]));
  const newlyAppeared: FormFieldSchema[] = [];
  const newlyEnabled: FormFieldSchema[] = [];

  for (const field of after) {
    const prev = beforeMap.get(field.key);
    if (!prev) {
      newlyAppeared.push(field);
    } else if (prev.disabled && !field.disabled) {
      newlyEnabled.push(field);
    }
  }

  return { newlyAppeared, newlyEnabled };
}

/**
 * Converts rich FormFieldSchema into legacy visible_fields descriptors
 * for backward compatibility with existing RAG models.
 * e.g. "SupplierName (المورد)"
 */
export function buildVisibleFieldsSummary(schemas: FormFieldSchema[]): string[] {
  const list: string[] = [];
  for (const s of schemas) {
    if (s.disabled) continue; // Exclude disabled fields from AI extraction prompts!

    const keyPart = s.key.trim();
    const labelPart = s.label.trim();
    if (labelPart && labelPart !== keyPart) {
      list.push(`${keyPart} (${labelPart})`);
    } else {
      list.push(keyPart);
    }
  }
  return Array.from(new Set(list));
}

/**
 * Resolves the label text for an input or host element using accessible label heuristics.
 */
export function findLabelForElement(el: HTMLElement): string {
  // 1. Explicit <label for="element_id">
  if (el.id) {
    try {
      const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (explicitLabel && explicitLabel.textContent) {
        const text = explicitLabel.textContent.trim().replace(/[:*]/g, '').trim();
        if (text) return text;
      }
    } catch {
      // ignore selector syntax errors
    }
  }

  // 2. aria-label or aria-labelledby
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim().replace(/[:*]/g, '').trim();
  }
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const refEl = document.getElementById(labelledBy);
    if (refEl && refEl.textContent) {
      const text = refEl.textContent.trim().replace(/[:*]/g, '').trim();
      if (text) return text;
    }
  }

  // 3. Closest parent form-group or column container (STRICT: exclude .row to avoid pulling sibling field labels)
  const parentGroup = el.closest(
    '.form-group, .field-wrapper, .form-field, mat-form-field, [class*="col-"], label'
  );
  if (parentGroup) {
    const labelEl =
      parentGroup.tagName === 'LABEL'
        ? (parentGroup as HTMLElement)
        : (parentGroup.querySelector('label, mat-label') as HTMLElement);
    if (labelEl && labelEl !== el && labelEl.textContent) {
      const text = labelEl.textContent.trim().replace(/[:*]/g, '').trim();
      if (text) return text;
    }
  }

  // 4. Table cell -> Match corresponding <th> / columnheader by column index
  const cell = el.closest('td, mat-cell, [role="gridcell"]');
  if (cell) {
    const row = cell.closest('tr, mat-row, [role="row"]');
    const table = cell.closest('table, mat-table, ag-grid, [role="grid"]');
    if (row && table) {
      const cells = Array.from(row.children);
      const colIndex = cells.indexOf(cell);
      if (colIndex >= 0) {
        const headers = Array.from(
          table.querySelectorAll('thead th, mat-header-cell, [role="columnheader"]')
        ) as HTMLElement[];
        if (headers[colIndex] && headers[colIndex].textContent) {
          const thText = headers[colIndex].textContent.trim().replace(/[:*]/g, '').trim();
          if (thText) return thText;
        }
      }
    }
  }

  // 5. Fallback to placeholder or title
  const placeholder = el.getAttribute('placeholder') || el.getAttribute('title');
  if (placeholder && placeholder.trim()) {
    return placeholder.trim().replace(/[:*]/g, '').trim();
  }

  return '';
}

/**
 * Determines whether a field belongs to header, grid, or footer.
 */
export function determineFieldGroup(el: HTMLElement): FieldGroup {
  if (el.closest('table, tbody, thead, mat-table, ag-grid')) return 'grid';
  if (el.closest('.footer, .invoice-footer, .totals-section, .actions-bar')) return 'footer';
  return 'header';
}

/**
 * Checks whether an element is disabled or readonly.
 */
export function isElementDisabled(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.disabled || el.readOnly;
  }
  if (el instanceof HTMLSelectElement) {
    return el.disabled;
  }
  return el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
}

/**
 * Scans the host ERP DOM to collect a rich schema of form fields,
 * categorizing them into Header, Grid, and Footer, and identifying
 * ng-select, native selects, checkboxes, and disabled auto-fill fields.
 */
export function collectFormSchema(
  excludeContainer?: HTMLElement,
  telemetry?: any
): FormFieldSchema[] {
  if (typeof document === 'undefined') return [];
  try {
    const schemas: FormFieldSchema[] = [];
    const seenKeys = new Set<string>();

    const formRoot = getActiveFormRoot();

    // 1. Gather custom dropdown hosts (e.g. <eg-select>, <ng-select>, <mat-select>)
    const customSelectHosts = Array.from(
      formRoot.querySelectorAll('eg-select, ng-select, mat-select')
    ) as HTMLElement[];

    for (const host of customSelectHosts) {
      if (excludeContainer && excludeContainer.contains(host)) continue;

      const tagName = host.tagName.toLowerCase();
      const isNgSelect = tagName === 'eg-select' || tagName === 'ng-select';
      const isMatSelect = tagName === 'mat-select';

      const rawName =
        host.getAttribute('name') ||
        host.getAttribute('formcontrolname') ||
        host.id ||
        host.getAttribute('data-field') ||
        '';
      const cleanName = rawName.replace(/^['"]|['"]$/g, '').trim();

      const labelText = findLabelForElement(host);
      const key = cleanName || (labelText ? `select_${labelText}` : 'custom_select');

      const kind: FieldKind = isNgSelect ? 'ng-select' : isMatSelect ? 'mat-select' : 'select';
      const group: FieldGroup = determineFieldGroup(host);
      const disabled = host.classList.contains('disabled') || host.getAttribute('aria-disabled') === 'true';

      const descriptorKey = `${key}__${labelText}`;
      if (!seenKeys.has(descriptorKey)) {
        seenKeys.add(descriptorKey);
        schemas.push({
          key: cleanName || labelText || key,
          label: labelText,
          kind,
          group,
          disabled,
          required: host.getAttribute('aria-required') === 'true',
        });
      }
    }

    // 2. Gather standard input, select, textarea elements
    const inputs = Array.from(
      formRoot.querySelectorAll('input, select, textarea')
    ) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];

    for (const el of inputs) {
      if (excludeContainer && excludeContainer.contains(el)) continue;

      // Skip internal combobox inputs of already captured ng-select/mat-select hosts
      if (el.closest('ng-select, eg-select, mat-select')) continue;
      if (el.type === 'hidden') continue;

      // Skip table pagination, master-list internal search bar, and numeric row checkboxes
      if (el.closest('.dp-table__pagination, app-master-list-switch, .dataTables_paginate')) continue;

      const rawName =
        el.getAttribute('name') ||
        el.getAttribute('formcontrolname') ||
        el.id ||
        el.getAttribute('placeholder') ||
        '';
      const cleanName = rawName.replace(/^['"]|['"]$/g, '').trim();

      // Filter out non-business pagination/limits controls
      if (/^(dpCheckAll|pageSeachValue|dpLimit)$/i.test(cleanName)) continue;

      const labelText = findLabelForElement(el);

      // If cleanName is purely digits (e.g. table row index), prefer labelText as key if available
      let key = cleanName;
      if (/^\d+$/.test(cleanName) || !cleanName) {
        key = labelText ? `field_${labelText}` : cleanName;
      }
      if (!key) continue;

      const tagName = el.tagName.toLowerCase();
      let kind: FieldKind = 'text';
      if (tagName === 'select') {
        kind = 'select';
      } else if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox') kind = 'checkbox';
        else if (el.type === 'number') kind = 'number';
        else if (el.type === 'date' || el.type === 'datetime-local') kind = 'date';
      }

      const group: FieldGroup = determineFieldGroup(el);
      const descriptorKey = `${key}__${labelText}`;

      if (!seenKeys.has(descriptorKey)) {
        seenKeys.add(descriptorKey);
        schemas.push({
          key: cleanName || key,
          label: labelText,
          kind,
          group,
          disabled: el.disabled,
          readonly: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.readOnly : false,
          required: el.required,
          placeholder: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : '',
        });
      }
    }

    telemetry?.logScan(schemas, 'collectFormSchema');
    return schemas;
  } catch (err) {
    console.warn('[FormInspector] Failed to collect form schema:', err);
    telemetry?.logError('SCAN', 'Failed to collect form schema', err);
    return [];
  }
}
