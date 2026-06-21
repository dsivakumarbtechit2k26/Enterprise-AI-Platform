---
name: spatie/laravel-activitylog version quirks
description: Namespace and API differences from the installed version of spatie/laravel-activitylog
---

## Rule
The installed version of `spatie/laravel-activitylog` has non-standard class locations compared to older docs.

**Why:** Installed version moved traits and options into different namespaces from the ones commonly documented online.

## How to apply

- **LogsActivity trait**: `Spatie\Activitylog\Models\Concerns\LogsActivity` (NOT `Spatie\Activitylog\Traits\LogsActivity`)
- **LogOptions class**: `Spatie\Activitylog\Support\LogOptions` (NOT `Spatie\Activitylog\LogOptions`)
- **dontSubmitEmptyLogs() removed**: use `dontLogEmptyChanges()` instead
- **attribute_changes column**: required by this version but missing from the old migration — added via `2026_06_21_200000_add_attribute_changes_to_activity_log_table.php`
- `activity()` helper function works normally for manual log entries
