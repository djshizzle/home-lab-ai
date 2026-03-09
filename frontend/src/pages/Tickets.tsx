import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Ticket } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { RefreshCw } from "lucide-react";

const STATUS_FILTERS = ["open", "in_progress", "resolved"] as const;

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [loading, setLoading] = useState(true);

  const load = (status: string) => {
    setLoading(true);
    api.tickets
      .list(status, 100)
      .then((r) => setTickets(r.tickets))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => load(filter), [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Support Tickets</h1>
          <p className="text-gray-400 text-sm mt-1">
            Webex-originated AV support requests
          </p>
        </div>
        <button
          onClick={() => load(filter)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-md text-sm capitalize transition-colors ${
              filter === s
                ? "bg-webex-blue text-gray-950 font-semibold"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600 text-sm">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-sm">No {filter} tickets</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {["ID", "Message", "Intent", "Priority", "Status", "Email", "Created"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {tickets.map((t) => (
                <tr key={t.ticket_id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/tickets/${t.ticket_id}`}
                      className="font-mono text-xs text-webex-blue hover:underline"
                    >
                      #{t.ticket_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-gray-300">{t.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-gray-400">
                      {t.intent.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.priority} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.webex_person_email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
