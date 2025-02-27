"use client";

import { useState, useEffect } from "react";
import Navigation from "./components/Navigation";
import {
  Users,
  Heart,
  Activity,
  Clock,
  Database,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";

// Define TypeScript interfaces
interface DatabaseStats {
  totalPatients: number;
  totalEncounters: number;
  nodesInGraph: number;
  edgesInGraph: number;
  connectionStatus: boolean;
  apiStatus: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

interface StatusItemProps {
  label: string;
  status: string;
  isGood: boolean;
}

export default function Home() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDatabaseStats = async () => {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (!response.ok) {
          throw new Error("Failed to fetch database statistics");
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Error fetching database statistics:", error);
        // Set default fallback data in case of error
        setStats({
          totalPatients: 0,
          totalEncounters: 0,
          nodesInGraph: 0,
          edgesInGraph: 0,
          connectionStatus: false,
          apiStatus: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDatabaseStats();
  }, []);

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
          <p className="mt-1 text-sm text-indigo-600">
            <Link href="https://arangodbhackathon.devpost.com/" target="_blank">
              Built for the ArangoDB Hackathon
            </Link>
          </p>
        </div>

        {isLoading ? (
          <div className="h-full flex items-center justify-center flex-col">
            <img
              src="/arango.svg"
              alt="Loading"
              className="w-48 h-48 animate-pulse"
            />
            <p className="text-indigo-600 mt-4 font-medium">Loading data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Patients"
                value={stats?.totalPatients.toLocaleString() || "0"}
                icon={<Users className="w-8 h-8 text-blue-600" />}
              />
              <StatCard
                title="Medical Encounters"
                value={stats?.totalEncounters.toLocaleString() || "0"}
                icon={<Clock className="w-8 h-8 text-indigo-600" />}
              />
              <StatCard
                title="Nodes in Graph"
                value={stats?.nodesInGraph.toLocaleString() || "0"}
                icon={<Database className="w-8 h-8 text-green-600" />}
              />
              <StatCard
                title="Edges in Graph"
                value={stats?.edgesInGraph.toLocaleString() || "0"}
                icon={<LinkIcon className="w-8 h-8 text-pink-600" />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  About MedGraph Navigator
                </h2>
                <div className="space-y-3 text-gray-600">
                  <p>
                    MedGraph Navigator is a cutting-edge healthcare analytics
                    platform built on ArangoDB's powerful graph capabilities.
                  </p>
                  <p>
                    Our application provides medical professionals with deep
                    insights into patient data, enabling better care
                    coordination and risk assessment.
                  </p>
                  <p>
                    Using GraphRAG technology, we combine the power of graph
                    databases with retrieval-augmented generation to deliver
                    context-aware insights for healthcare professionals.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Database Status
                </h2>
                <div className="space-y-4">
                  <StatusItem
                    label="ArangoDB Connection"
                    status={
                      stats?.connectionStatus ? "Connected" : "Disconnected"
                    }
                    isGood={stats?.connectionStatus || false}
                  />
                  <StatusItem
                    label="Nodes in Graph"
                    status={stats?.nodesInGraph.toLocaleString() || "0"}
                    isGood={(stats?.nodesInGraph || 0) > 0}
                  />
                  <StatusItem
                    label="Edges in Graph"
                    status={stats?.edgesInGraph.toLocaleString() || "0"}
                    isGood={(stats?.edgesInGraph || 0) > 0}
                  />
                  <StatusItem
                    label="Together AI API"
                    status={stats?.apiStatus ? "Operational" : "Unavailable"}
                    isGood={stats?.apiStatus || false}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">{icon}</div>
      </div>
    </div>
  );
}

function StatusItem({ label, status, isGood }: StatusItemProps) {
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
