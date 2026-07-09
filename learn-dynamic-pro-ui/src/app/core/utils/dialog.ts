export class Dialog {
  static alert(message: string, title = 'تنبيه', type: 'success' | 'error' | 'info' = 'info'): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      overlay.style.backdropFilter = 'blur(4px)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '99999';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.2s ease';
      overlay.dir = 'rtl';

      const box = document.createElement('div');
      box.style.backgroundColor = 'var(--color-bg-card, #fff)';
      box.style.border = '1px solid var(--color-border, #e2e2e2)';
      box.style.borderRadius = '12px';
      box.style.padding = '24px';
      box.style.width = '90%';
      box.style.maxWidth = '400px';
      box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
      box.style.transform = 'scale(0.9)';
      box.style.transition = 'transform 0.2s ease';
      box.style.fontFamily = "'Readex Pro', sans-serif";

      // Icon color based on type
      let iconColor = 'var(--color-primary, #2E5FD9)';
      let iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      
      if (type === 'success') {
        iconColor = '#2ec4b6';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      } else if (type === 'error') {
        iconColor = 'var(--color-danger, #E24B4A)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
      }

      box.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="color: ${iconColor}; display: flex; align-items: center;">${iconSvg}</div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--color-text-primary, #1B2A4A);">${title}</h3>
        </div>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: var(--color-text-primary, #1B2A4A); line-height: 1.6; opacity: 0.9;">${message}</p>
        <div style="display: flex; justify-content: flex-end;">
          <button id="custom-alert-ok-btn" style="background-color: var(--color-primary, #2E5FD9); color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;">حسناً</button>
        </div>
      `;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Trigger animations
      setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
      }, 20);

      const close = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.9)';
        setTimeout(() => {
          document.body.removeChild(overlay);
          resolve();
        }, 200);
      };

      const btn = box.querySelector('#custom-alert-ok-btn') as HTMLButtonElement;
      btn.focus();
      btn.onclick = close;
      
      // Close on Enter/Escape
      overlay.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      };
    });
  }

  static confirm(message: string, title = 'تأكيد'): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      overlay.style.backdropFilter = 'blur(4px)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '99999';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.2s ease';
      overlay.dir = 'rtl';

      const box = document.createElement('div');
      box.style.backgroundColor = 'var(--color-bg-card, #fff)';
      box.style.border = '1px solid var(--color-border, #e2e2e2)';
      box.style.borderRadius = '12px';
      box.style.padding = '24px';
      box.style.width = '90%';
      box.style.maxWidth = '400px';
      box.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
      box.style.transform = 'scale(0.9)';
      box.style.transition = 'transform 0.2s ease';
      box.style.fontFamily = "'Readex Pro', sans-serif";

      const iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FE932E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

      box.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center;">${iconSvg}</div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--color-text-primary, #1B2A4A);">${title}</h3>
        </div>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: var(--color-text-primary, #1B2A4A); line-height: 1.6; opacity: 0.9;">${message}</p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="custom-confirm-yes-btn" style="background-color: var(--color-danger, #E24B4A); color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;">تأكيد</button>
          <button id="custom-confirm-no-btn" style="background-color: var(--color-bg-page, #f7f7f7); color: var(--color-text-primary, #1B2A4A); border: 1px solid var(--color-border, #e2e2e2); padding: 8px 20px; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;">إلغاء</button>
        </div>
      `;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Trigger animations
      setTimeout(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'scale(1)';
      }, 20);

      const close = (result: boolean) => {
        overlay.style.opacity = '0';
        box.style.transform = 'scale(0.9)';
        setTimeout(() => {
          document.body.removeChild(overlay);
          resolve(result);
        }, 200);
      };

      const yesBtn = box.querySelector('#custom-confirm-yes-btn') as HTMLButtonElement;
      const noBtn = box.querySelector('#custom-confirm-no-btn') as HTMLButtonElement;
      
      noBtn.focus();
      
      yesBtn.onclick = () => close(true);
      noBtn.onclick = () => close(false);
      
      overlay.onkeydown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(false);
        }
      };
    });
  }
}
