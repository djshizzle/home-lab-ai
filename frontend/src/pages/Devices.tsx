import { useEffect, useState } from "react";
import { api, type Device } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { Monitor, Wifi } from "lucide-react";

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.devices
      .list()
      .then((r) => setDevices(r.devices))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const webexDevices = devices.filter((d) => d.webex_supported);
  const otherDevices = devices.filter((d) => !d.webex_supported);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">AV Device Inventory</h1>
        <p className="text-gray-400 text-sm mt-1">
          {devices.length} devices · {webexDevices.length} Webex-capable
        </p>
      </div>

      {loading ? (
        <p className="text-gray-600 text-sm">Loading…</p>
      ) : (
        <>
          {/* Webex devices */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-webex-blue" />
              <h2 className="text-sm font-semibold text-gray-300">
                Webex-Capable Devices ({webexDevices.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {webexDevices.map((d) => (
                <DeviceCard key={d.device_id} device={d} />
              ))}
              {webexDevices.length === 0 && (
                <p className="text-gray-600 text-sm col-span-3">
                  No Webex-capable devices registered
                </p>
              )}
            </div>
          </section>

          {/* Other AV devices */}
          {otherDevices.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-300">
                  Other AV Devices ({otherDevices.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {otherDevices.map((d) => (
                  <DeviceCard key={d.device_id} device={d} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DeviceCard({ device: d }: { device: Device }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-gray-500 mb-0.5">{d.device_id}</p>
          <p className="text-sm font-semibold text-gray-200 truncate">{d.model}</p>
          <p className="text-xs text-gray-500">{d.vendor}</p>
        </div>
        <StatusBadge status={d.status} size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-gray-600">Room</p>
          <p className="text-gray-300 font-mono">{d.room_id || "—"}</p>
        </div>
        <div>
          <p className="text-gray-600">Firmware</p>
          <p className="text-gray-300 font-mono">{d.firmware_version || "—"}</p>
        </div>
        <div>
          <p className="text-gray-600">IP</p>
          <p className="text-gray-300 font-mono">{d.ip_address || "—"}</p>
        </div>
        <div>
          <p className="text-gray-600">Webex</p>
          <p className={d.webex_supported ? "text-webex-blue" : "text-gray-600"}>
            {d.webex_supported ? "Yes" : "No"}
          </p>
        </div>
      </div>
    </div>
  );
}
