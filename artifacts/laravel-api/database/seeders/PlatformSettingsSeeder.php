<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlatformSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // ── General ───────────────────────────────────────────────────────
            [
                'key'         => 'platform_name',
                'value'       => 'Enterprise Platform',
                'type'        => 'string',
                'group'       => 'general',
                'description' => 'The display name shown across the platform UI.',
                'is_public'   => true,
            ],
            [
                'key'         => 'platform_url',
                'value'       => 'https://example.com',
                'type'        => 'string',
                'group'       => 'general',
                'description' => 'Canonical public URL used in emails and redirects.',
                'is_public'   => true,
            ],
            [
                'key'         => 'maintenance_mode',
                'value'       => '0',
                'type'        => 'boolean',
                'group'       => 'general',
                'description' => 'When enabled, blocks all non-admin logins and shows a maintenance page.',
                'is_public'   => true,
            ],

            // ── Auth ──────────────────────────────────────────────────────────
            [
                'key'         => 'allow_registration',
                'value'       => '1',
                'type'        => 'boolean',
                'group'       => 'auth',
                'description' => 'Allow new users to self-register.',
                'is_public'   => true,
            ],
            [
                'key'         => 'oauth.github.enabled',
                'value'       => '0',
                'type'        => 'boolean',
                'group'       => 'auth',
                'description' => 'Enable GitHub OAuth login.',
                'is_public'   => true,
            ],
            [
                'key'         => 'oauth.google.enabled',
                'value'       => '0',
                'type'        => 'boolean',
                'group'       => 'auth',
                'description' => 'Enable Google OAuth login.',
                'is_public'   => true,
            ],
            [
                'key'         => 'mfa_required',
                'value'       => '0',
                'type'        => 'boolean',
                'group'       => 'auth',
                'description' => 'Require all users to enroll in multi-factor authentication.',
                'is_public'   => false,
            ],
            [
                'key'         => 'session_lifetime_minutes',
                'value'       => '120',
                'type'        => 'integer',
                'group'       => 'auth',
                'description' => 'Idle session timeout in minutes.',
                'is_public'   => false,
            ],

            // ── Mail / SMTP ────────────────────────────────────────────────────
            [
                'key'         => 'smtp.host',
                'value'       => 'smtp.mailtrap.io',
                'type'        => 'string',
                'group'       => 'mail',
                'description' => 'SMTP server hostname.',
                'is_public'   => false,
            ],
            [
                'key'         => 'smtp.port',
                'value'       => '587',
                'type'        => 'integer',
                'group'       => 'mail',
                'description' => 'SMTP server port (typically 587 for TLS, 465 for SSL).',
                'is_public'   => false,
            ],
            [
                'key'         => 'smtp.encryption',
                'value'       => 'tls',
                'type'        => 'string',
                'group'       => 'mail',
                'description' => 'Encryption protocol: tls or ssl.',
                'is_public'   => false,
            ],
            [
                'key'         => 'smtp.username',
                'value'       => '',
                'type'        => 'string',
                'group'       => 'mail',
                'description' => 'SMTP authentication username.',
                'is_public'   => false,
            ],
            [
                'key'         => 'smtp.password',
                'value'       => '',
                'type'        => 'string',
                'group'       => 'mail',
                'description' => 'SMTP authentication password.',
                'is_public'   => false,
            ],
            [
                'key'         => 'mail.from_address',
                'value'       => 'noreply@example.com',
                'type'        => 'string',
                'group'       => 'mail',
                'description' => 'From address used for all outbound emails.',
                'is_public'   => false,
            ],
            [
                'key'         => 'mail.from_name',
                'value'       => 'Enterprise Platform',
                'type'        => 'string',
                'group'       => 'mail',
                'description' => 'Sender name shown in email clients.',
                'is_public'   => false,
            ],

            // ── Billing ───────────────────────────────────────────────────────
            [
                'key'         => 'trial_days',
                'value'       => '14',
                'type'        => 'integer',
                'group'       => 'billing',
                'description' => 'Number of trial days granted to new tenants.',
                'is_public'   => true,
            ],
            [
                'key'         => 'billing_currency',
                'value'       => 'usd',
                'type'        => 'string',
                'group'       => 'billing',
                'description' => 'ISO 4217 currency code used for all billing operations.',
                'is_public'   => true,
            ],
            [
                'key'         => 'invoice_prefix',
                'value'       => 'INV',
                'type'        => 'string',
                'group'       => 'billing',
                'description' => 'Prefix applied to generated invoice numbers.',
                'is_public'   => false,
            ],

            // ── Features ──────────────────────────────────────────────────────
            [
                'key'         => 'feature.ai_enabled',
                'value'       => '0',
                'type'        => 'boolean',
                'group'       => 'features',
                'description' => 'Enable AI-powered features platform-wide.',
                'is_public'   => false,
            ],
            [
                'key'         => 'feature.audit_log_enabled',
                'value'       => '1',
                'type'        => 'boolean',
                'group'       => 'features',
                'description' => 'Enable the audit log for all platform events.',
                'is_public'   => false,
            ],
            [
                'key'         => 'feature.api_tokens_enabled',
                'value'       => '1',
                'type'        => 'boolean',
                'group'       => 'features',
                'description' => 'Allow users to generate personal API tokens.',
                'is_public'   => false,
            ],
        ];

        foreach ($settings as $setting) {
            DB::connection('central')->table('platform_settings')->updateOrInsert(
                ['key' => $setting['key']],
                array_merge($setting, ['created_at' => now(), 'updated_at' => now()])
            );
        }
    }
}
