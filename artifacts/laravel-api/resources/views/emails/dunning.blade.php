<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment Notice</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: #f5f5f5; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: #1a1a2e; padding: 32px 40px; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }
        .body { padding: 40px; }
        .body p { line-height: 1.7; margin: 0 0 16px; }
        .alert { border-left: 4px solid #e53e3e; background: #fff5f5; padding: 16px 20px; border-radius: 4px; margin: 24px 0; }
        .alert.warning { border-color: #dd6b20; background: #fffaf0; }
        .alert.final { border-color: #c53030; background: #fff5f5; }
        .btn { display: inline-block; background: #667eea; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 24px 0; }
        .footer { background: #f7f7f7; padding: 20px 40px; font-size: 13px; color: #718096; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h1>{{ config('app.name') }}</h1>
    </div>
    <div class="body">
        @if ($attemptNumber === 1)
            <p>Hi there,</p>
            <p>We attempted to charge your card for your <strong>{{ config('app.name') }}</strong> subscription for the workspace <strong>{{ $tenant->name }}</strong>, but the payment was declined.</p>
            <div class="alert">
                <strong>Payment failed.</strong> Please update your payment method to avoid any service interruption.
            </div>
        @elseif ($attemptNumber === 2)
            <p>Hi there,</p>
            <p>We've made a second attempt to collect payment for <strong>{{ $tenant->name }}</strong>'s subscription, but it was unsuccessful again.</p>
            <div class="alert warning">
                <strong>Second payment attempt failed.</strong> Your account may be restricted if payment isn't resolved soon.
            </div>
        @else
            <p>Hi there,</p>
            <p>This is your final notice regarding the outstanding payment for <strong>{{ $tenant->name }}</strong>. After one more failed attempt, your account will be automatically downgraded to the Free plan.</p>
            <div class="alert final">
                <strong>Final notice.</strong> Update your payment method immediately to keep full access to your account.
            </div>
        @endif

        <p>To update your payment method and resolve this issue, click the button below:</p>

        <a href="{{ $billingUrl }}" class="btn">Update Payment Method</a>

        <p>If you have any questions or need assistance, please contact our support team.</p>
        <p>Thank you,<br>The {{ config('app.name') }} Team</p>
    </div>
    <div class="footer">
        You are receiving this because you manage the workspace <em>{{ $tenant->name }}</em>.
        If you believe this is in error, please contact support.
    </div>
</div>
</body>
</html>
