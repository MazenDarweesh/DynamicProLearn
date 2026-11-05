import { FormFillResult, ControlIn, GridFillOptions } from '../../../models/erp-form.models';
import { normalizeArabicText, matchesColKey } from './arabic-normalizer';
import { getActiveFormRoot, waitFor, settle } from './dom-synchronizer';
import {
  setNgSelect,
  setNativeSelect,
  setTextOrDate,
  readCalculatedTotal,
} from './control-interactor';

export type { GridFillOptions };

/**
 * Checks whether a table row is a genuine editable item row (not a filter/template/empty row).
 */
export function isGenuineItemRow(r: HTMLElement): boolean {
  if (r.closest('thead, tfoot')) return false;
  if (r.querySelector('th, [role="columnheader"]')) return false;

  const className = (r.className || '').toLowerCase();
  if (
    className.includes('filter') ||
    className.includes('p-filter-row') ||
    className.includes('no-data') ||
    className.includes('empty') ||
    className.includes('template') ||
    className.includes('dub') ||
    className.includes('dp-pd') ||
    r.closest('.dp-pd') ||
    r.querySelector('.dp-pd, .dp-pd__inner, .dp-pd__pick, .dp-pd__pull, [title*="pullProducts" i], .dp-pd__ttl') ||
    r.querySelector('ng-select#product, eg-select#product, [id="product"]') ||
    r.querySelector('.no-data-msg, .dataTables_empty')
  ) {
    return false;
  }

  // Exclude template or duplicate rows where all dropdowns are 'Dub'
  const selects = Array.from(r.querySelectorAll('eg-select, ng-select, mat-select')) as HTMLElement[];
  if (selects.length > 0) {
    const onlyDub = selects.every((s) => {
      const name = (s.getAttribute('name') || s.getAttribute('formcontrolname') || s.id || '').toLowerCase();
      const label = (s.getAttribute('aria-label') || s.getAttribute('title') || '').toLowerCase();
      return name.includes('dub') || label.includes('dub');
    });
    if (onlyDub) return false;

    // Disqualify if all selects belong to header product-picker toolbar (e.g. id="product" or inside .dp-pd)
    const onlyHeaderProductPicker = selects.every((s) => s.id === 'product' || !!s.closest('.dp-pd'));
    if (onlyHeaderProductPicker) return false;

    return true;
  }

  const inputs = Array.from(
    r.querySelectorAll('input:not([type="hidden"]), select')
  ) as (HTMLInputElement | HTMLSelectElement)[];
  const editableInputs = inputs.filter((inp) => !inp.disabled && !(inp instanceof HTMLInputElement && inp.readOnly));
  return editableInputs.length >= 2;
}

/**
 * Returns all genuine editable rows in an ERP items table.
 */
export function getGenuineRows(table: HTMLElement): HTMLElement[] {
  const rowsInTbody = Array.from(table.querySelectorAll('tbody > tr, mat-row')) as HTMLElement[];
  const candidates =
    rowsInTbody.length > 0
      ? rowsInTbody
      : (Array.from(table.querySelectorAll('tr, mat-row, [role="row"]')) as HTMLElement[]).filter(
          (r) => !r.closest('thead, tfoot')
        );
  return candidates.filter(isGenuineItemRow);
}

/**
 * Resolves the "+ Add Row" button near the grid structurally, with AI fallback if needed.
 */
