import { createFileRoute } from "@tanstack/react-router";
import { verifyDeviceApiKey, updateDeviceSeen } from "@/lib/device-api.server";

export const Route = createFileRoute("/api/public/device/commands")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = request.headers.get("x-device-key");
        if (!apiKey) return new Response("Unauthorized", { status: 401 });

        const device = await verifyDeviceApiKey(apiKey);
        if (!device) return new Response("Unauthorized", { status: 401 });

        await updateDeviceSeen(device.id);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Fetch pending commands
        const { data: commands } = await supabaseAdmin
          .from("device_commands")
          .select("*")
          .eq("device_id", device.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(10);

        // Mark as delivered
        if (commands && commands.length > 0) {
          await supabaseAdmin
            .from("device_commands")
            .update({ status: "delivered", delivered_at: new Date().toISOString() })
            .in("id", commands.map((c) => c.id));
        }

        // Return the current policy if device has one
        let policy = null;
        if (device.policy_id) {
          const { data: p } = await supabaseAdmin
            .from("kiosk_policies")
            .select("*")
            .eq("id", device.policy_id)
            .single();
          policy = p;
        }

        return Response.json({
          commands: commands ?? [],
          kiosk_mode: device.kiosk_mode,
          policy,
        });
      },
    },
  },
});
