<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DunningEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Tenant $tenant,
        public readonly int    $attemptNumber, // 1, 2, 3
    ) {}

    public function envelope(): Envelope
    {
        $subject = match ($this->attemptNumber) {
            1 => 'Action required: payment failed for ' . $this->tenant->name,
            2 => 'Reminder: your payment is still unpaid — please update your card',
            3 => 'Final notice: your account will be suspended for non-payment',
            default => 'Payment issue with your account',
        };

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.dunning',
            with: [
                'tenant'        => $this->tenant,
                'attemptNumber' => $this->attemptNumber,
                'billingUrl'    => config('app.frontend_url', config('app.url')) . '/settings/billing',
            ],
        );
    }
}
