const fs = require('fs');

async function test() {
  const token = fs.readFileSync('scripts/mock_token.txt', 'utf8').trim();
  const reqBody = {
    query: "سجل لي دفعة من 3 فواتير مشتريات: الأولى من شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي، الثانية من شركة الحمد للتجارة المنتج رواتر 5 وسعر 800، الثالثة من مؤسسة النور توريدات المنتج سويتشات 2 وسعر 1200",
    scope: "all",
    erp_key: "PURCHASE_INVOICE",
    form_schema: [
      { key: "Supplier", label: "المورد", kind: "select", group: "header" },
      { key: "PurchaseMethod", label: "طريقة الشراء", kind: "select", group: "header" },
      { key: "Warehouse", label: "المخزن المستلم", kind: "select", group: "header" },
      { key: "Date", label: "تاريخ الفاتورة", kind: "date", group: "header" },
      { key: "TotalAmount", label: "إجمالي الفاتورة", kind: "text", group: "footer" },
      { key: "CashPaid", label: "المدفوع نقداً", kind: "text", group: "footer" }
    ],
    skip_cache: true
  };

  console.log("Connecting to http://localhost:8000/v1/search/stream...");
  const t0 = Date.now();
  const resp = await fetch("http://localhost:8000/v1/search/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(reqBody)
  });

  console.log("Status:", resp.status);
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('event: form_fill')) {
        console.log(`[${Date.now() - t0}ms] EVENT: form_fill`);
      } else if (trimmed.startsWith('data:') && trimmed.includes('batch_mode')) {
        console.log(`[${Date.now() - t0}ms] DATA:`, trimmed);
      } else if (trimmed.startsWith('event: done')) {
        console.log(`[${Date.now() - t0}ms] EVENT: done`);
      }
    }
  }
  console.log("Stream finished in", Date.now() - t0, "ms");
}

test().catch(err => console.error("Error:", err));
