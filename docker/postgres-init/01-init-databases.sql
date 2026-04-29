-- RTPI Database Initialization Script
-- Runs once on first PostgreSQL startup (empty data volume)
-- Creates additional databases for SysReptor integration

-- SysReptor database and user
CREATE DATABASE sysreptor;
CREATE USER sysreptor WITH PASSWORD 'Yu4fDzCVtqDogPOusrdeWNdf29NvpewU';
GRANT ALL PRIVILEGES ON DATABASE sysreptor TO sysreptor;

-- Enable uuid-ossp extension in all databases
\c sysreptor;
-- PG 15+ locks the public schema for non-owners; hand it to sysreptor so Django migrations can create tables.
ALTER SCHEMA public OWNER TO sysreptor;
GRANT ALL ON SCHEMA public TO sysreptor;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Docmost database and user (v2.9.1 Phase 8)
\c postgres;
CREATE DATABASE docmost;
CREATE USER docmost WITH PASSWORD 'docmostpassword';
GRANT ALL PRIVILEGES ON DATABASE docmost TO docmost;
\c docmost;
ALTER SCHEMA public OWNER TO docmost;
GRANT ALL ON SCHEMA public TO docmost;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c rtpi_main;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

\echo 'Database initialization completed successfully';
