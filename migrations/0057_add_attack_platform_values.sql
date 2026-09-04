-- Migration: Add missing attack_platform enum values for MITRE ATT&CK STIX import
-- Date: 2026-09-03
-- Description:
--   The upstream enterprise-attack.json STIX bundle contains 8 platform values
--   not present in the original enum: Android, iOS, ESXi, Network Devices,
--   Office Suite, Identity Provider, Engineering Workstation, and
--   Field Controller/RTU/PLC/IED. Without these values, 288 objects
--   (236 attack-patterns, 47 malware, 5 tools) fail to import because
--   PostgreSQL rejects the insert into the attack_platform[] column.
--
-- Postgres rule: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block. Each ALTER lives on its own statement so the migration runner can
-- replay individually without wrapping in BEGIN/COMMIT.

ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'Android';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'iOS';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'ESXi';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'Network Devices';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'Office Suite';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'Identity Provider';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'Engineering Workstation';
ALTER TYPE "public"."attack_platform" ADD VALUE IF NOT EXISTS 'Field Controller/RTU/PLC/IED';
