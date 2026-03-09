import { useEffect, useState } from "react";
import { api, type HealthCheck } from "../lib/api";
import { CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";

export default function Health() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = () => {
    setLoading(true);
    api.health
      .check()
      .then((h) => {
        setHealth(h);
        setLastChecked(new Date());
      })
      .catch(() =>
        setHealth({ status: "error", checks: { api: "unreachable" } })
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  const statusColor =
    health?.status === "ok"
      ? "text-green-400"
      : health?.status === "degraded"
        ? "text-yellow-400"
        : "text-red-400";

  const StatusIcon =
    health?.status === "ok"
      ? CheckCircle
      : health?.status === "degraded"
        ? AlertTriangle
        : XCircle;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">System Health</h1>
          <p className="text-gray-400 text-sm mt-1">
            {lastChecked
              ? `Last checked: ${lastChecked.toLocaleTimeString()}`
              : "Checking…"}
          </p>
        </div>
        <button
          onClick={check}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Check now
        </button>
      </div>

      {/* Overall status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3">
          {health && (
            <StatusIcon className={`w-8 h-8 ${statusColor}`} />
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Overall Status</p>
            <p className={`text-2xl font-bold capitalize ${statusColor}`}>
              {loading ? "Checking…" : health?.status ?? "Unknown"}
            </p>
          </div>
        </div>
      </div>

      {/* Service checks */}
      {health?.checks && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Service Checks</h2>
          </div>
          <div className="divide-y divide-gray-800/50">
            {Object.entries(health.checks).map(([service, result]) => {
              const ok = result === "ok";
              return (
                <div key={service} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    {ok ? (
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="text-sm text-gray-300 capitalize">
                      {service.replace("_", " ")}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-mono ${ok ? "text-green-400" : "text-red-400"}`}
                  >
                    {result}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Architecture info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Architecture</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { label: "AI Model", value: "claude-opus-4-6" },
            { label: "Storage", value: "AWS DynamoDB" },
            { label: "Queue", value: "AWS SQS FIFO" },
            { label: "Archive", value: "AWS S3" },
            { label: "Secrets", value: "AWS Secrets Mgr" },
            { label: "Backend", value: "FastAPI + Python" },
            { label: "Frontend", value: "React + Vite" },
            { label: "Bot", value: "Webex Webhook" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-600 mb-0.5">{label}</p>
              <p className="text-gray-300 font-mono">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
