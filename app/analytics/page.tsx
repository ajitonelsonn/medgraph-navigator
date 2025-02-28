"use client";

import { useState, useEffect } from "react";
import Navigation from "../components/Navigation";
import Image from "next/image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  FileBarChart,
  Users,
  Activity,
  Calendar,
  Filter,
  RefreshCw,
  Download,
} from "lucide-react";
import { getCachedData } from "../utils/cache";
// Define proper TypeScript interfaces for your data
interface DemographicsData {
  genderDistribution: Array<{ name: string; value: number }>;
  ageDistribution: Array<{ age: string; count: number }>;
  raceDistribution: Array<{ name: string; count: number }>;
  patientGrowth: Array<{ month: string; patients: number }>;
}

interface ConditionsData {
  topConditions: Array<{ name: string; count: number }>;
  conditionsByAge: Array<Record<string, number | string>>;
  conditionTrends: Array<Record<string, number | string>>;
}

interface MedicationsData {
  topMedications: Array<{ name: string; count: number }>;
  medicationsByCondition: Array<Record<string, number | string>>;
  medicationAdherence: Array<{
    medication: string;
    adherent: number;
    nonAdherent: number;
  }>;
}

interface OutcomesData {
  readmissionRates: Array<{ condition: string; rate: number }>;
  treatmentEffectiveness: Array<{
    treatment: string;
    effective: number;
    ineffective: number;
  }>;
  mortalityTrends: Array<{ year: string; rate: number }>;
}

interface AnalyticsData {
  demographics: DemographicsData;
  conditions: ConditionsData;
  medications: MedicationsData;
  outcomes: OutcomesData;
}

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

