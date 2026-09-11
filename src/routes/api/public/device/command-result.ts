import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyDeviceApiKey } from "@/lib/device-api.server";

export const Route = createFileRoute("/api/public/device/command-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-device-key");
        if (!apiKey) return new Response("Unauthorized", { status: 401 });

        const device = await verifyDeviceApiKey(apiKey);
        if (!device) return new Response("Unauthorized", { status: 401 });

        const body = await request.json();
        const schema = z.object({
          command_id: z.string(),
          status: z.enum(["completed", "failed"]),
          result: z.record(z.any()).optional(),
        });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.message }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Verify the command belongs to this device
        const { data: cmd } = await supabaseAdmin
          .from("device_commands")
          .select("id, device_id")
          .eq("id", parsed.data.command_id)
          .eq("device_id", device.id)
          .single();

        if (!cmd) {
          return Response.json({ error: "Command not found" }, { status: 404 });
        }

        await supabaseAdmin
          .from("device_commands")
          .update({
            status: parsed.data.status,
            result: parsed.data.result ?? {},
            executed_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.command_id);

        return Response.json({ ok: true });
      },
    },
  },
});
