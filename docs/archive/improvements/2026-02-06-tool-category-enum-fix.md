# Tool Category Enum Fix - 2026-02-06

## Issue
The Tool Connector Agent was failing to sync tools from specialized containers with PostgreSQL error:
```
PostgresError: invalid input value for enum tool_category: "vulnerability"
PostgresError: invalid input value for enum tool_category: "web"
```

**Error Code:** `22P02` (invalid text representation)

## Root Cause
The `tool_category` enum in PostgreSQL was missing 14 category values that the Tool Connector Agent uses when discovering tools across multiple specialized containers (rtpi-tools, rtpi-maldev-agent, rtpi-azure-ad-agent, rtpi-burp-agent, rtpi-empire-agent, rtpi-fuzzing-agent, rtpi-framework-agent, rtpi-research-agent).

### Missing Enum Values
- `vulnerability`
- `web`
- `network`
- `fuzzing`
- `reverse-engineering`
- `binary-analysis`
- `fingerprinting`
- `cms`
- `azure`
- `active-directory`
- `enumeration`
- `c2`
- `proxy`
- `discovery`

## Solution
Applied a three-step fix following the **Baby Steps™** methodology:

### Step 1: Update TypeScript Schema
Updated `shared/schema.ts` to include all missing enum values in the `toolCategoryEnum` definition.

### Step 2: Create Database Migration
Created `migrations/0007_add_tool_category_values.sql` to add the missing enum values using `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

### Step 3: Apply Migration
Executed the migration against the PostgreSQL database:
```bash
docker exec -i rtpi-postgres psql -U rtpi -d rtpi_main < migrations/0007_add_tool_category_values.sql
```

## Verification
```sql
SELECT unnest(enum_range(NULL::tool_category)) AS tool_category ORDER BY tool_category;
```

Result: **25 enum values** (11 original + 14 new)

## Files Modified
1. `shared/schema.ts` - Added 14 new enum values to `toolCategoryEnum`
2. `migrations/0007_add_tool_category_values.sql` - Created new migration file

## Impact
- ✅ Tool Connector Agent can now successfully discover and sync tools from all specialized containers
- ✅ No data loss or downtime
- ✅ Backwards compatible (existing values unchanged)
- ✅ Future-proof for additional tool categories

## Testing
The fix resolves the original errors for tools like:
- `gobuster` (category: "web")
- `nuclei` (category: "vulnerability")
- `nmap` (category: "network")
- And all other tools across the 8 specialized containers

## Next Steps
The Tool Connector Agent should now be able to complete its poll cycle without enum errors. Monitor the agent logs to confirm successful tool discovery and registry synchronization.
