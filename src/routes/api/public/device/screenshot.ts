import { createFileRoute } from "@tanstack/react-router";
import { verifyDeviceApiKey, updateDeviceSeen } from "@/lib/device-api.server";

export const Route = createFileRoute("/api/public/device/screenshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-device-key");
        if (!apiKey) return new Response("Unauthorized", { status: 401 });

        const device = await verifyDeviceApiKey(apiKey);
        if (!device) return new Response("Unauthorized", { status: 401 });

        const body = await request.json();
        const { image_base64, width, height } = body as {
          image_base64: string;
          width?: number;
          height?: number;
        };

        if (!image_base64) {
          return Response.json({ error: "image_base64 is required" }, { status: 400 });
        }

        // Strip data URL prefix if present
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const filePath = `${device.id}/${Date.now()}.png`;

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from("device-screenshots")
          .upload(filePath, buffer, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          return Response.json({ error: uploadError.message }, { status: 500 });
        }

        // Create screenshot record
        const { data: screenshot } = await supabaseAdmin
          .from("device_screenshots")
          .insert({
            device_id: device.id,
            storage_path: filePath,
            width: width ?? null,
            height: height ?? null,
          })
          .select("*")
          .single();

        // Clean up old screenshots (keep last 50)
        await supabaseAdmin
          .from("device_screenshots")
          .delete()
          .eq("device_id", device.id)
          .not("id", "in", `(${screenshot?.id ?? ""})`)
          .order("created_at", { ascending: false })
          .range(50, 999);

        await updateDeviceSeen(device.id);

        return Response.json({ ok: true, screenshot_id: screenshot?.id });
      },
    },
  },
});
