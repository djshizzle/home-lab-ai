import { useEffect, useState } from "react";
import { api, type Ticket } from "../lib/api";
import { Zap, ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "text-webex-blue border-webex-blue/30 bg-webex-blue/10",
  researcher: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  planner: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  implementer: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  tester: "text-green-400 border-green-400/30 bg-green-400/10",
  reviewer: "text-red-400 border-red-400/30 bg-red-400/10",
  documenter: "text-gray-300 border-gray-500/30 bg-gray-500/10",
};

export default function AgentRuns() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // Load tickets that have agent workflow events
    Promise.all([api.tickets.list("resolved", 50), api.tickets.list("in_progress", 20)])
      .then(([r, ip]) => {
        const combined = [...ip.tickets, ...r.tickets].filter(
          (t) => t.agent_workflow && t.agent_workflow.length > 0
        );
        setTickets(combined);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Agent Runs</h1>
        <p className="text-gray-400 text-sm mt-1">
          7-agent workflow execution traces per ticket
        </p>
      </div>

      {loading ? (
        <p className="text-gray-600 text-sm">Loading…</p>
      ) : tickets.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Zap className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No agent runs yet</p>
          <p className="text-gray-600 text-xs mt-1">
            Send a message to the Webex support bot to trigger a run
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.ticket_id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors text-left"
                onClick={() =>
                  setExpanded(expanded === t.ticket_id ? null : t.ticket_id)
                }
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-mono text-xs text-webex-blue shrink-0">
                    #{t.ticket_id.slice(0, 8)}
                  </span>
                  <p className="text-sm text-gray-300 truncate">{t.message}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <StatusBadge status={t.status} size="sm" />
                  <span className="text-xs text-gray-500">
                    {t.agent_workflow.length} agents
                  </span>
                  {expanded === t.ticket_id ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </button>

              {expanded === t.ticket_id && (
                <div className="px-5 pb-5 border-t border-gray-800">
                  <div className="mt-4 space-y-3">
                    {t.agent_workflow.map((event, i) => {
                      const colorClass =
                        AGENT_COLORS[event.agent] ??
                        "text-gray-300 border-gray-600/30 bg-gray-600/10";
                      return (
                        <div
                          key={i}
                          className={`border rounded-lg p-3 text-xs ${colorClass}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold uppercase tracking-wide">
                              Agent {String(i + 1).padStart(2, "0")} — {event.agent}
                            </span>
                            <span className="text-gray-500">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-400 line-clamp-3 font-mono text-xs leading-relaxed">
                            {event.output_summary || "No output recorded"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {t.resolution && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-xs font-semibold text-green-400 mb-1">Resolution</p>
                      <p className="text-xs text-gray-300">{t.resolution}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
