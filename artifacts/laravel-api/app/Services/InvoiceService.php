<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

class InvoiceService
{
    /**
     * Generate a PDF invoice for a Stripe invoice ID, returned as a download response.
     */
    public function downloadPdf(Tenant $tenant, string $stripeInvoiceId): Response
    {
        // Fetch from Stripe via Cashier
        $invoice = $tenant->findInvoice($stripeInvoiceId);

        $pdf = Pdf::loadView('invoices.pdf', [
            'tenant'  => $tenant,
            'invoice' => $invoice,
            'vendor'  => config('app.name', 'Enterprise SaaS'),
        ])->setPaper('a4');

        $filename = 'invoice-' . $stripeInvoiceId . '.pdf';

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
