import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { CopilotService, CopilotFormFillData } from './copilot.service';
import { CopilotNetworkService } from './copilot-network.config';
import { AuthService } from '../platform-core/auth.service';
import { ErpTelemetryService } from '../erp-automation/erp-telemetry.service';

describe('CopilotService / CopilotSearchStreamService - SSE action_intent delivery', () => {
  let service: CopilotService;
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = window.fetch;

    const mockAuthService = {
      token: () => '',
      isTokenExpired: () => false,
      refreshToken: () => of({ token: '' }),
      setBackendUrl: () => {},
    };

    const mockTelemetry = jasmine.createSpyObj('ErpTelemetryService', ['log']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        CopilotService,
        CopilotNetworkService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ErpTelemetryService, useValue: mockTelemetry },
      ],
    });

    service = TestBed.inject(CopilotService);
    service.setBaseUrls('http://127.0.0.1:8000', '');
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  function mockSseStreamResponse(sseText: string): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseText));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  it('delivers action_intent="edit_current" intact from SSE form_fill event into fillData', async () => {
    const ssePayload =
      'event: sources\n' +
      'data: {"sources":[]}\n\n' +
      'event: form_fill\n' +
      'data: {"intent":"form_fill","action_intent":"edit_current","fields":{"StoreID":"مخزن خامات"},"rows":[],"screenKey":"Purchases","pageId":289}\n\n' +
      'event: token\n' +
      'data: {"text":"تم التجهيز"}\n\n' +
      'event: done\n' +
      'data: {"provenance":"ERP_FORM_FILL"}\n\n';

    spyOn(window, 'fetch').and.resolveTo(mockSseStreamResponse(ssePayload));

    let receivedFill: CopilotFormFillData | undefined;
    let doneMeta: any;

    await service.streamSearch(
      'خلي المخزن مخزن خامات',
      undefined,
      undefined,
      undefined,
      (meta) => {
        doneMeta = meta;
      },
      (err) => fail(`Unexpected SSE error: ${err}`),
      false,
      undefined,
      undefined,
      ['StoreID'],
      'Purchases',
      (fillData) => {
        receivedFill = fillData;
      }
    );

    expect(receivedFill).toBeDefined();
    expect(receivedFill?.intent).toBe('form_fill');
    expect(receivedFill?.action_intent).toBe('edit_current');
    expect(receivedFill?.fields).toEqual({ StoreID: 'مخزن خامات' });
    expect(receivedFill?.screenKey).toBe('Purchases');
    expect(doneMeta?.provenance).toBe('ERP_FORM_FILL');
  });

  it('delivers action_intent="new" intact from SSE form_fill event into fillData', async () => {
    const ssePayload =
      'event: form_fill\n' +
      'data: {"intent":"form_fill","action_intent":"new","fields":{"SupplierID":"حسين","StoreID":"مخزن خامات"},"rows":[{"اسم المنتج":"سن","الكمية":10}],"screenKey":"Purchases","pageId":289}\n\n' +
      'event: done\n' +
      'data: {"provenance":"ERP_FORM_FILL"}\n\n';

    spyOn(window, 'fetch').and.resolveTo(mockSseStreamResponse(ssePayload));

    let receivedFill: CopilotFormFillData | undefined;

    await service.streamSearch(
      'توريد غير عاجل: سجل فاتورة مشتريات من المورد حسين على مخزن خامات لصنف سن كمية 10',
      undefined,
      undefined,
      undefined,
      undefined,
      (err) => fail(`Unexpected SSE error: ${err}`),
      false,
      undefined,
      undefined,
      ['SupplierID', 'StoreID'],
      'Purchases',
      (fillData) => {
        receivedFill = fillData;
      }
    );

    expect(receivedFill).toBeDefined();
    expect(receivedFill?.intent).toBe('form_fill');
    expect(receivedFill?.action_intent).toBe('new');
    expect(receivedFill?.fields?.['SupplierID']).toBe('حسين');
    expect(receivedFill?.rows?.length).toBe(1);
  });
});

