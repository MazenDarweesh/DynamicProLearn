import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CopilotChatComponent } from './copilot-chat.component';
import { CopilotService } from '../../../core/services/ai-copilot/copilot.service';
import { AuthService } from '../../../core/services/platform-core/auth.service';
import { ErpBridgeService, ErpFormDriverService, ErpNavigatorService } from '../../../core/services/erp-automation';

describe('CopilotChatComponent - Filter Bar Auth Gate', () => {
  let fixture: ComponentFixture<CopilotChatComponent>;
  let component: CopilotChatComponent;
  let isAuthSignal: ReturnType<typeof signal<boolean>>;
  let mockCopilotService: jasmine.SpyObj<CopilotService>;

  beforeEach(async () => {
    isAuthSignal = signal(false);

    mockCopilotService = jasmine.createSpyObj('CopilotService', [
      'activeLessonId$',
      'checkReadiness',
      'getCopilotFilters',
      'setBaseUrls',
      'feedbackErpNavigation',
      'sendErpTelemetry',
      'streamSearch',
    ]);
    Object.defineProperty(mockCopilotService, 'activeLessonId$', { value: of(undefined) });
    mockCopilotService.checkReadiness.and.returnValue(of({ status: 'ok', ready: true }));
    mockCopilotService.getCopilotFilters.and.returnValue(of({ modules: [], levels: [], types: [] }));
    mockCopilotService.sendErpTelemetry.and.resolveTo({ status: 'ok' });

    const mockAuthService = {
      userRole: () => 'Student',
      isAuthenticated: isAuthSignal,
      token: () => (isAuthSignal() ? 'valid-jwt' : null),
      setBackendUrl: () => {},
      login: () => isAuthSignal.set(true),
      erpLogin: () => of({ token: 'valid-jwt', refreshToken: 'r' }),
    };

    const mockBridge = jasmine.createSpyObj('ErpBridgeService', ['getActiveScreen'], { isAvailable: false });
    mockBridge.getActiveScreen.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [CopilotChatComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideMarkdown(),
        { provide: CopilotService, useValue: mockCopilotService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ErpBridgeService, useValue: mockBridge },
        {
          provide: ErpNavigatorService,
          useValue: jasmine.createSpyObj('ErpNavigatorService', ['isScreenActive', 'getFormMode']),
        },
        {
          provide: ErpFormDriverService,
          useValue: jasmine.createSpyObj('ErpFormDriverService', ['collectFormSchema']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CopilotChatComponent);
    component = fixture.componentInstance;
    component.inline = true;
    component.isAuthenticating = false;
    fixture.detectChanges();
  });

  it('does not mount top filter bar or call getCopilotFilters while unauthenticated', () => {
    const filterBarEl = fixture.nativeElement.querySelector('app-copilot-top-filter-bar');
    expect(filterBarEl).toBeNull();
    expect(mockCopilotService.getCopilotFilters).not.toHaveBeenCalled();

    isAuthSignal.set(true);
    fixture.detectChanges();

    const filterBarAfterLogin = fixture.nativeElement.querySelector('app-copilot-top-filter-bar');
    expect(filterBarAfterLogin).not.toBeNull();
    expect(mockCopilotService.getCopilotFilters).toHaveBeenCalledTimes(1);
  });
});

