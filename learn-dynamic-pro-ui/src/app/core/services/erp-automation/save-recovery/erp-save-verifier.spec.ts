import { triggerFullClick } from './erp-save-verifier';

describe('ErpSaveVerifier - triggerFullClick', () => {
  afterEach(() => {
    delete (window as any).DynamicERP;
  });

  it('should fire click event strictly once on a persistent Save button', () => {
    const btn = document.createElement('button');
    btn.className = 'dp-btn dp-btn--primary dp-btn--sm dp-edit__save';
    btn.textContent = 'حفظ';
    document.body.appendChild(btn);

    const observedTypes: string[] = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      btn.addEventListener(type, () => observedTypes.push(type));
    }

    try {
      triggerFullClick(btn);
      const clicks = observedTypes.filter((t) => t === 'click');
      expect(clicks.length).toBe(1);
      expect(observedTypes).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    } finally {
      btn.remove();
    }
  });

  it('should fire click strictly once on an enclosing .dp-menu__item when targeting inner span even if handler removes element', () => {
    const menuBtn = document.createElement('button');
    menuBtn.className = 'dp-menu__item';
    const span = document.createElement('span');
    span.className = 'dp-menu__text';
    span.textContent = 'حفظ';
    menuBtn.appendChild(span);
    document.body.appendChild(menuBtn);

    let clickCount = 0;
    menuBtn.addEventListener('click', () => {
      clickCount += 1;
      menuBtn.remove();
    });

    try {
      triggerFullClick(span);
      expect(clickCount).toBe(1);
    } finally {
      menuBtn.remove();
    }
  });
});

