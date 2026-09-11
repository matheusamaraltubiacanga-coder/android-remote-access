import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeviceWithRelations = {
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
  stores: { id: string; name: string } | null;
  kiosk_policies: { id: string; name: string } | null;
};

// ─── Dashboard stats ──────────────────────────────────────────────
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: devices } = await context.supabase
      .from("devices")
      .select("id, status, battery_level, kiosk_mode")
      .eq("user_id", context.userId);

    const deviceIds = devices?.map((d) => d.id) ?? [];
    const total = devices?.length ?? 0;
    const online = devices?.filter((d) => d.status === "online").length ?? 0;
    const offline = devices?.filter((d) => d.status === "offline").length ?? 0;
    const kiosk = devices?.filter((d) => d.kiosk_mode).length ?? 0;

    let pendingCommands = 0;
    if (deviceIds.length > 0) {
      const { count } = await context.supabase
        .from("device_commands")
        .select("id", { count: "exact", head: true })
        .in("device_id", deviceIds)
        .eq("status", "pending");
      pendingCommands = count ?? 0;
    }

    return { total, online, offline, kiosk, pendingCommands: pendingCommands ?? 0 };
  });

// ─── Devices ──────────────────────────────────────────────────────
export const getDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devices")
      .select("*, stores(id, name), kiosk_policies(id, name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as DeviceWithRelations[]) ?? [];
  });

export const getDevice = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ deviceId: z.string() }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: device, error } = await context.supabase
      .from("devices")
      .select("*, stores(id, name, address), kiosk_policies(*)")
      .eq("id", data.deviceId)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);

    const { data: telemetry } = await context.supabase
      .from("device_telemetry")
      .select("*")
      .eq("device_id", data.deviceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: latestScreenshot } = await context.supabase
      .from("device_screenshots")
      .select("*")
      .eq("device_id", data.deviceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: commands } = await context.supabase
      .from("device_commands")
      .select("*")
      .eq("device_id", data.deviceId)
      .order("created_at", { ascending: false })
      .limit(20);

    return { device, telemetry, latestScreenshot, commands: commands ?? [] };
  });

const commandTypeEnum = z.enum([
  "lock", "unlock", "reboot", "screenshot", "open_app",
  "install_app", "uninstall_app", "set_policy", "set_volume",
  "send_message", "clear_cache", "set_kiosk_mode",
]);

export const sendCommand = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      deviceId: z.string(),
      commandType: commandTypeEnum,
      payload: z.record(z.any()).default({}),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: device, error: devErr } = await context.supabase
      .from("devices")
      .select("id, user_id")
      .eq("id", data.deviceId)
      .eq("user_id", context.userId)
      .single();
    if (devErr || !device) throw new Error("Device not found");

    const { data: command, error } = await context.supabase
      .from("device_commands")
      .insert({
        device_id: data.deviceId,
        command_type: data.commandType,
        payload: data.payload,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return command;
  });

export const registerDevice = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      deviceName: z.string().min(1),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      storeId: z.string().optional(),
      policyId: z.string().optional(),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: device, error } = await context.supabase
      .from("devices")
      .insert({
        device_name: data.deviceName,
        model: data.model ?? null,
        serial_number: data.serialNumber ?? null,
        store_id: data.storeId ?? null,
        policy_id: data.policyId ?? null,
        user_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return device;
  });

export const updateDevice = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      deviceId: z.string(),
      deviceName: z.string().optional(),
      storeId: z.string().nullable().optional(),
      policyId: z.string().nullable().optional(),
      kioskMode: z.boolean().optional(),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const updateData = {
      ...(data.deviceName !== undefined && { device_name: data.deviceName }),
      ...(data.storeId !== undefined && { store_id: data.storeId }),
      ...(data.policyId !== undefined && { policy_id: data.policyId }),
      ...(data.kioskMode !== undefined && { kiosk_mode: data.kioskMode }),
    };

    const { data: device, error } = await context.supabase
      .from("devices")
      .update(updateData)
      .eq("id", data.deviceId)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return device;
  });

// ─── Stores ───────────────────────────────────────────────────────
export const getStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stores")
      .select("*, devices(count)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createStore = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase
      .from("stores")
      .insert({
        name: data.name,
        address: data.address ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        user_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return store;
  });

export const deleteStore = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ storeId: z.string() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("stores")
      .delete()
      .eq("id", data.storeId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Policies ─────────────────────────────────────────────────────
export const getPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kiosk_policies")
      .select("*, devices(count)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPolicy = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      name: z.string().min(1),
      allowedApps: z.array(z.string()).default([]),
      blockedApps: z.array(z.string()).default([]),
      lockScreen: z.boolean().default(false),
      disableSettings: z.boolean().default(true),
      disablePlayStore: z.boolean().default(true),
      volumeLimit: z.number().default(80),
    }).parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: policy, error } = await context.supabase
      .from("kiosk_policies")
      .insert({
        name: data.name,
        allowed_apps: data.allowedApps,
        blocked_apps: data.blockedApps,
        lock_screen: data.lockScreen,
        disable_settings: data.disableSettings,
        disable_play_store: data.disablePlayStore,
        volume_limit: data.volumeLimit,
        user_id: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return policy;
  });

export const deletePolicy = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ policyId: z.string() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kiosk_policies")
      .delete()
      .eq("id", data.policyId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
