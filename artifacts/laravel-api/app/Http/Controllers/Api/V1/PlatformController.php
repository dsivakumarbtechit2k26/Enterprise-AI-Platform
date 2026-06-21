<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PlatformController extends Controller
{
    public function plans(): JsonResponse
    {
        $plans = [
            [
                'id'          => 'free',
                'name'        => 'Free',
                'price'       => 0,
                'interval'    => null,
                'description' => 'Get started for free',
                'features'    => [
                    'max_users'         => 3,
                    'max_storage_gb'    => 1,
                    'api_calls_month'   => 1000,
                    'modules'           => ['crm', 'tasks'],
                    'ai_features'       => false,
                    'custom_domain'     => false,
                    'priority_support'  => false,
                ],
            ],
            [
                'id'          => 'trial',
                'name'        => 'Trial',
                'price'       => 0,
                'interval'    => null,
                'description' => '14-day full-featured trial',
                'features'    => [
                    'max_users'         => 10,
                    'max_storage_gb'    => 5,
                    'api_calls_month'   => 10000,
                    'modules'           => ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects'],
                    'ai_features'       => true,
                    'custom_domain'     => false,
                    'priority_support'  => false,
                ],
            ],
            [
                'id'          => 'professional_monthly',
                'name'        => 'Professional',
                'price'       => 4900,
                'interval'    => 'month',
                'description' => 'For growing businesses',
                'features'    => [
                    'max_users'         => 25,
                    'max_storage_gb'    => 50,
                    'api_calls_month'   => 100000,
                    'modules'           => ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse'],
                    'ai_features'       => true,
                    'custom_domain'     => true,
                    'priority_support'  => false,
                ],
            ],
            [
                'id'          => 'professional_yearly',
                'name'        => 'Professional (Annual)',
                'price'       => 49000,
                'interval'    => 'year',
                'description' => 'Best value — 2 months free',
                'features'    => [
                    'max_users'         => 25,
                    'max_storage_gb'    => 50,
                    'api_calls_month'   => 100000,
                    'modules'           => ['crm', 'hrm', 'inventory', 'accounting', 'tasks', 'projects', 'pos', 'warehouse'],
                    'ai_features'       => true,
                    'custom_domain'     => true,
                    'priority_support'  => true,
                ],
            ],
            [
                'id'          => 'enterprise',
                'name'        => 'Enterprise',
                'price'       => null,
                'interval'    => 'custom',
                'description' => 'Unlimited scale, dedicated support',
                'features'    => [
                    'max_users'         => null,
                    'max_storage_gb'    => null,
                    'api_calls_month'   => null,
                    'modules'           => ['all'],
                    'ai_features'       => true,
                    'custom_domain'     => true,
                    'priority_support'  => true,
                    'sla'               => true,
                    'dedicated_instance'=> true,
                ],
            ],
        ];

        return response()->json(['data' => $plans]);
    }
}
