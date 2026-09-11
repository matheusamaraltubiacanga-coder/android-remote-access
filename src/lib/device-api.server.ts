// Server-only helper for Android device API authentication.
// Never imported by client code — .server.ts blocks client bundling.

export type DeviceRecord = {
  id: string;
  device_name: string;
  model: string | null;
  android_version: string | null;
  serial_number: string | null;
  store_id: string | null;
  api_key: string;
  status: string;
  last_seen_at: string | null;
  battery_level: number | null;
  current_app: string | null;
  kiosk_mode: boolean;
  policy_id: string | null;
  user_id: string;
  created_at: string;
};

export async function verifyDeviceApiKey(
  apiKey: string,
): Promise<DeviceRecord | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("*")
    .eq("api_key", apiKey)
    .neq("status", "disabled")
    .single();
  if (error || !data) return null;
  return data as DeviceRecord;
}

export async function updateDeviceSeen(deviceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("devices")
    .update({ last_seen_at: new Date().toISOString(), status: "online" })
    .eq("id", deviceId);
}
