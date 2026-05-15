-- Postgres extensions required by Kasm Workspaces.
-- Loaded once on first init via /docker-entrypoint-initdb.d/.
-- The kasmweb/api startup.sh only creates uuid-ossp when it creates the
-- database itself, but the postgres image pre-creates POSTGRES_DB=kasm,
-- so that path is skipped and the extension is missing without this file.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