export default function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("demographics");
  const [timeRange, setTimeRange] = useState("all");
  const [error, setError] = useState<string | null>(null);

  // Initialize with proper default values for each data structure
  const [data, setData] = useState<AnalyticsData>({
    demographics: {
      genderDistribution: [],
      ageDistribution: [],
      raceDistribution: [],
      patientGrowth: [],
    },
    conditions: {
      topConditions: [],
      conditionsByAge: [],
      conditionTrends: [],
    },
    medications: {
      topMedications: [],
      medicationsByCondition: [],
      medicationAdherence: [],
    },
    outcomes: {
      readmissionRates: [],
      treatmentEffectiveness: [],
      mortalityTrends: [],
    },
  });

  // Load data for the active tab
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    async function fetchData() {
      try {
        // Create a cache key that includes both tab and time range
        const cacheKey = `analytics-${activeTab}-${timeRange}`;

        // Use the generic cache utility with the correct type
        const fetchFn = async () => {
          return await fetchDataWithTimeout<any>(
            `/api/analytics/${activeTab}?timeRange=${timeRange}`
          );
        };

        // Get data from cache or fetch it if not cached/expired
        const newData = await getCachedData<any>(cacheKey, fetchFn);

        setData((prevData) => ({
          ...prevData,
          [activeTab]: newData,
        }));
      } catch (error: any) {
        console.error("Error fetching analytics data:", error);
        setError(`Failed to load data: ${error.message}`);

        // Provide fallback data in case of error
        setData((prevData) => ({
          ...prevData,
        }));
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [activeTab, timeRange]);

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Force fresh data by bypassing cache
      const newData = await fetchDataWithTimeout<any>(
        `/api/analytics/${activeTab}?timeRange=${timeRange}&fresh=true`
      );

      // Update data state
      setData((prevData) => ({
        ...prevData,
        [activeTab]: newData,
      }));

      // Update cache with fresh data
      const cacheKey = `analytics-${activeTab}-${timeRange}`;
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: newData,
          timestamp: Date.now(),
        })
      );
    } catch (error: any) {
      console.error("Error refreshing data:", error);
      setError(`Failed to refresh data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#8dd1e1",
  ];

  const renderDemographicsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Gender Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.demographics.genderDistribution || []}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name || "Unknown"}: ${((percent || 0) * 100).toFixed(0)}%`
                }
              >
                {(data.demographics.genderDistribution || []).map(
                  (entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  )
                )}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Age Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.demographics.ageDistribution || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="Patient Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Race Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={(data.demographics.raceDistribution || []).slice(0, 5)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              <Bar dataKey="count" fill="#82ca9d" name="Patient Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Patient Growth (2017)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.demographics.patientGrowth || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="patients"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
                name="Patient Encounters"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderConditionsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Top Conditions
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.conditions.topConditions || []}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              <Bar dataKey="count" fill="#0088FE" name="Patients" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Conditions by Age Group
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.conditions.conditionsByAge || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              {(data.conditions.conditionsByAge || []).length > 0 &&
                Object.keys(data.conditions.conditionsByAge[0] || {})
                  .filter((key) => key !== "age")
                  .map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Condition Trends (2017)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.conditions.conditionTrends || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              {(data.conditions.conditionTrends || []).length > 0 &&
                Object.keys(data.conditions.conditionTrends[0] || {})
                  .filter((key) => key !== "year")
                  .map((key, index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[index % COLORS.length]}
                    />
                  ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderMedicationsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Top Medications
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.medications.topMedications || []}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              <Bar dataKey="count" fill="#0088FE" name="Prescriptions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Medications by Condition
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.medications.medicationsByCondition || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="condition" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              {(data.medications.medicationsByCondition || []).length > 0 &&
                Object.keys(data.medications.medicationsByCondition[0] || {})
                  .filter((key) => key !== "condition")
                  .map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Medication Adherence
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.medications.medicationAdherence || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="medication" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat().format(value as number)
                }
              />
              <Legend />
              <Bar dataKey="adherent" fill="#00C49F" name="Adherent" />
              <Bar dataKey="nonAdherent" fill="#FF8042" name="Non-Adherent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderOutcomesTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Readmission Rates by Condition
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.outcomes.readmissionRates || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="condition" />
              <YAxis domain={[0, 25]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar
                dataKey="rate"
                fill="#FF8042"
                name="30-Day Readmission Rate (%)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Treatment Effectiveness
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.outcomes.treatmentEffectiveness || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="treatment" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Bar
                dataKey="effective"
                stackId="a"
                fill="#00C49F"
                name="Effective (%)"
              />
              <Bar
                dataKey="ineffective"
                stackId="a"
                fill="#FF8042"
                name="Ineffective (%)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Mortality Rate Trends (2017)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.outcomes.mortalityTrends || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis domain={[4.5, 6]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#FF8042"
                name="Mortality Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="ml-64 flex-1 flex flex-col">
        <div className="p-6 bg-white border-b">
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-gray-600">
            Comprehensive analytics for patient demographics, conditions,
            medications, and outcomes
          </p>
        </div>

        <div className="p-4 bg-gray-50 border-b">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab("demographics")}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === "demographics"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Users className="h-4 w-4 inline-block mr-1" />
                Demographics
              </button>
              <button
                onClick={() => setActiveTab("conditions")}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === "conditions"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Activity className="h-4 w-4 inline-block mr-1" />
                Conditions
              </button>
              <button
                onClick={() => setActiveTab("medications")}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === "medications"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <FileBarChart className="h-4 w-4 inline-block mr-1" />
                Medications
              </button>
              <button
                onClick={() => setActiveTab("outcomes")}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === "outcomes"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Calendar className="h-4 w-4 inline-block mr-1" />
                Outcomes
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm"
              >
                <option value="all">All Time</option>
                <option value="q4">Q4 2017</option>
                <option value="q3">Q3 2017</option>
                <option value="q2">Q2 2017</option>
                <option value="q1">Q1 2017</option>
              </select>

              <button className="p-2 rounded-md text-gray-500 hover:bg-gray-100">
                <Filter className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-md text-gray-500 hover:bg-gray-100">
                <Download className="h-4 w-4" />
              </button>
              <button
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {/* Display error message if there is one */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              <p>{error}</p>
              <button
                onClick={handleRefresh}
                className="text-sm font-medium hover:underline mt-1"
              >
                Try again
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="h-full flex items-center justify-center flex-col">
              <Image
                src="/arango.svg"
                alt="Loading"
                width={192}
                height={192}
                className="animate-pulse"
              />
              <p className="text-indigo-600 mt-4 font-medium">
                Loading data...
              </p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {activeTab === "demographics" && renderDemographicsTab()}
              {activeTab === "conditions" && renderConditionsTab()}
              {activeTab === "medications" && renderMedicationsTab()}
              {activeTab === "outcomes" && renderOutcomesTab()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
