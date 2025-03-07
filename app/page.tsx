"use client";

import { useState, useEffect } from "react";
import Navigation from "./components/Navigation";
import {
  Users,
  Activity,
  Database,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import PopupNotification from "./components/PopupNotification";
import { getCachedData } from "./utils/cache";

// Define timeout constants
const FETCH_TIMEOUT = 120000;

// Function to fetch data with timeout
async function fetchDataWithTimeout<T>(
  url: string,
  timeoutMs = FETCH_TIMEOUT
): Promise<T> {
  // Create an AbortController for the fetch
  const controller = new AbortController();
  const { signal } = controller;

  // Create a timeout that will abort the fetch if it takes too long
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal });

    // Clear the timeout as we got a response
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error: any) {
    // Clear the timeout to prevent memory leaks
    clearTimeout(timeoutId);

    // Check if the error was due to a timeout
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  }
}

// Define TypeScript interfaces
interface DatabaseStats {
  totalPatients: number;
  totalEncounters: number;
  uniqueConditions: number;
  riskPatients: number;
  nodesInGraph: number;
  edgesInGraph: number;
  connectionStatus: boolean;
  apiStatus: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}

interface StatusItemProps {
  label: string;
  status: string;
  isGood: boolean;
  icon?: React.ReactNode;
}

