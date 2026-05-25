# Design Decision: Role Representation in Database (Option A)

This document records the architectural decision made regarding the implementation of user roles in the Pendacare caregiving management system.

## The Context

Pendacare requires a robust and secure role-based access control (RBAC) system. The application defines exactly four distinct roles:
1. `admin`
2. `caregiver`
3. `client`
4. `family_member`

During the planning phase, three distinct options for representing these roles in the PostgreSQL/Supabase database were analyzed and compared:

*   **Option A**: Keep the existing schema using the `TEXT` type with a `CHECK` constraint (Recommended).
*   **Option B**: Hardening the schema by using a PostgreSQL custom `ENUM` type.
*   **Option C**: Creating a separate `roles` lookup table to allow DB-managed role metadata.

---

## Decision and Rationale

On May 23, 2026, **Option A** was approved and confirmed for implementation.

### Why Option A was Selected

1.  **High Maintainability & Safe Migrations**: 
    PostgreSQL custom `ENUM` types are notoriously difficult to modify in the future (e.g., removing a value or renaming a value requires multiple SQL statements and cannot run inside transaction blocks in older PG versions). 
    In contrast, updating a `CHECK` constraint on a `TEXT` column is a simple and extremely safe operation:
    ```sql
    ALTER TABLE users DROP CONSTRAINT users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'caregiver', 'client', 'family_member', 'new_role'));
    ```

2.  **Seamless Integration with App-Tier Tools**: 
    JavaScript/TypeScript client libraries (like `@supabase/supabase-js`) treat `TEXT` as standard strings. This allows mapping the column directly to a TypeScript union type (`'admin' | 'caregiver' | 'client' | 'family_member'`) in `src/lib/types.ts` without requiring custom database deserializers or type casting.

3.  **Robust Data Integrity**:
    The database still actively protects against malformed role names or typos because the `CHECK` constraint will reject any INSERT or UPDATE containing values outside the defined array.

4.  **Alignment with Supabase Best Practices**:
    The official Supabase developer guidelines explicitly recommend using `TEXT` with `CHECK` constraints for static domain enums to avoid database lockups and migration failures.

5.  **Simplicity**:
    Option C (Lookup table) was deemed overengineered since the roles are static and do not have dynamic metadata (such as custom permissions lists) managed by database queries. Avoiding joins keeps both database queries and Row-Level Security (RLS) policies clean and highly performant.

---

## Implementation Details

### Database Schema Definition
The `role` column in the `users` table is defined inside `supabase/migrations/20250101000001_create_tables.sql` as:

```sql
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('admin', 'caregiver', 'client', 'family_member')),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  contact_info JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### TypeScript Types
The role is typed as a union of string literals in `src/lib/types.ts` (or `src/lib/types/auth.ts`):

```typescript
export type UserRole = 'admin' | 'caregiver' | 'client' | 'family_member';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
```

---

## Guidelines for Modifying Roles in the Future

If a new role needs to be added (e.g., `'service_coordinator'`), follow these steps:

1.  **Create a New Migration File**:
    Generate a new SQL migration in `supabase/migrations/` to update the `CHECK` constraint:
    ```sql
    ALTER TABLE users DROP CONSTRAINT users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'caregiver', 'client', 'family_member', 'service_coordinator'));
    ```
2.  **Update TypeScript Definitions**:
    Add the new role literal to `UserRole` in `src/lib/types.ts`:
    ```typescript
    export type UserRole = 'admin' | 'caregiver' | 'client' | 'family_member' | 'service_coordinator';
    ```
3.  **Update Middlewares & RBAC Configurations**:
    Ensure the HOCs and route protections (like `src/lib/middleware/protectedRoutes.ts`) are updated to handle or allow the new role.
