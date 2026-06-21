<?php

declare(strict_types=1);

namespace App\Traits;

use App\Models\FieldPermission;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\PermissionRegistrar;

/**
 * Trait for Eloquent models that need field-level access control.
 *
 * Add to a model:
 *   use AppliesFieldPermissions;
 *
 * In serialization (e.g. a Resource), call $model->visibleFields() to get
 * only the fields the current user is allowed to read, and
 * $model->writableFields() to determine which fields they can write.
 */
trait AppliesFieldPermissions
{
    /**
     * Returns the list of field names the current user can read.
     * If no specific field restrictions exist for any of the user's roles,
     * all fields are returned (open by default).
     */
    public function visibleFields(): array
    {
        $user = Auth::user();
        if (! $user) {
            return $this->getFillable();
        }

        $teamId    = app(PermissionRegistrar::class)->getPermissionsTeamId();
        $modelClass = static::class;
        $roleIds   = $user->roles()->pluck('id')->toArray();

        if (empty($roleIds)) {
            return $this->getFillable();
        }

        $restrictions = FieldPermission::where('model_class', $modelClass)
            ->where(fn ($q) => $q->whereNull('team_id')->orWhere('team_id', $teamId))
            ->whereIn('role_id', $roleIds)
            ->where('can_read', false)
            ->pluck('field_name')
            ->unique()
            ->toArray();

        return array_values(array_diff($this->getFillable(), $restrictions));
    }

    /**
     * Returns the list of field names the current user can write/update.
     */
    public function writableFields(): array
    {
        $user = Auth::user();
        if (! $user) {
            return $this->getFillable();
        }

        $teamId    = app(PermissionRegistrar::class)->getPermissionsTeamId();
        $modelClass = static::class;
        $roleIds   = $user->roles()->pluck('id')->toArray();

        if (empty($roleIds)) {
            return $this->getFillable();
        }

        // Fields explicitly marked can_write = false for ANY of the user's roles are blocked
        $blocked = FieldPermission::where('model_class', $modelClass)
            ->where(fn ($q) => $q->whereNull('team_id')->orWhere('team_id', $teamId))
            ->whereIn('role_id', $roleIds)
            ->where('can_write', false)
            ->pluck('field_name')
            ->unique()
            ->toArray();

        return array_values(array_diff($this->getFillable(), $blocked));
    }
}
