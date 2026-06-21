<?php

declare(strict_types=1);

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailOtpNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $otp) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Your verification code')
            ->greeting('Hello!')
            ->line("Your one-time verification code is: **{$this->otp}**")
            ->line('This code expires in 10 minutes.')
            ->line('If you did not request this code, please ignore this email.');
    }
}
