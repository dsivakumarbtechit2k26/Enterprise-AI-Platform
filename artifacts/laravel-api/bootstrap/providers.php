<?php

use App\Providers\AppServiceProvider;
use App\Providers\TenancyServiceProvider;

return [
    AppServiceProvider::class,
    TenancyServiceProvider::class,
    Laravel\Sanctum\SanctumServiceProvider::class,
    Laravel\Fortify\FortifyServiceProvider::class,
    Laravel\Socialite\SocialiteServiceProvider::class,
    App\Providers\FortifyAuthServiceProvider::class,
];
