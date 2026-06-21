<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlanFeature;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPlansController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = SubscriptionPlan::with('features')
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($p) => [
                'id'              => $p->id,
                'key'             => $p->key,
                'name'            => $p->name,
                'description'     => $p->description,
                'price_cents'     => $p->price_cents,
                'interval'        => $p->interval,
                'stripe_price_id' => $p->stripe_price_id,
                'is_active'       => $p->is_active,
                'sort_order'      => $p->sort_order,
                'features'        => $p->features_map,
            ]);

        return response()->json(['data' => $plans]);
    }

    public function update(Request $request, int $planId): JsonResponse
    {
        $plan = SubscriptionPlan::findOrFail($planId);

        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'price_cents' => ['sometimes', 'integer', 'min:0'],
            'is_active'   => ['sometimes', 'boolean'],
            'sort_order'  => ['sometimes', 'integer'],
            'features'    => ['sometimes', 'array'],
        ]);

        $features = $validated['features'] ?? null;
        unset($validated['features']);

        if (! empty($validated)) {
            $plan->update($validated);
        }

        if ($features !== null) {
            foreach ($features as $key => $value) {
                PlanFeature::updateOrCreate(
                    ['subscription_plan_id' => $plan->id, 'feature_key' => $key],
                    ['feature_value' => (string) $value],
                );
            }
        }

        $plan->load('features');

        return response()->json([
            'data' => array_merge(
                $plan->toArray(),
                ['features' => $plan->features_map],
            ),
            'message' => 'Plan updated successfully.',
        ]);
    }
}
