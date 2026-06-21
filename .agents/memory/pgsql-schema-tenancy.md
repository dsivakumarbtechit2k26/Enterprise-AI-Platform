---
name: PostgreSQL schema-based tenancy
description: The platform uses PostgreSQL schema isolation. Central tables live in the `central` schema, tenant tables live in `tenant_{id}` schemas (created automatically by stancl/tenancy's PostgreSQLSchemaManager).
---

## The Rule
Create the `central` schema with raw SQL before running central migrations. All central migrations must explicitly set `protected $connection = 'central'` OR use `Schema::connection('central')`.

**Why:** PostgreSQL's default connection points to the `public` schema. The `central` connection has `search_path = 'central'` set in `config/database.php`. If the `central` schema doesn't exist yet, the first migration (creating the `migrations` table) fails with "no schema has been selected to create in".

**How to apply:**
1. Before first-time migration, run: `DB::connection('pgsql')->statement('CREATE SCHEMA IF NOT EXISTS central');`
2. Central migrations use `Schema::connection('central')->create(...)` or set `protected $connection = 'central'` on the Migration class.
3. Tenant migrations run without explicit connection (they inherit the tenant schema's `search_path` via `PostgreSQLSchemaManager::makeConnectionConfig()`).
4. Tenant schema name pattern: `tenant_{tenant_id}` (e.g., `tenant_acme`).
5. The `pgsql` connection (search_path = public) is used for raw schema management queries only.

**Database config:**
- `central`: `search_path = 'central'` — all platform tables
- `tenant`: runtime connection overridden per-tenant by `PostgreSQLSchemaManager` (search_path = tenant schema name)
- `pgsql`: `search_path = 'public'` — template for tenant connections (template_tenant_connection)
