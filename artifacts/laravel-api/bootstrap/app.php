<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
            \App\Http\Middleware\SecurityHeadersMiddleware::class,
        ]);

        // Sanctum SPA cookie-based auth for registered stateful domains
        $middleware->statefulApi();

        $middleware->alias([
            'account.not.locked' => \App\Http\Middleware\EnsureAccountNotLocked::class,
            'platform.admin'     => \App\Http\Middleware\EnsurePlatformAdminKey::class,
            'require.admin'      => \App\Http\Middleware\RequireAdminAccess::class,
            'auth'               => \App\Http\Middleware\Authenticate::class,
            'permission'         => \App\Http\Middleware\CheckPermission::class,
            'role'               => \App\Http\Middleware\CheckRole::class,
            'tenant.permissions' => \App\Http\Middleware\ResolveTenantPermissions::class,
            'plan_feature'       => \App\Http\Middleware\CheckPlanFeature::class,
            'check_quota'        => \App\Http\Middleware\CheckQuota::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->wantsJson(),
        );

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/validation',
                    'title'  => 'Validation Error',
                    'status' => Response::HTTP_UNPROCESSABLE_ENTITY,
                    'detail' => 'One or more fields failed validation.',
                    'errors' => $e->errors(),
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/unauthenticated',
                    'title'  => 'Unauthenticated',
                    'status' => Response::HTTP_UNAUTHORIZED,
                    'detail' => 'Authentication is required to access this resource.',
                ], Response::HTTP_UNAUTHORIZED);
            }
        });

        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/forbidden',
                    'title'  => 'Forbidden',
                    'status' => Response::HTTP_FORBIDDEN,
                    'detail' => $e->getMessage() ?: 'You do not have permission to perform this action.',
                ], Response::HTTP_FORBIDDEN);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/not-found',
                    'title'  => 'Not Found',
                    'status' => Response::HTTP_NOT_FOUND,
                    'detail' => 'The requested resource could not be found.',
                ], Response::HTTP_NOT_FOUND);
            }
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/method-not-allowed',
                    'title'  => 'Method Not Allowed',
                    'status' => Response::HTTP_METHOD_NOT_ALLOWED,
                    'detail' => 'The HTTP method used is not allowed for this endpoint.',
                ], Response::HTTP_METHOD_NOT_ALLOWED);
            }
        });

        $exceptions->render(function (HttpException $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/http-error',
                    'title'  => Response::$statusTexts[$e->getStatusCode()] ?? 'HTTP Error',
                    'status' => $e->getStatusCode(),
                    'detail' => $e->getMessage() ?: 'An HTTP error occurred.',
                ], $e->getStatusCode());
            }
        });

        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return response()->json([
                    'type'   => 'https://platform.local/errors/server-error',
                    'title'  => 'Internal Server Error',
                    'status' => Response::HTTP_INTERNAL_SERVER_ERROR,
                    'detail' => config('app.debug')
                        ? $e->getMessage()
                        : 'An unexpected error occurred. Please try again later.',
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            }
        });
    })->create();
