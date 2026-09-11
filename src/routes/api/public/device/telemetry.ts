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

        // Insert telemetry record
        await supabaseAdmin.from("device_telemetry").insert({
          device_id: device.id,
          ...parsed.data,
        });

        // Update device summary fields
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
          status: "online",
        };
        if (parsed.data.battery_level !== undefined)
          updates.battery_level = parsed.data.battery_level;
        if (parsed.data.current_app !== undefined)
          updates.current_app = parsed.data.current_app;
        if (parsed.data.android_version !== undefined)
          updates.android_version = parsed.data.android_version;
        if (parsed.data.model !== undefined) updates.model = parsed.data.model;

        await supabaseAdmin.from("devices").update(updates).eq("id", device.id);

        return Response.json({ ok: true });
      },
    },
  },
});
