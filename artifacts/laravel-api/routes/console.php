<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Reset monthly usage counters on the 1st of each month at midnight
Schedule::command('billing:reset-usage')
    ->monthlyOn(1, '00:00')
    ->withoutOverlapping()
    ->runInBackground();

// Prune stale Cashier payment records older than 30 days
Schedule::command('cashier:prune-stale-customer-models')
    ->monthly()
    ->withoutOverlapping();
