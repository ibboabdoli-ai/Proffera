-- Wave C pilot: prove transaction-local Workspace RLS on one read-only Dashboard path.
-- The application still connects with neondb_owner today; the pilot path explicitly
-- SET LOCAL ROLEs into this non-BYPASSRLS role inside the same transaction that sets
-- app.workspace_id and reads customers.

CREATE ROLE proffera_tenant_rls
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

GRANT proffera_tenant_rls TO neondb_owner;
GRANT USAGE ON SCHEMA public TO proffera_tenant_rls;
GRANT SELECT ON TABLE public.customers TO proffera_tenant_rls;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

CREATE POLICY customers_workspace_select_rls
  ON public.customers
  FOR SELECT
  TO proffera_tenant_rls
  USING (workspace_id = current_setting('app.workspace_id', true));
