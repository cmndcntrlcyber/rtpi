-- Migration: Add missing tool_category enum values
-- Date: 2026-02-06
-- Description: Adds additional tool categories for specialized tool containers

-- Add missing tool_category enum values
-- Note: Each ALTER TYPE ADD VALUE must be in a separate statement
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'vulnerability';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'web';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'network';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'fuzzing';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'reverse-engineering';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'binary-analysis';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'fingerprinting';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'cms';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'azure';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'active-directory';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'enumeration';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'c2';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'proxy';
ALTER TYPE "public"."tool_category" ADD VALUE IF NOT EXISTS 'discovery';
