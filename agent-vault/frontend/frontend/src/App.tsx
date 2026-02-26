import { useState } from "react";
import { Wallet, Shield, Activity, Coins } from "lucide-react";
import { motion } from "framer-motion";

function StatCard({ icon, title, value }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg"
    >
      <div className="flex items-center gap-3 text-neutral-400">
        {icon}
        <span className="text-sm">{title}</span>
      </div>

      <h2 className="text-2xl font-semibold mt-4 text-white">
        {value}
      </h2>
    </motion.div>
  );
}

export default function App() {
  const [agentStatus] = useState("Idle — Monitoring Vault");

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            🤖 Autonomous Vault Agent
          </h1>
          <p className="text-neutral-500 mt-2">
            Secure AI treasury management runtime
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid md:grid-cols-4 gap-6">

          <StatCard
            icon={<Wallet size={18} />}
            title="Vault Balance"
            value="4.70 SOL"
          />

          <StatCard
            icon={<Shield size={18} />}
            title="Risk Score"
            value="30 / 100"
          />

          <StatCard
            icon={<Coins size={18} />}
            title="Last Execution"
            value="Withdraw Micro Amount"
          />

          <StatCard
            icon={<Activity size={18} />}
            title="Agent State"
            value={agentStatus}
          />

        </div>

        {/* Agent Log Stream */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">
            Agent Decision Stream
          </h2>

          <div className="space-y-3 text-sm text-neutral-400">
            <p>✅ Vault state observed</p>
            <p>📊 Risk evaluated</p>
            <p>🧠 Policy simulation complete</p>
            <p>🔒 Execution gated by safety threshold</p>
          </div>
        </div>

        {/* Control Panel */}
        <div className="flex gap-4">
          <button className="bg-white text-black px-6 py-3 rounded-xl font-medium hover:opacity-90 transition">
            Run Agent Cycle
          </button>

          <button className="border border-neutral-700 px-6 py-3 rounded-xl hover:bg-neutral-900 transition">
            Pause Agent
          </button>
        </div>

      </div>
    </div>
  );
}
