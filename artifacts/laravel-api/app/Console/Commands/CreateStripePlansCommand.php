<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\SubscriptionPlan;
use Illuminate\Console\Command;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

/**
 * Artisan command: php artisan billing:create-stripe-plans
 *
 * Creates (or updates) Stripe products + prices for each active subscription plan
 * and writes the resulting stripe_price_id back to the database row.
 */
class CreateStripePlansCommand extends Command
{
    protected $signature   = 'billing:create-stripe-plans {--dry-run : Preview without making Stripe calls}';
    protected $description = 'Create / sync subscription plans as Stripe products and prices';

    public function handle(): int
    {
        $secret = config('cashier.secret');
        if (! $secret) {
            $this->error('STRIPE_SECRET is not set. Add it to .env and retry.');
            return self::FAILURE;
        }

        $stripe = new StripeClient($secret);
        $plans  = SubscriptionPlan::where('is_active', true)->orderBy('sort_order')->get();

        if ($plans->isEmpty()) {
            $this->warn('No active subscription plans found in the database.');
            return self::SUCCESS;
        }

        $this->table(
            ['Key', 'Name', 'Price (cents)', 'Interval', 'Stripe Price ID'],
            $plans->map(fn ($p) => [$p->key, $p->name, $p->price_cents, $p->interval, $p->stripe_price_id ?? '—']),
        );

        if ($this->option('dry-run')) {
            $this->line('Dry-run mode — no Stripe calls made.');
            return self::SUCCESS;
        }

        foreach ($plans as $plan) {
            if ($plan->isFree()) {
                $this->line("Skipping free plan: {$plan->key}");
                continue;
            }

            try {
                // Upsert Stripe product
                $product = $stripe->products->create([
                    'name'     => $plan->name,
                    'metadata' => ['plan_key' => $plan->key],
                ]);

                // Create price under the product
                $price = $stripe->prices->create([
                    'product'     => $product->id,
                    'unit_amount' => $plan->price_cents,
                    'currency'    => config('cashier.currency', 'usd'),
                    'recurring'   => ['interval' => $plan->interval ?? 'month'],
                    'metadata'    => ['plan_key' => $plan->key],
                ]);

                $plan->update(['stripe_price_id' => $price->id]);

                $this->info("✓ {$plan->key} → price {$price->id}");
            } catch (ApiErrorException $e) {
                $this->error("✗ {$plan->key}: {$e->getMessage()}");
            }
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}
