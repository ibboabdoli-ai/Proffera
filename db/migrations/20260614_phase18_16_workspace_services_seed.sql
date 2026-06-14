-- Phase 18.16A default workspace services

insert into workspace_services (workspace_id, name, description, category, price_label, base_price_sek, duration_minutes, service_area, is_active, sort_order)
values
  ('default', 'Demo / konsultation', 'Kort genomgång av företagets boknings- och leadflöde.', 'SaaS', 'Boka demo', null, 30, 'Online / Stockholm', true, 10),
  ('default', 'Leadhantering', 'Hantering av inkommande förfrågningar och kunddialog.', 'CRM', 'Offert', null, null, 'Sverige', true, 20),
  ('default', 'Bokningsflöde', 'Digital bokningsvy för tider, kunder och status.', 'Bokning', 'Offert', null, null, 'Sverige', true, 30)
on conflict (workspace_id, name) do nothing;
