CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat real,
  lng real,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their stores"
  ON public.stores FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.kiosk_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  allowed_apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  lock_screen boolean NOT NULL DEFAULT false,
  disable_settings boolean NOT NULL DEFAULT true,
  disable_play_store boolean NOT NULL DEFAULT true,
  volume_limit int DEFAULT 80,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_policies TO authenticated;
GRANT ALL ON public.kiosk_policies TO service_role;
ALTER TABLE public.kiosk_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their policies"
  ON public.kiosk_policies FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  model text,
  android_version text,
  serial_number text,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  api_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'disabled')),
  last_seen_at timestamptz,
  battery_level int,
  current_app text,
  kiosk_mode boolean NOT NULL DEFAULT false,
  policy_id uuid REFERENCES public.kiosk_policies(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their devices"
  ON public.devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('lock','unlock','reboot','screenshot','open_app','install_app','uninstall_app','set_policy','set_volume','send_message','clear_cache','set_kiosk_mode')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','executing','completed','failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  executed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_commands TO authenticated;
GRANT ALL ON public.device_commands TO service_role;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage commands on their devices"
  ON public.device_commands FOR ALL
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
  WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE TABLE public.device_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  battery_level int,
  battery_charging boolean DEFAULT false,
  cpu_usage real,
  memory_used_mb int,
  memory_total_mb int,
  storage_used_mb int,
  storage_total_mb int,
  current_app text,
  network_type text,
  ip_address text,
  latitude real,
  longitude real,
  wifi_strength int,
  uptime_seconds bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_telemetry TO authenticated;
GRANT ALL ON public.device_telemetry TO service_role;
ALTER TABLE public.device_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view telemetry on their devices"
  ON public.device_telemetry FOR ALL
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
  WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE TABLE public.device_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  width int,
  height int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_screenshots TO authenticated;
GRANT ALL ON public.device_screenshots TO service_role;
ALTER TABLE public.device_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage screenshots on their devices"
  ON public.device_screenshots FOR ALL
  TO authenticated
  USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
  WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_screenshots;

CREATE INDEX idx_commands_device_status ON public.device_commands (device_id, status);
CREATE INDEX idx_telemetry_device_created ON public.device_telemetry (device_id, created_at DESC);
CREATE INDEX idx_screenshots_device_created ON public.device_screenshots (device_id, created_at DESC);
CREATE INDEX idx_devices_user ON public.devices (user_id);
CREATE INDEX idx_devices_store ON public.devices (store_id);