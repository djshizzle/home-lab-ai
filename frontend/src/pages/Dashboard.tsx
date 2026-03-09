import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ticket, Monitor, CheckCircle, AlertTriangle, Clock, Zap } from "lucide-react";
import { api, type Ticket as TicketType, type Device } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";

interface Stats {
  open: number;
  inProgress: number;
  resolved: number;
  devicesOnline: number;
  devicesTotal: number;
}

const AGENT_STEPS = [
  { num: "01", name: "Orchestrator", desc: "Classifies & routes" },
  { num: "02", name: "Researcher", desc: "Diagnoses root cause" },
  { num: "03", name: "Planner", desc: "Designs resolution" },
  { num: "04", name: "Implementer", desc: "Executes fix" },
  { num: "05", name: "Tester", desc: "Validates AV path" },
  { num: "06", name: "Reviewer", desc: "Security & reliability" },
  { num: "07", name: "Documenter", desc: "Creates KB entry" },
];

export default function Dashboard() {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<Stats>({
    open: 0,
    inProgress: 0,
    resolved: 0,
    devicesOnline: 0,
    devicesTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.tickets.list("open", 5),
      api.tickets.list("in_progress", 5),
      api.tickets.list("resolved", 5),
      api.devices.list(),
    ])
      .then(([open, inProg, resolved, devs]) => {
        setTickets([...open.tickets, ...inProg.tickets]);
        setDevices(devs.devices.slice(0, 8));
        setStats({
          open: open.count,
          inProgress: inProg.count,
          resolved: resolved.count,
          devicesOnline: devs.devices.filter((d) => d.status === "online").length,
          devicesTotal: devs.count,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          AVops Webex Support — 7-Agent AI Pipeline
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Tickets", value: stats.open, icon: Clock, color: "text-blue-400" },
          { label: "In Progress", value: stats.inProgress, icon: Zap, color: "text-yellow-400" },
          { label: "Resolved Today", value: stats.resolved, icon: CheckCircle, color: "text-green-400" },
          { label: "Devices Online", value: `${stats.devicesOnline}/${stats.devicesTotal}`, icon: Monitor, color: "text-webex-blue" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-100">{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* 7-Agent pipeline visual */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">7-Agent Support Pipeline</h2>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {AGENT_STEPS.map((step, i) => (
            <div key={step.num} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center text-center w-24">
                <div className="w-9 h-9 rounded-full bg-webex-blue/15 border border-webex-blue/30 flex items-center justify-center text-xs font-bold text-webex-blue mb-1.5">
                  {step.num}
                </div>
                <p className="text-xs font-medium text-gray-300">{step.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">{step.desc}</p>
              </div>
              {i < AGENT_STEPS.length - 1 && (
                <div className="w-6 h-px bg-gray-700 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tickets */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Recent Tickets</h2>
            <Link to="/tickets" className="text-xs text-webex-blue hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-600 text-sm">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="text-gray-600 text-sm">No open tickets</p>
          ) : (
            <div className="space-y-3">
              {tickets.slice(0, 5).map((t) => (
                <Link
                  key={t.ticket_id}
                  to={`/tickets/${t.ticket_id}`}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-gray-500 mb-0.5">
                      #{t.ticket_id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-300 truncate">{t.message}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.webex_person_email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={t.status} size="sm" />
                    <StatusBadge status={t.priority} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Device health */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Webex Device Health</h2>
            <Link to="/devices" className="text-xs text-webex-blue hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-600 text-sm">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="text-gray-600 text-sm">No devices registered</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.device_id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-300 font-medium truncate">{d.device_id}</p>
                    <p className="text-xs text-gray-500">{d.model} · {d.room_id}</p>
                  </div>
                  <StatusBadge status={d.status} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
