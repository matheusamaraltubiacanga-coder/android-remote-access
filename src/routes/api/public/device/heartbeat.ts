import { createFileRoute } from "@tanstack/react-router";
import { verifyDeviceApiKey, updateDeviceSeen } from "@/lib/device-api.server";

export const Route = createFileRoute("/api/public/device/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-device-key");
        if (!apiKey) return new Response("Unauthorized", { status: 401 });

        const device = await verifyDeviceApiKey(apiKey);
        if (!device) return new Response("Unauthorized", { status: 401 });

        await updateDeviceSeen(device.id);

        return Response.json({ ok: true, server_time: new Date().toISOString() });
      },
    },
  },
});
