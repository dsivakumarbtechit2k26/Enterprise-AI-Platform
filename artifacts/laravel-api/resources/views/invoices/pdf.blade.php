<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Invoice {{ $invoice->id }}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 13px; color: #1a1a2e; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .brand h2 { font-size: 22px; color: #1a1a2e; }
        .brand p { color: #718096; font-size: 12px; margin-top: 4px; }
        .invoice-meta { text-align: right; }
        .invoice-meta h1 { font-size: 28px; color: #667eea; text-transform: uppercase; letter-spacing: 2px; }
        .invoice-meta p { color: #718096; font-size: 12px; margin-top: 4px; }
        .parties { display: flex; justify-content: space-between; margin: 30px 0; }
        .party-block h4 { font-size: 11px; text-transform: uppercase; color: #718096; letter-spacing: 1px; margin-bottom: 8px; }
        .party-block p { font-size: 13px; line-height: 1.6; }
        .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f7f7f7; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #718096; }
        td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
        .amount-col { text-align: right; }
        .totals { width: 280px; margin-left: auto; }
        .totals tr td { border: none; padding: 6px 12px; }
        .totals .grand-total td { font-weight: bold; font-size: 15px; border-top: 2px solid #1a1a2e; padding-top: 10px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .status-paid { background: #c6f6d5; color: #276749; }
        .status-open { background: #feebc8; color: #744210; }
        .footer { margin-top: 60px; font-size: 11px; color: #a0aec0; text-align: center; }
    </style>
</head>
<body>

<div class="header">
    <div class="brand">
        <h2>{{ $vendor }}</h2>
        <p>Enterprise SaaS Platform</p>
    </div>
    <div class="invoice-meta">
        <h1>Invoice</h1>
        <p><strong>Invoice #:</strong> {{ $invoice->id }}</p>
        <p><strong>Date:</strong> {{ $invoice->date()->format('F j, Y') }}</p>
        <span class="status-badge {{ $invoice->status === 'paid' ? 'status-paid' : 'status-open' }}">
            {{ strtoupper($invoice->status ?? 'open') }}
        </span>
    </div>
</div>

<hr class="divider">

<div class="parties">
    <div class="party-block">
        <h4>From</h4>
        <p><strong>{{ $vendor }}</strong><br>
        Enterprise SaaS Platform</p>
    </div>
    <div class="party-block" style="text-align: right">
        <h4>Bill To</h4>
        <p><strong>{{ $tenant->name }}</strong><br>
        Tenant ID: {{ $tenant->id }}</p>
    </div>
</div>

<table>
    <thead>
        <tr>
            <th>Description</th>
            <th class="amount-col">Qty</th>
            <th class="amount-col">Unit Price</th>
            <th class="amount-col">Amount</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($invoice->invoiceItems() as $item)
        <tr>
            <td>{{ $item->description }}</td>
            <td class="amount-col">{{ $item->quantity ?? 1 }}</td>
            <td class="amount-col">{{ $invoice->formatAmount($item->unit_amount ?? $item->amount) }}</td>
            <td class="amount-col">{{ $invoice->formatAmount($item->amount) }}</td>
        </tr>
        @endforeach
        @foreach ($invoice->subscriptions() as $sub)
        <tr>
            <td>{{ $sub->description }} <em style="color:#718096">(Subscription)</em></td>
            <td class="amount-col">{{ $sub->quantity ?? 1 }}</td>
            <td class="amount-col">{{ $invoice->formatAmount($sub->amount) }}</td>
            <td class="amount-col">{{ $invoice->formatAmount($sub->amount) }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

<table class="totals">
    <tr>
        <td>Subtotal</td>
        <td class="amount-col">{{ $invoice->subtotal() }}</td>
    </tr>
    @if ($invoice->hasDiscount())
    <tr>
        <td>Discount</td>
        <td class="amount-col">-{{ $invoice->discount() }}</td>
    </tr>
    @endif
    @if ($invoice->tax())
    <tr>
        <td>Tax</td>
        <td class="amount-col">{{ $invoice->tax() }}</td>
    </tr>
    @endif
    <tr class="grand-total">
        <td>Total</td>
        <td class="amount-col">{{ $invoice->total() }}</td>
    </tr>
</table>

<div class="footer">
    Thank you for your business. This invoice was generated automatically by {{ $vendor }}.
    Please contact billing support if you have any questions.
</div>

</body>
</html>
