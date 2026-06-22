<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Security Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: #f5f5f5; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: #c53030; padding: 32px 40px; }
        .header.billing { background: #d97706; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }
        .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
        .body { padding: 40px; }
        .body p { line-height: 1.7; margin: 0 0 16px; color: #2d3748; }
        .alert-box { border-left: 4px solid #c53030; background: #fff5f5; padding: 16px 20px; border-radius: 0 4px 4px 0; margin: 24px 0; }
        .alert-box.billing { border-color: #d97706; background: #fffbeb; }
        .alert-box strong { color: #c53030; }
        .alert-box.billing strong { color: #d97706; }
        .details { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 6px 0; vertical-align: top; font-size: 14px; }
        .details td:first-child { font-weight: 600; color: #4a5568; width: 40%; padding-right: 12px; }
        .details td:last-child { color: #2d3748; font-family: 'Courier New', monospace; word-break: break-all; }
        .footer { background: #f7f7f7; padding: 20px 40px; font-size: 13px; color: #718096; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header{{ $alertType === 'payment_failed' ? ' billing' : '' }}">
        <h1>{{ config('app.name') }}</h1>
        <p>
            @if ($alertType === 'payment_failed')
                Billing Alert
            @else
                Security Alert
            @endif
        </p>
    </div>

    <div class="body">
        @if ($alertType === 'login_failure')
            <p>Hello,</p>
            <p>
                A user account has reached <strong>{{ $context['failure_count'] }} consecutive failed login attempts</strong>,
                which meets the configured alert threshold ({{ $context['threshold'] }}).
                This may indicate a brute-force or credential-stuffing attack.
            </p>
            <div class="alert-box">
                <strong>Action recommended:</strong> Review this account and consider resetting the password or contacting the user.
            </div>
            <div class="details">
                <table>
                    <tr>
                        <td>User</td>
                        <td>{{ $context['user']->name }} &lt;{{ $context['user']->email }}&gt;</td>
                    </tr>
                    <tr>
                        <td>Failed Attempts</td>
                        <td>{{ $context['failure_count'] }}</td>
                    </tr>
                    <tr>
                        <td>Alert Threshold</td>
                        <td>{{ $context['threshold'] }}</td>
                    </tr>
                    <tr>
                        <td>IP Address</td>
                        <td>{{ $context['ip_address'] }}</td>
                    </tr>
                    <tr>
                        <td>Detected At</td>
                        <td>{{ $timestamp }}</td>
                    </tr>
                </table>
            </div>

        @elseif ($alertType === 'account_locked')
            <p>Hello,</p>
            <p>
                A user account has been <strong>automatically locked</strong> due to too many consecutive failed login attempts.
                The account will remain locked for 15 minutes.
            </p>
            <div class="alert-box">
                <strong>Action recommended:</strong> If this was not the legitimate account owner, consider resetting credentials.
            </div>
            <div class="details">
                <table>
                    <tr>
                        <td>User</td>
                        <td>{{ $context['user']->name }} &lt;{{ $context['user']->email }}&gt;</td>
                    </tr>
                    <tr>
                        <td>IP Address</td>
                        <td>{{ $context['ip_address'] }}</td>
                    </tr>
                    <tr>
                        <td>Locked At</td>
                        <td>{{ $timestamp }}</td>
                    </tr>
                    <tr>
                        <td>Unlocks At</td>
                        <td>{{ $context['user']->locked_until?->toDateTimeString() . ' UTC' ?? 'N/A' }}</td>
                    </tr>
                </table>
            </div>

        @elseif ($alertType === 'payment_failed')
            <p>Hello,</p>
            <p>
                A payment failure has been recorded for a tenant on the platform.
                @if ($context['attempt_count'] === 1)
                    Dunning emails are being sent to the tenant's billing contact.
                @else
                    This is attempt <strong>#{{ $context['attempt_count'] }}</strong>.
                @endif
            </p>
            <div class="alert-box billing">
                <strong>Note:</strong> The tenant's access will be restricted if the payment is not resolved.
            </div>
            <div class="details">
                <table>
                    <tr>
                        <td>Tenant</td>
                        <td>{{ $context['tenant']->name }} (ID: {{ $context['tenant']->id }})</td>
                    </tr>
                    <tr>
                        <td>Invoice ID</td>
                        <td>{{ $context['invoice_id'] }}</td>
                    </tr>
                    <tr>
                        <td>Attempt</td>
                        <td>#{{ $context['attempt_count'] }}</td>
                    </tr>
                    <tr>
                        <td>Detected At</td>
                        <td>{{ $timestamp }}</td>
                    </tr>
                </table>
            </div>
        @endif

        <p>Please review the <strong>audit log</strong> in the admin console for full event history.</p>
        <p>— The {{ config('app.name') }} Platform</p>
    </div>

    <div class="footer">
        This is an automated security notification. You are receiving it because you are configured
        as a platform alert recipient. To change alert settings, visit the Admin → Settings panel.
    </div>
</div>
</body>
</html>
