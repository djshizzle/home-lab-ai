import { Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Devices from "./pages/Devices";
import AgentRuns from "./pages/AgentRuns";
import Health from "./pages/Health";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/agents" element={<AgentRuns />} />
            <Route path="/health" element={<Health />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
