---
name: Tenancy purgeTenantConnection driver bug
description: stancl/tenancy v3 DatabaseManager::purgeTenantConnection() removes config['database.connections.tenant'], then DatabaseConfig::manager() tries to read config('database.connections.tenant.driver') and gets null/empty string, throwing DatabaseManagerNotRegisteredException.
---

## The Rule
Set `template_tenant_connection` in `config/tenancy.php` to `'pgsql'` (or any connection other than `'tenant'`). Never use `'tenant'` as the template connection.

**Why:** `DatabaseManager::purgeTenantConnection()` unsets `$this->config['database.connections.tenant']` to clean up the current tenant connection. Immediately after, `createTenantConnection()` calls `$tenant->database()->connection()` which calls `$tenant->database()->manager()` which looks up `config("database.connections.{getTemplateConnectionName()}.driver")`. If `getTemplateConnectionName()` returns `'tenant'` (the default), the driver lookup returns null → empty string → `DatabaseManagerNotRegisteredException` with blank driver.

**How to apply:** In `config/tenancy.php`:
```php
'database' => [
    'central_connection' => 'central',
    'template_tenant_connection' => 'pgsql', // NOT 'tenant'
    ...
]
```

This works because `purgeTenantConnection()` hardcodes the purge of `'tenant'`, leaving `'pgsql'` intact in the config. The `PostgreSQLSchemaManager::makeConnectionConfig()` sets `$baseConfig['search_path'] = $databaseName` to point the tenant connection at the correct schema.
