<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class InvoiceService
{
    /**
     * Generate a branded PDF invoice, persist it to object storage,
     * and return a signed temporary URL that expires in 15 minutes.
     *
     * The caller (BillingController) redirects/returns this URL to the client.
     * The client fetches the URL directly from the serve endpoint, which
     * validates the signature and streams the stored PDF.
     */
    public function generateSignedUrl(Tenant $tenant, string $invoiceId): string
    {
        $path = "tenant-invoices/{$tenant->id}/{$invoiceId}.pdf";

        if (! Storage::exists($path)) {
            $invoice = $tenant->findInvoice($invoiceId);

            $pdf = Pdf::loadView('invoices.pdf', [
                'tenant'  => $tenant,
                'invoice' => $invoice,
                'vendor'  => config('app.name', 'Enterprise SaaS'),
            ])->setPaper('a4');

            Storage::put($path, $pdf->output());
        }

        return URL::temporarySignedRoute(
            'api.v1.billing.invoices.serve',
            now()->addMinutes(15),
            [
                'tenantId'  => $tenant->id,
                'invoiceId' => $invoiceId,
            ]
        );
    }

    /**
     * Stream a previously stored invoice PDF to the response.
     * Called from the signed serve route; signature is already validated
     * by Laravel's ValidateSignature middleware before this runs.
     */
    public function serveFromStorage(string $tenantId, string $invoiceId): Response
    {
        $path = "tenant-invoices/{$tenantId}/{$invoiceId}.pdf";

        abort_unless(Storage::exists($path), 404, 'Invoice PDF not found.');

        return response(Storage::get($path), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"invoice-{$invoiceId}.pdf\"",
        ]);
    }
}
