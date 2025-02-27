import Navigation from "./components/Navigation";
import { Users, Heart, Activity, Clock } from "lucide-react";

export default function Home() {
  return (
    <div className="flex">
      <Navigation />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            MedGraph Navigator
          </h1>
          <p className="mt-2 text-gray-600">
            Patient Journey & Risk Analytics Platform powered by GraphRAG
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Patients"
            value="168,555"
            icon={<Users className="text-blue-600" />}
            change="+2.5%"
          />
          <StatCard
            title="Medical Encounters"
            value="4,999,994"
            icon={<Clock className="text-indigo-600" />}
            change="+4.3%"
          />
          <StatCard
            title="Unique Conditions"
            value="127"
            icon={<Activity className="text-red-600" />}
            change="0%"
          />
          <StatCard
            title="Risk Patients"
            value="42,138"
            icon={<Heart className="text-pink-600" />}
            change="-1.2%"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Queries
            </h2>
            <div className="space-y-3">
              <QueryItem
                query="How many patients have diabetes?"
                time="2 hours ago"
              />
              <QueryItem
                query="List patients with high blood pressure medications"
                time="Yesterday"
              />
              <QueryItem
                query="Analyze risk factors for heart disease"
                time="2 days ago"
              />
              <QueryItem
                query="Patient journey for respiratory conditions"
                time="3 days ago"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Database Status
            </h2>
            <div className="space-y-4">
              <StatusItem
                label="ArangoDB Connection"
                status="Connected"
                isGood={true}
              />
              <StatusItem
                label="Nodes in Graph"
                status="5,555,726"
                isGood={true}
              />
              <StatusItem
                label="Edges in Graph"
                status="18,417,566"
                isGood={true}
              />
              <StatusItem
                label="Together AI API"
                status="Operational"
                isGood={true}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  change,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  change: string;
}) {
  const isPositive = change.startsWith("+");

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">{icon}</div>
      </div>
      <div
        className={`mt-4 text-sm font-medium ${
          isPositive ? "text-green-600" : "text-red-600"
        }`}
      >
        {change} from last month
      </div>
    </div>
  );
}

function QueryItem({ query, time }: { query: string; time: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <p className="text-sm font-medium text-gray-900">{query}</p>
      <span className="text-xs text-gray-500">{time}</span>
    </div>
  );
}

function StatusItem({
  label,
  status,
  isGood,
}: {
  label: string;
  status: string;
  isGood: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isGood ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {status}
      </span>
    </div>
  );
}
