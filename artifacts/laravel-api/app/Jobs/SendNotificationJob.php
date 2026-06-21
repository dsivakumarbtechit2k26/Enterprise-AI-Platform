<?php

declare(strict_types=1);

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly string $channel,
        public readonly string $recipient,
        public readonly string $subject,
        public readonly string $message,
        public readonly array  $data = [],
        public readonly ?string $tenantId = null,
    ) {}

    public function handle(): void
    {
        Log::info('SendNotificationJob: dispatching notification', [
            'channel'   => $this->channel,
            'recipient' => $this->recipient,
            'subject'   => $this->subject,
            'tenant_id' => $this->tenantId,
        ]);

        // Channel-specific dispatch will be implemented in the auth/notifications task
        match ($this->channel) {
            'email'  => $this->sendEmail(),
            'in_app' => $this->sendInApp(),
            default  => Log::warning('SendNotificationJob: unknown channel', ['channel' => $this->channel]),
        };
    }

    private function sendEmail(): void
    {
        // Full email implementation in the auth task
        Log::info('SendNotificationJob: email queued', ['to' => $this->recipient]);
    }

    private function sendInApp(): void
    {
        // In-app notification implementation in the auth task
        Log::info('SendNotificationJob: in-app notification queued', ['to' => $this->recipient]);
    }
}
