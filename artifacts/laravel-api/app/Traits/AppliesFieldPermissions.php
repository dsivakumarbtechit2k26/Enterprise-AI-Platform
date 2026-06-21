<?php

declare(strict_types=1);

namespace App\Traits;

use App\Models\FieldPermission;
use Database\Seeders\RbacSeeder;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\PermissionRegistrar;

/**
 * Trait for Eloquent models that need field-level access control.
 *
 * Usage: add `use AppliesFieldPermissions;` to any Eloquent model.
 *
 * Behaviour:
 *  - toArray() / jsonSerialize() automatically redacts fields the current
 *    authenticated user cannot read (can_read = false for their role).
 *  - writableFields() returns the subset of fillable fields the user may write.
 *  - visibleFields() returns the subset of fillable fields the user may read.
 *
 * Field permissions are stored with team_id = RbacSeeder::CENTRAL_TEAM ('central')
 * for platform-wide rules, or a specific tenant slug for tenant-level overrides.
 * Both layers are applied together (most restrictive wins across roles).
 */
trait AppliesFieldPermissions
{
    // ── Automatic serialization redaction ─────────────────────────────────────

    /**
     * Override toArray() to strip fields the authenticated user cannot read.
     * Falls back to the parent implementation when there are no restrictions.
     */
    public function toArray(): array
    {
        $base = parent::toArray();

        $user = Auth::user();
        if (! $user) {
            return $base;
        }

        $hidden = $this->hiddenFields();
        if (empty($hidden)) {
            return $base;
        }

        return array_diff_key($base, array_flip($hidden));
    }

    // ── Helpers for controllers / resources that need explicit lists ──────────

    /**
     * Field names the current user CANNOT read (for any of their active roles).
     */
    public function hiddenFields(): array
    {
        $user = Auth::user();
        if (! $user) {
            return [];
        }

        $teamId    = app(PermissionRegistrar::class)->getPermissionsTeamId();
        $roleIds   = $user->roles()->pluck('id')->toArray();

        if (empty($roleIds)) {
            return [];
        }

        return FieldPermission::where('model_class', static::class)
            ->where(fn ($q) => $q
                ->where('team_id', RbacSeeder::CENTRAL_TEAM)
                ->orWhere('team_id', $teamId)
            )
            ->whereIn('role_id', $roleIds)
            ->where('can_read', false)
            ->pluck('field_name')
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * Field names the current user CAN read.
     * Returns all fillable fields minus those with can_read = false for any role.
     */
    public function visibleFields(): array
    {
        return array_values(array_diff($this->getFillable(), $this->hiddenFields()));
    }

    /**
     * Field names the current user CAN write.
     * Fields with can_write = false for any of the user's roles are excluded.
     */
    public function writableFields(): array
    {
        $user = Auth::user();
        if (! $user) {
            return $this->getFillable();
        }

        $teamId  = app(PermissionRegistrar::class)->getPermissionsTeamId();
        $roleIds = $user->roles()->pluck('id')->toArray();

        if (empty($roleIds)) {
            return $this->getFillable();
        }

        $blocked = FieldPermission::where('model_class', static::class)
            ->where(fn ($q) => $q
                ->where('team_id', RbacSeeder::CENTRAL_TEAM)
                ->orWhere('team_id', $teamId)
            )
            ->whereIn('role_id', $roleIds)
            ->where('can_write', false)
            ->pluck('field_name')
            ->unique()
            ->values()
            ->toArray();

        return array_values(array_diff($this->getFillable(), $blocked));
    }
}
