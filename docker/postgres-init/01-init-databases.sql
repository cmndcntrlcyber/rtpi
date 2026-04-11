-- RTPI Database Initialization Script
-- Runs once on first PostgreSQL startup (empty data volume)
-- Creates additional databases for SysReptor integration

-- SysReptor database and user
CREATE DATABASE sysreptor;
CREATE USER sysreptor WITH PASSWORD 'sysreptorpassword';
GRANT ALL PRIVILEGES ON DATABASE sysreptor TO sysreptor;

-- Enable uuid-ossp extension in all databases
\c sysreptor;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c rtpi_main;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

\echo 'Database initialization completed successfully';
