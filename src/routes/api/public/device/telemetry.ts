import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyDeviceApiKey, updateDeviceSeen } from "@/lib/device-api.server";

export const Route = createFileRoute("/api/public/device/telemetry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-device-key");
        if (!apiKey) return new Response("Unauthorized", { status: 401 });

        const device = await verifyDeviceApiKey(apiKey);
        if (!device) return new Response("Unauthorized", { status: 401 });

        const body = await request.json();
        const schema = z.object({
          battery_level: z.number().optional(),
          battery_charging: z.boolean().optional(),
          cpu_usage: z.number().optional(),
          memory_used_mb: z.number().optional(),
          memory_total_mb: z.number().optional(),
          storage_used_mb: z.number().optional(),
          storage_total_mb: z.number().optional(),
          current_app: z.string().optional(),
          network_type: z.string().optional(),
          ip_address: z.string().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          wifi_strength: z.number().optional(),
          uptime_seconds: z.number().optional(),
          android_version: z.string().optional(),
          model: z.string().optional(),
        });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Insert telemetry record with explicit null coalescing for optional fields
        await supabaseAdmin.from("device_telemetry").insert({
          device_id: device.id,
          battery_level: parsed.data.battery_level ?? null,
          battery_charging: parsed.data.battery_charging ?? null,
          cpu_usage: parsed.data.cpu_usage ?? null,
          memory_used_mb: parsed.data.memory_used_mb ?? null,
          memory_total_mb: parsed.data.memory_total_mb ?? null,
          storage_used_mb: parsed.data.storage_used_mb ?? null,
          storage_total_mb: parsed.data.storage_total_mb ?? null,
          current_app: parsed.data.current_app ?? null,
          network_type: parsed.data.network_type ?? null,
          ip_address: parsed.data.ip_address ?? null,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
          wifi_strength: parsed.data.wifi_strength ?? null,
          uptime_seconds: parsed.data.uptime_seconds ?? null,
        });

        // Update device summary fields
        const updateData: {
          last_seen_at: string;
          status: string;
          battery_level?: number | null;
          current_app?: string | null;
          android_version?: string | null;
          model?: string | null;
        } = {
          last_seen_at: new Date().toISOString(),
          status: "online",
        };

        if (parsed.data.battery_level !== undefined)
          updateData.battery_level = parsed.data.battery_level;
        if (parsed.data.current_app !== undefined)
          updateData.current_app = parsed.data.current_app;
        if (parsed.data.android_version !== undefined)
          updateData.android_version = parsed.data.android_version;
        if (parsed.data.model !== undefined)
          updateData.model = parsed.data.model;

        await supabaseAdmin.from("devices").update(updateData).eq("id", device.id);

        return Response.json({ ok: true });
      },
    },
  },
});
