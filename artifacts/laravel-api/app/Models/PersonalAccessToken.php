<?php

declare(strict_types=1);

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumToken;

class PersonalAccessToken extends SanctumToken
{
    protected $connection = 'central';
}
