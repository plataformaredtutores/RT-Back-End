-- Rename enum values in-place to preserve existing rows
-- This avoids dropping/recreating the enum (which would fail while old values exist).
ALTER TYPE "public"."AccountType" RENAME VALUE 'ahorro' TO 'AHORRO';
ALTER TYPE "public"."AccountType" RENAME VALUE 'corriente' TO 'CORRIENTE';
ALTER TYPE "public"."AccountType" RENAME VALUE 'vista' TO 'VISTA';
