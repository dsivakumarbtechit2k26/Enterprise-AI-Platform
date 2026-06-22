<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SuspiciousActivityAlert extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $alertType,
        public readonly array  $context,
    ) {}

    public function envelope(): Envelope
    {
        $appName = config('app.name', 'Platform');

        $subject = match ($this->alertType) {
            'login_failure'  => "[{$appName}] Security Alert: Multiple failed login attempts",
            'account_locked' => "[{$appName}] Security Alert: Account locked after repeated failures",
            'payment_failed' => "[{$appName}] Billing Alert: Payment failure detected",
            default          => "[{$appName}] Security Alert: Suspicious activity detected",
        };

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.security-alert',
            with: [
                'alertType' => $this->alertType,
                'context'   => $this->context,
                'timestamp' => now()->toDateTimeString() . ' UTC',
            ],
        );
    }
}