export default function Home() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // State to hold error message
  const [loadingPercentage, setLoadingPercentage] = useState(0);

  useEffect(() => {
    const fetchDatabaseStats = async () => {
      setLoadingPercentage(10); // Start at 10%
      try {
        // Simulate progress steps
        const timer1 = setTimeout(() => setLoadingPercentage(30), 500);
        const timer2 = setTimeout(() => setLoadingPercentage(60), 1000);

        // Use the cache utility to get or fetch dashboard stats
        setLoadingPercentage(80);
        const data = await getCachedData<DatabaseStats>(
          "dashboard-stats",
          async () => {
            return await fetchDataWithTimeout<DatabaseStats>(
              "/api/dashboard/stats"
            );
          }
        );

        setLoadingPercentage(100);
        setStats(data);

        // Clear timers
        clearTimeout(timer1);
        clearTimeout(timer2);
      } catch (error: any) {
        console.error("Error fetching database statistics:", error);

        // Set appropriate error message based on the error
        if (error.message.includes("timed out")) {
          setError("Connection to database timed out. Please try again later.");
        } else {
          setError(`Error: ${error.message}`);
        }

        // Set default fallback data in case of error
        setStats({
          totalPatients: 0,
          totalEncounters: 0,
          uniqueConditions: 0,
          riskPatients: 0,
          nodesInGraph: 0,
          edgesInGraph: 0,
          connectionStatus: false,
          apiStatus: false,
        });
      } finally {
        // Short delay to show 100% before hiding loader
        setTimeout(() => setIsLoading(false), 300);
      }
    };

    fetchDatabaseStats();
  }, []);

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingPercentage(0);

    try {
      // Simulate progress
      setLoadingPercentage(15);
      const timer1 = setTimeout(() => setLoadingPercentage(40), 400);
      const timer2 = setTimeout(() => setLoadingPercentage(75), 800);

      // Force fresh data by bypassing cache
      setLoadingPercentage(90);
      const freshData = await fetchDataWithTimeout<DatabaseStats>(
        "/api/dashboard/stats"
      );
      setStats(freshData);
      setLoadingPercentage(100);

      // Update cache with fresh data
      localStorage.setItem(
        "dashboard-stats",
        JSON.stringify({
          data: freshData,
          timestamp: Date.now(),
        })
      );

      // Clear timers
      clearTimeout(timer1);
      clearTimeout(timer2);
    } catch (error: any) {
      console.error("Error refreshing data:", error);

      if (error.message.includes("timed out")) {
        setError("Connection to database timed out. Please try again later.");
      } else {
        setError(
          "Connection to database failure. It's maybe trial is ended to use ArangoDB."
        );
      }

      // Keep the previous stats if available
      if (!stats) {
        setStats({
          totalPatients: 0,
          totalEncounters: 0,
          uniqueConditions: 0,
          riskPatients: 0,
          nodesInGraph: 0,
          edgesInGraph: 0,
          connectionStatus: false,
          apiStatus: false,
        });
      }
    } finally {
      // Short delay to show 100% before hiding loader
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navigation />
      <main className="ml-64 flex-1 p-8">
        {/* Popup Notification */}
        {error && (
          <PopupNotification
            message={error}
            type="error"
            onClose={() => setError(null)}
          />
        )}

        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                MedGraph Navigator
              </h1>
              <p className="mt-2 text-gray-600">
                Patient Journey & Risk Analytics Platform powered by GraphRAG
              </p>
              <Link
                href="https://arangodbhackathon.devpost.com/"
                target="_blank"
                className="inline-flex items-center mt-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <span>Built for the ArangoDB Hackathon</span>
                <LinkIcon className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className="mr-2 p-2 rounded-md text-gray-500 hover:bg-gray-100"
                title="Refresh data"
              >
                <Activity className="w-4 h-4" />
              </button>
              <StatusPill
                isGood={stats?.connectionStatus || false}
                goodText="System Online"
                badText="Connection Issues"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="h-full flex items-center justify-center flex-col">
            <Image
              src="/arango.svg"
              alt="Loading"
              width={192}
              height={192}
              className="animate-pulse"
            />
            <p className="text-indigo-600 mt-4 font-medium">Loading data...</p>
            <div className="w-48 bg-gray-200 rounded-full h-2.5 mt-2">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${loadingPercentage}%` }}
              ></div>
            </div>
            <p className="text-gray-500 text-sm mt-1">{loadingPercentage}%</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Patients"
                value={(stats?.totalPatients || 0).toLocaleString()}
                icon={<Users className="w-8 h-8 text-blue-600" />}
                description="Unique patient records in database"
              />
              <StatCard
                title="Medical Encounters"
                value={(stats?.totalEncounters || 0).toLocaleString()}
                icon={<Activity className="w-8 h-8 text-indigo-600" />}
                description="Total recorded patient encounters"
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Database className="w-5 h-5 mr-2 text-indigo-600" />
                  About MedGraph Navigator
                </h2>
                <div className="space-y-4 text-gray-600">
                  <p>
                    MedGraph Navigator is a cutting-edge healthcare analytics
                    platform built on ArangoDB&apos;s powerful graph
                    capabilities. Our application provides medical professionals
                    with deep insights into patient data, enabling better care
                    coordination and risk assessment. MedGraph Navigator is a
                    next-generation healthcare analytics platform that harnesses
                    the power of graph databases and large language models
                    (LLMs) to provide medical professionals with deep,
                    actionable insights into patient data.
                  </p>
                  <p>
                    Using GraphRAG technology, we combine the power of graph
                    databases with retrieval-augmented generation to deliver
                    context-aware insights for healthcare professionals.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <Link
                      href="/patients"
                      className="flex items-center justify-center px-4 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-indigo-700 transition-colors"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Explore Patients
                    </Link>
                    <Link
                      href="/query"
                      className="flex items-center justify-center px-4 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-lg text-indigo-700 transition-colors"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Query Interface
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Database className="w-5 h-5 mr-2 text-indigo-600" />
                  System Status
                </h2>
                <div className="space-y-4">
                  <StatusItem
                    label="ArangoDB Connection"
                    status={
                      stats?.connectionStatus ? "Connected" : "Disconnected"
                    }
                    isGood={stats?.connectionStatus || false}
                    icon={
                      stats?.connectionStatus ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )
                    }
                  />
                  <StatusItem
                    label="Together AI API"
                    status={stats?.apiStatus ? "Operational" : "Unavailable"}
                    isGood={stats?.apiStatus || false}
                    icon={
                      stats?.apiStatus ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )
                    }
                  />
                  <StatusItem
                    label="Graph Data"
                    status={`${(
                      stats?.nodesInGraph || 0
                    ).toLocaleString()} nodes, ${(
                      stats?.edgesInGraph || 0
                    ).toLocaleString()} edges`}
                    isGood={
                      (stats?.nodesInGraph || 0) > 0 &&
                      (stats?.edgesInGraph || 0) > 0
                    }
                  />

                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Database Information
                    </h3>
                    <p className="text-xs text-gray-500">
                      Powered by{" "}
                      <span className="font-medium">
                        ArangoDB Graph Database
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Using <span className="font-medium">Synthea</span> medical
                      dataset
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Enhanced with{" "}
                      <span className="font-medium">LLM query processing</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatusPill({
  isGood,
  goodText,
  badText,
}: {
  isGood: boolean;
  goodText: string;
  badText: string;
}) {
  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
        isGood ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full mr-2 ${
          isGood ? "bg-green-500" : "bg-red-500"
        } animate-pulse`}
      ></span>
      {isGood ? goodText : badText}
    </div>
  );
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-gray-50">{icon}</div>
      </div>
    </div>
  );
}

function StatusItem({ label, status, isGood, icon }: StatusItemProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${
          isGood ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {icon && <span className="mr-1">{icon}</span>}
        {status}
      </span>
    </div>
  );
}
