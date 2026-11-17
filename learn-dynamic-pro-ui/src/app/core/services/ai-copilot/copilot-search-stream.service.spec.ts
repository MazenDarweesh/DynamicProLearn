import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import {
  CopilotService,
  CopilotFormFillData,
  CopilotSource,
  GeneralChatNavAction,
  GeneralChatToolEvent,
  GeneralChatDoneMeta
} from './copilot.service';
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

  it('streams /v1/erp/chat/stream via streamGeneralChat with full payload and all SSE events', async () => {
    const ssePayload =
      'event: tool_start\n' +
      'data: {"tool":"search_lms_lessons"}\n\n' +
      'event: sources\n' +
      'data: [{"lesson_id":"l1","title":"شرح المشتريات","type":"video","start":12}]\n\n' +
      'event: tool_end\n' +
      'data: {"tool":"search_lms_lessons","ok":true}\n\n' +
      'event: nav_action\n' +
      'data: {"decision":"go","screen":"فواتير المبيعات","pageId":244,"screenKey":"SALES_INVOICE","reason":"match"}\n\n' +
      'event: token\n' +
      'data: {"text":"أهلاً بك! "}\n\n' +
      'event: token\n' +
      'data: {"text":"تم فتح الشاشة."}\n\n' +
      'event: done\n' +
      'data: {"thread_id":"thr-123","trace_id":"trc-1","mcp_enabled":false,"provider":"google","model":"gemini-3.5-flash-lite"}\n\n';

    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(mockSseStreamResponse(ssePayload));

    let receivedSources: CopilotSource[] = [];
    let receivedTokens = '';
    let receivedNav: GeneralChatNavAction | undefined;
    const toolEvents: GeneralChatToolEvent[] = [];
    let doneMeta: GeneralChatDoneMeta | undefined;

    await service.streamGeneralChat({
      query: 'افتح المبيعات واشرحها',
      history: [{ role: 'user', content: 'مرحبا' }, { role: 'assistant', content: 'أهلاً' }],
      threadId: 'thr-prev',
      erpKey: 'Purchases',
      activeScreenKey: 'PURCHASE_INVOICE',
      lessonId: 'l1',
      lessonIds: ['l1', 'l2'],
      candidates: [{ id: '244', label: 'فواتير المبيعات', path: ['العملاء والمبيعات'] }],
      traceId: 'trc-1',
      onSources: (s) => (receivedSources = s),
      onToken: (t) => (receivedTokens += t),
      onNavAction: (a) => (receivedNav = a),
      onToolEvent: (ev) => toolEvents.push(ev),
      onDone: (meta) => (doneMeta = meta),
      onError: (err) => fail(`Unexpected SSE error: ${err}`)
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/v1/erp/chat/stream');
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'افتح المبيعات واشرحها',
      history: [{ role: 'user', content: 'مرحبا' }, { role: 'assistant', content: 'أهلاً' }],
      thread_id: 'thr-prev',
      erp_key: 'Purchases',
      active_screen_key: 'PURCHASE_INVOICE',
      lesson_id: 'l1',
      lesson_ids: ['l1', 'l2'],
      candidates: [{ id: '244', label: 'فواتير المبيعات', path: ['العملاء والمبيعات'] }],
      trace_id: 'trc-1'
    });

    expect(receivedSources.length).toBe(1);
    expect(receivedSources[0].lesson_id).toBe('l1');
    expect(toolEvents.map((e) => e.type)).toEqual(['tool_start', 'tool_end']);
    expect(receivedNav?.decision).toBe('go');
    expect(receivedNav?.pageId).toBe(244);
    expect(receivedTokens).toBe('أهلاً بك! تم فتح الشاشة.');
    expect(doneMeta?.thread_id).toBe('thr-123');
    expect(doneMeta?.mcp_enabled).toBeFalse();
    expect(doneMeta?.provider).toBe('google');
    expect(doneMeta?.metrics?.tokenCount).toBe(2);
  });

  it('handles SSE error events and 401 guest retry in streamGeneralChat', async () => {
    const errStream = mockSseStreamResponse(
      'event: error\n' +
      'data: {"message":"provider unavailable"}\n\n'
    );
    const fetchSpy = spyOn(window, 'fetch').and.returnValues(
      Promise.resolve(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })),
      Promise.resolve(errStream)
    );

    let capturedError: any;
    let doneCalled = false;

    await service.streamGeneralChat({
      query: 'مرحبا',
      onDone: () => (doneCalled = true),
      onError: (err) => (capturedError = err)
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(capturedError).toEqual({ message: 'provider unavailable' });
    expect(doneCalled).toBeFalse();
  });
});

