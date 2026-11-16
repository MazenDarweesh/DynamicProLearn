import { TestBed } from '@angular/core/testing';
import { ErpTelemetryService } from './erp-telemetry.service';
import { CopilotService } from '../ai-copilot/copilot.service';

describe('ErpTelemetryService', () => {
  let service: ErpTelemetryService;
  let mockCopilot: jasmine.SpyObj<CopilotService>;

  beforeEach(() => {
    mockCopilot = jasmine.createSpyObj<CopilotService>('CopilotService', [
      'sendErpTelemetry',
      'getAiBaseUrl',
    ]);
    mockCopilot.getAiBaseUrl.and.returnValue('');
    mockCopilot.sendErpTelemetry.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        ErpTelemetryService,
        { provide: CopilotService, useValue: mockCopilot },
      ],
    });
    service = TestBed.inject(ErpTelemetryService);
  });

  it('redacts sensitive credential keys recursively from details', () => {
    service.log('GENERAL', 'Auth check', {
      token: 'jwt-secret',
      nested: { password: '123', safeKey: 'ok' },
    });

    const ring = (window as any).__COPILOT_SESSION_LOG__ as any[];
    const last = ring[ring.length - 1];
    expect(last.details.token).toBe('[REDACTED]');
    expect(last.details.nested.password).toBe('[REDACTED]');
    expect(last.details.nested.safeKey).toBe('ok');
  });

  it('re-queues buffered events when sendErpTelemetry fails', async () => {
    mockCopilot.sendErpTelemetry.and.returnValue(Promise.reject(new Error('Network down')));

    service.log('NAV', 'Step 1', { screenKey: 'PURCHASES' });
    service.flush();

    await Promise.resolve();
    await Promise.resolve();

    mockCopilot.sendErpTelemetry.and.returnValue(Promise.resolve());
    service.flush();
    expect(mockCopilot.sendErpTelemetry).toHaveBeenCalledTimes(2);
    const retriedBatch = mockCopilot.sendErpTelemetry.calls.mostRecent().args[0];
    expect(retriedBatch.events.length).toBe(1);
    expect(retriedBatch.events[0].event).toBe('Step 1');
  });
});
