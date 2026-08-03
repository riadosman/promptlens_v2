#!/usr/bin/env sh
set -eu

if [ -z "${POSTGRES_APP_PASSWORD:-}" ]; then
  echo 'POSTGRES_APP_PASSWORD is required.' >&2
  exit 1
fi
if [ -z "${POSTGRES_WORKER_PASSWORD:-}" ]; then
  echo 'POSTGRES_WORKER_PASSWORD is required.' >&2
  exit 1
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$POSTGRES_APP_PASSWORD" --set=worker_password="$POSTGRES_WORKER_PASSWORD" <<-'SQL'
SELECT format('CREATE ROLE promptlens_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'promptlens_app') \gexec
SELECT format('ALTER ROLE promptlens_app PASSWORD %L', :'app_password') \gexec

ALTER ROLE promptlens_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
SELECT format('CREATE ROLE promptlens_worker LOGIN PASSWORD %L', :'worker_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'promptlens_worker') \gexec
SELECT format('ALTER ROLE promptlens_worker PASSWORD %L', :'worker_password') \gexec
ALTER ROLE promptlens_worker NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT CONNECT ON DATABASE promptlens TO promptlens_app;
GRANT CONNECT ON DATABASE promptlens TO promptlens_worker;
GRANT USAGE ON SCHEMA public TO promptlens_app;
GRANT USAGE ON SCHEMA public TO promptlens_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE promptlens_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO promptlens_app;
ALTER DEFAULT PRIVILEGES FOR ROLE promptlens_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO promptlens_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE promptlens_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO promptlens_app;
ALTER DEFAULT PRIVILEGES FOR ROLE promptlens_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO promptlens_worker;
SQL
