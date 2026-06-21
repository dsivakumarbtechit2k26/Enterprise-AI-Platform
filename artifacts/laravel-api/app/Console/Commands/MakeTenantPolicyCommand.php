<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Artisan generator for tenant-scoped policy classes.
 *
 * Usage:
 *   php artisan make:tenant-policy Customer
 *   php artisan make:tenant-policy Invoice --resource=invoices
 */
class MakeTenantPolicyCommand extends Command
{
    protected $signature = 'make:tenant-policy
        {name : Policy class name (e.g. Customer)}
        {--resource= : Permission resource name (defaults to snake_case plural of name)}';

    protected $description = 'Generate a tenant-scoped policy that extends TenantPolicy';

    public function handle(): int
    {
        $name     = $this->argument('name');
        $resource = $this->option('resource') ?? Str::snake(Str::plural($name));
        $class    = Str::studly($name) . 'Policy';
        $path     = app_path("Policies/{$class}.php");

        if (file_exists($path)) {
            $this->error("Policy [{$class}] already exists.");
            return self::FAILURE;
        }

        $stub = $this->buildStub($class, $resource);

        file_put_contents($path, $stub);

        $this->info("Policy [{$class}] created: app/Policies/{$class}.php");
        $this->line("  Resource key: <comment>{$resource}</comment>");
        $this->line("  Register in AppServiceProvider::boot() →");
        $this->line("  <comment>Gate::policy(\\App\\Models\\{$name}::class, \\App\\Policies\\{$class}::class);</comment>");

        return self::SUCCESS;
    }

    private function buildStub(string $class, string $resource): string
    {
        return <<<PHP
<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

class {$class} extends TenantPolicy
{
    protected function resource(): string
    {
        return '{$resource}';
    }

    /*
     * Override any method from TenantPolicy to customise behaviour.
     *
     * Example — only the record owner can update:
     *
     * public function update(User \$user, mixed \$model): bool
     * {
     *     return parent::update(\$user, \$model)
     *         && \$model->user_id === \$user->id;
     * }
     */
}
PHP;
    }
}
