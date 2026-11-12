import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CopilotService } from './copilot.service';
import { CopilotNetworkService } from './copilot-network.config';
import { AuthService } from '../platform-core/auth.service';
import { ErpTelemetryService } from '../erp-automation/erp-telemetry.service';

describe('CopilotService - getCopilotFilters auth gate & cache recovery', () => {
  let service: CopilotService;
  let httpMock: HttpTestingController;
  let tokenSignal: ReturnType<typeof signal<string | null>>;
  let authenticatedFlag: boolean;

  beforeEach(() => {
    tokenSignal = signal<string | null>(null);
    authenticatedFlag = false;

    const mockAuthService = {
      token: tokenSignal,
      isAuthenticated: () => authenticatedFlag,
      isTokenExpired: () => false,
      refreshToken: () => of({ token: '' }),
      setBackendUrl: () => {},
    };

    const mockTelemetry = jasmine.createSpyObj('ErpTelemetryService', ['log']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CopilotService,
        CopilotNetworkService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ErpTelemetryService, useValue: mockTelemetry },
      ],
    });

    service = TestBed.inject(CopilotService);
    httpMock = TestBed.inject(HttpTestingController);
    service.setBaseUrls('', 'https://localhost:5115');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('skips HTTP call when unauthenticated and fetches once authenticated', () => {
    let result: any;
    service.getCopilotFilters().subscribe((res) => (result = res));
    httpMock.expectNone('https://localhost:5115/api/student/copilot-filters');
    expect(result).toEqual({ modules: [], levels: [], types: [] });

    authenticatedFlag = true;
    tokenSignal.set('jwt-token-1');

    service.getCopilotFilters().subscribe((res) => (result = res));
    const req = httpMock.expectOne('https://localhost:5115/api/student/copilot-filters');
    expect(req.request.method).toBe('GET');
    req.flush({ modules: [{ id: 'm1', title: 'M1', code: '', units: [] }], levels: [], types: [] });
    expect(result.modules.length).toBe(1);
  });

  it('does not permanently cache an HTTP failure response', () => {
    authenticatedFlag = true;
    tokenSignal.set('jwt-token-1');

    let result: any;
    service.getCopilotFilters().subscribe((res) => (result = res));
    const req1 = httpMock.expectOne('https://localhost:5115/api/student/copilot-filters');
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(result).toEqual({ modules: [], levels: [], types: [] });

    service.getCopilotFilters().subscribe((res) => (result = res));
    const req2 = httpMock.expectOne('https://localhost:5115/api/student/copilot-filters');
    req2.flush({ modules: [{ id: 'm2', title: 'M2', code: '', units: [] }], levels: [], types: [] });
    expect(result.modules.length).toBe(1);
  });
});