export async function findAddRowButton(
  table: HTMLElement,
  excludeContainer?: HTMLElement,
  telemetry?: any,
  copilotService?: any
): Promise<HTMLElement | null> {
  // 1. Gather candidates scoped strictly near the table first
  const localCandidates: HTMLElement[] = [];
  let current: HTMLElement | null = table;

  while (current && current !== document.body) {
    const btns = Array.from(
      current.querySelectorAll('button, a.btn, span.btn, [role="button"]')
    ) as HTMLElement[];
    for (const btn of btns) {
      if (!localCandidates.includes(btn)) localCandidates.push(btn);
    }
    if (
      current.classList.contains('erp-table-box') ||
      current.classList.contains('card') ||
      current.tagName.toLowerCase() === 'section' ||
      current.classList.contains('items-grid') ||
      current.classList.contains('table-responsive')
    ) {
      break;
    }
    current = current.parentElement;
  }

  const isValidBtn = (btn: HTMLElement): boolean => {
    if (excludeContainer && excludeContainer.contains(btn)) return false;
    if (!btn.offsetWidth && !btn.offsetHeight && !btn.getClientRects().length) return false;
    if (btn.closest('.dp-pd') || btn.classList.contains('dp-pd__pull') || btn.classList.contains('dp-pd__opt')) {
      return false;
    }
    return true;
  };

  const matchesAddRowPattern = (btn: HTMLElement): boolean => {
    // Check mat-icon or inner icon elements
    const icons = Array.from(btn.querySelectorAll('mat-icon, i, span, svg')) as HTMLElement[];
    for (const ic of icons) {
      const icText = (ic.textContent || '').trim().toLowerCase();
      const icClass = (ic.className || '').toLowerCase();
      if (
        icText === 'add' ||
        icText === 'add_circle' ||
        icText === 'add_box' ||
        icText === 'plus' ||
        icClass.includes('fa-plus') ||
        icClass.includes('bi-plus') ||
        icClass.includes('icon-plus') ||
        icClass.includes('btn--add')
      ) {
        return true;
      }
    }

    // Check button text
    const btnText = (btn.textContent || '').trim().toLowerCase();
    if (
      btnText === '+' ||
      btnText === 'add' ||
      btnText === 'add row' ||
      btnText === 'إضافة' ||
      btnText === 'اضافة' ||
      btnText === 'إضافة سطر' ||
      btnText === 'اضافة سطر' ||
      btnText === 'سطر جديد' ||
      btnText === '+ إضافة' ||
      btnText === '+ اضافة'
    ) {
      return true;
    }

    // Check data-action
    const dataAction = (btn.getAttribute('data-action') || '').toLowerCase();
    if (dataAction.includes('add') || dataAction.includes('create-row')) {
      return true;
    }

    // Check title / aria-label
    const titleOrAria = (
      (btn.getAttribute('title') || '') + ' ' + (btn.getAttribute('aria-label') || '')
    ).toLowerCase();
    if (
      titleOrAria.includes('add') ||
      titleOrAria.includes('إضافة') ||
      titleOrAria.includes('اضافة') ||
      titleOrAria.includes('سطر') ||
      titleOrAria.includes('+')
    ) {
      return true;
    }

    // Check CSS classes
    const cls = (btn.className || '').toLowerCase();
    if (cls.includes('btn--add') || cls.includes('add-row') || cls.includes('add_row')) {
      return true;
    }

    return false;
  };

  // 2. Structural Resolution FIRST (Zero network roundtrips, sub-millisecond, 0 tokens)
  for (const btn of localCandidates) {
    if (!isValidBtn(btn)) continue;
    if (matchesAddRowPattern(btn)) {
      telemetry?.log('GRID', 'Resolved add-row button structurally near grid', {
        action: btn.getAttribute('data-action') || btn.id || btn.className,
        label: (btn.textContent || btn.getAttribute('title') || '').trim(),
      });
      return btn;
    }
  }

  // 3. If not found in immediate table container, search broader form container
  const formRoot = (table.closest('.erp-mock-main, .erp-screen, form, main') || document.body) as HTMLElement;
  const formBtns = (
    Array.from(formRoot.querySelectorAll('button, a.btn, span.btn, [role="button"]')) as HTMLElement[]
  ).filter((b) => !localCandidates.includes(b));

  for (const btn of formBtns) {
    if (!isValidBtn(btn)) continue;
    if (matchesAddRowPattern(btn)) {
      telemetry?.log('GRID', 'Resolved add-row button structurally in form', {
        action: btn.getAttribute('data-action') || btn.id || btn.className,
        label: (btn.textContent || btn.getAttribute('title') || '').trim(),
      });
      return btn;
    }
  }

  // 4. Fallback to AI (resolveErpControls) only if structural pattern found nothing
  const allCandidates = [...localCandidates, ...formBtns].filter(isValidBtn);
  if (copilotService && allCandidates.length > 0) {
    try {
      const controlList: ControlIn[] = [];
      const elementMap = new Map<string, HTMLElement>();
      let cIdx = 1;

      // Scoped to top 15 closest candidate buttons to avoid blowing token limit
      for (const btn of allCandidates.slice(0, 15)) {
        const rawText = (btn.textContent || btn.getAttribute('title') || btn.getAttribute('aria-label') || '').trim();
        const id = btn.getAttribute('data-action') || btn.id || `grid_btn_${cIdx++}`;
        controlList.push({ id, label: rawText.slice(0, 80) || id });
        elementMap.set(id, btn);
      }

      const screenId = document.querySelector('.screen-tag code')?.textContent?.trim() || 'CURRENT_SCREEN';
      const res = await copilotService.resolveErpControls({
        screen_id: screenId,
        controls: controlList,
      });

      const addRowId = res.roles ? res.roles['add_row'] : undefined;
      if (addRowId) {
        const btn = elementMap.get(addRowId);
        if (btn) {
          telemetry?.log('GRID', 'Resolved add-row button via AI fallback', { addRowId });
          return btn;
        }
      }
    } catch (err) {
      console.warn('[GridDriver] AI add_row resolution failed:', err);
    }
  }

  return null;
}

/**
 * Fills items grid table rows sequentially.
 * Matches column headers from <th> / mat-header-cell, finds or creates row,
 * and populates item, quantity, cost/price, and unit cells.
 */
export async function fillGridRows(
  rows: Record<string, any>[],
  options: GridFillOptions = {}
): Promise<number> {
  if (typeof document === 'undefined' || !rows || rows.length === 0) return 0;

  const { excludeContainer, resultsOut, telemetry, copilotService } = options;
  let filledRowsCount = 0;

  try {
    const tables = Array.from(
      getActiveFormRoot().querySelectorAll('table, mat-table, ag-grid, [role="grid"]')
    ) as HTMLElement[];

    // Pick the table that specifically contains items/products or fallback to the first table
    const table =
      tables.find((t) => {
        if (excludeContainer && excludeContainer.contains(t)) return false;
        const text = (t.textContent || '').toLowerCase();
        return (
          text.includes('صنف') ||
          text.includes('منتج') ||
          text.includes('كمية') ||
          text.includes('item') ||
          text.includes('qty')
        );
      }) || tables.find((t) => !excludeContainer || !excludeContainer.contains(t));

    if (!table) {
      console.warn('[GridDriver] No grid table found for rows filling');
      return 0;
    }

    // Read clean column headers strictly from the primary header row (thead tr)
    const thead = table.querySelector('thead');
    const headerRow = thead ? thead.querySelector('tr') : table.querySelector('tr');
    const headers = headerRow
      ? (Array.from(headerRow.querySelectorAll('th, td, [role="columnheader"]')) as HTMLElement[])
      : (Array.from(table.querySelectorAll('thead th, mat-header-cell, [role="columnheader"]')) as HTMLElement[]);

    const colHeaderMap: { index: number; text: string }[] = headers.map((th, index) => ({
      index,
      text: normalizeArabicText(th.textContent || ''),
    }));

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const rowData = rows[rIdx];

      let rowEls = getGenuineRows(table);
      let targetRow: HTMLElement | null | undefined = rowEls[rIdx];

      if (!targetRow) {
        const addBtn = await findAddRowButton(table, excludeContainer, telemetry, copilotService);
        if (addBtn) {
          addBtn.click();
          targetRow = (await waitFor<HTMLElement>(() => {
            const currentRows = getGenuineRows(table);
            if (currentRows.length > rowEls.length) {
              return currentRows[rIdx] || currentRows[currentRows.length - 1] || null;
            }
            return null;
          }, 3000)) || undefined;

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // If targetRow exists but lacks an item selector dropdown, trigger addBtn to get a proper item row
      if (targetRow && !targetRow.querySelector('eg-select, ng-select')) {
        const addBtn = await findAddRowButton(table, excludeContainer, telemetry, copilotService);
        if (addBtn) {
          addBtn.click();
          targetRow = (await waitFor<HTMLElement>(() => {
            const currentRows = getGenuineRows(table);
            const candidate = currentRows[rIdx] || currentRows[currentRows.length - 1];
            return candidate && candidate.querySelector('eg-select, ng-select') ? candidate : null;
          }, 3000)) || targetRow;

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!targetRow) {
        console.warn(`[GridDriver] Could not find or create grid row index ${rIdx}`);
        telemetry?.log('GRID', `Could not find or create grid row index ${rIdx}`, {
          row: rIdx + 1,
          data: rowData,
        });
        continue;
      }

      const cells = Array.from(targetRow.querySelectorAll('td, mat-cell, [role="gridcell"]')) as HTMLElement[];
      let cellFilled = false;

      // Sort entries so product/item dropdown is filled FIRST, allowing ERP async cascade to settle before setting qty/cost
      const sortedEntries = Object.entries(rowData).sort(([keyA], [keyB]) => {
        const isItemA = matchesColKey('الصنف', keyA) || matchesColKey('اسم المنتج', keyA);
        const isItemB = matchesColKey('الصنف', keyB) || matchesColKey('اسم المنتج', keyB);
        if (isItemA && !isItemB) return -1;
        if (!isItemA && isItemB) return 1;
        return 0;
      });

      for (const [colKey, rawVal] of sortedEntries) {
        if (rawVal == null) continue;

        let targetCell: HTMLElement | null = null;
        for (let cIdx = 0; cIdx < cells.length; cIdx++) {
          const h = colHeaderMap.find((header) => header.index === cIdx);
          if (h && matchesColKey(h.text, colKey)) {
            targetCell = cells[cIdx];
            break;
          }
        }

        if (!targetCell) {
          for (const cell of cells) {
            const input = cell.querySelector(
              `input[name*="${colKey}" i], select[name*="${colKey}" i], textarea[name*="${colKey}" i], [data-field*="${colKey}" i]`
            );
            if (input) {
              targetCell = cell;
              break;
            }
          }
        }

        // Direct Fallback 1: match product/item column directly to cell with eg-select / ng-select (excluding Dub, #product, and .dp-pd)
        if (!targetCell && (matchesColKey('الصنف', colKey) || matchesColKey('اسم المنتج', colKey))) {
          targetCell =
            cells.find((c) => {
              if (c.closest('.dp-pd') || c.querySelector('.dp-pd, [id="product"]')) return false;
              const sel = c.querySelector('eg-select, ng-select');
              if (!sel) return false;
              const name = (sel.getAttribute('name') || sel.getAttribute('formcontrolname') || sel.id || '').toLowerCase();
              return !name.includes('dub') && sel.id !== 'product' && !sel.closest('.dp-pd');
            }) || null;
        }

        // Direct Fallback 2: match quantity directly to number input cell
        if (!targetCell && (matchesColKey('الكمية', colKey) || matchesColKey('العدد', colKey))) {
          targetCell =
            cells.find((c) => {
              const inp = c.querySelector(
                'input[type="number"], input[name*="qty" i], input[name*="count" i], input[formcontrolname*="qty" i]'
              );
              return !!inp;
            }) || null;
        }

        // Direct Fallback 3: match price/cost directly to price/cost input cell
        if (!targetCell && (matchesColKey('السعر', colKey) || matchesColKey('التكلفة', colKey))) {
          targetCell =
            cells.find((c) => {
              const inp = c.querySelector(
                'input[name*="price" i], input[name*="cost" i], input[formcontrolname*="price" i], input[formcontrolname*="cost" i]'
              );
              return !!inp;
            }) || null;
        }

        if (targetCell) {
          const selects = Array.from(targetCell.querySelectorAll('eg-select, ng-select')) as HTMLElement[];
          const ngSelect = selects.find((s) => s.id !== 'product' && !s.closest('.dp-pd')) || selects[0];
          if (ngSelect) {
            const status = await setNgSelect(ngSelect, rawVal, telemetry);
            if (status === 'filled') {
              cellFilled = true;
              // Wait briefly for ERP cascade / auto-calculated fields to populate
              await settle(targetRow, { quietMs: 60, maxMs: 400 });
            }
          } else {
            const input = targetCell.querySelector('input, select, textarea') as
              | HTMLInputElement
              | HTMLSelectElement
              | HTMLTextAreaElement;

            if (input && !input.disabled && !(input as HTMLInputElement).readOnly) {
              // Check if this is a Price/Cost column that already received an auto-populated default value from the ERP system
              const isCostOrPrice = matchesColKey('التكلفة', colKey) || matchesColKey('السعر', colKey);
              if (isCostOrPrice) {
                await settle(targetRow, { quietMs: 40, maxMs: 200 });
                const existingNum = parseFloat(String(input.value || '').replace(/,/g, '').trim());
                if (!isNaN(existingNum) && existingNum > 0) {
                  telemetry?.log('GRID', `Preserving system auto-populated default cost for row ${rIdx + 1}`, {
                    field: colKey,
                    systemCost: existingNum,
                    skippedProposed: rawVal,
                  });
                  cellFilled = true;
                  continue; // Leave the system default value intact!
                }
              }

              if (input.tagName.toLowerCase() === 'select') {
                setNativeSelect(input as HTMLSelectElement, rawVal);
              } else {
                setTextOrDate(input as HTMLInputElement, rawVal, telemetry);
              }
              cellFilled = true;
            }
          }
        }
      }

      // Post-fill verification & enforcement for quantity:
      // DynamicERP's async product selection cascade often resets quantity to default 1.
      // If the user specified an expected quantity, ensure it is preserved!
      const expectedQtyKey = Object.keys(rowData).find(
        (k) => matchesColKey('الكمية', k) || matchesColKey('العدد', k) || k.toLowerCase().includes('qty')
      );
      if (expectedQtyKey && rowData[expectedQtyKey] != null) {
        const expectedQty = parseFloat(String(rowData[expectedQtyKey]));
        if (!isNaN(expectedQty)) {
          const qtyInput = targetRow.querySelector(
            'input[name*="qty" i], input[name*="count" i], input[name*="quantity" i], input[formcontrolname*="qty" i], input[formcontrolname*="quantity" i], input[type="number"]'
          ) as HTMLInputElement;

          if (qtyInput && !qtyInput.disabled && !qtyInput.readOnly) {
            const currentQty = parseFloat(String(qtyInput.value || '').replace(/,/g, '').trim());
            if (isNaN(currentQty) || currentQty !== expectedQty) {
              telemetry?.log(
                'GRID',
                `Enforcing requested quantity for row ${rIdx + 1} after cascade (was ${currentQty}, expected ${expectedQty})`,
                {
                  row: rIdx + 1,
                  currentQty,
                  expectedQty,
                }
              );
              setTextOrDate(qtyInput, expectedQty, telemetry);
              await settle(targetRow, { quietMs: 40, maxMs: 200 });
            }
          }
        }
      }

      if (cellFilled) {
        filledRowsCount++;

        // Settle and read calculated total after row is filled
        await settle(targetRow, { quietMs: 50, maxMs: 250 });
        const totalAfterRow = readCalculatedTotal();
        if (totalAfterRow) {
          telemetry?.log('GRID', `Calculated total after filling row ${rIdx + 1}`, {
            row: rIdx + 1,
            calculatedTotal: totalAfterRow,
          });
        }

        if (resultsOut) {
          resultsOut.push({
            field: `row_${rIdx + 1}`,
            value: rowData,
            status: 'filled',
            message: `تمت تعبئة سطر الصنف رقم ${rIdx + 1}`,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[GridDriver] Error filling grid rows:', err);
  }
  return filledRowsCount;
}
