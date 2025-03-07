"use client";

import { useState, useEffect } from "react";
import Navigation from "../components/Navigation";
import { Search, Filter, ChevronDown, ChevronRight } from "lucide-react";
import Image from "next/image";

// Define TypeScript interfaces for the data
interface Patient {
  id: string;
  name?: string;
  gender: string;
  birthdate: string;
  race: string;
  conditions: string[];
  medications?: string[];
  encounters?: { date: string; type: string }[];
  riskFactors?: { condition: string; level: string }[];
}

interface PatientSectionProps {
  title: string;
  items: string[];
}

export default function PatientsExplorer() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [loadingPatientPercentage, setLoadingPatientPercentage] = useState(0);

  // Fetch actual data from the database
  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      setLoadingPercentage(10);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setLoadingPercentage((prev) => (prev < 90 ? prev + 15 : prev));
        }, 700);

        const response = await fetch("/api/patients");

        clearInterval(progressInterval);
        setLoadingPercentage(95);

        if (!response.ok) {
          throw new Error("Failed to fetch patients");
        }

        const data = await response.json();
        setLoadingPercentage(100);

        // Ensure data is in the expected format
        const formattedData = Array.isArray(data)
          ? data
          : data.data || data.patients || data.results || [];

        setPatients(formattedData);
      } catch (error) {
        console.error("Error fetching patients:", error);
        // Fallback to empty array if fetch fails
        setPatients([]);
      } finally {
        // Short delay to show 100% before hiding loader
        setTimeout(() => {
          setIsLoading(false);
        }, 300);
      }
    };

    fetchPatients();
  }, []);

  // Improved filtering with proper type checks
  const filteredPatients = Array.isArray(patients)
    ? patients.filter(
        (patient) =>
          (patient.name?.toLowerCase() || "").includes(
            searchTerm.toLowerCase()
          ) ||
          (Array.isArray(patient.conditions) &&
            patient.conditions.some((c) =>
              (c?.toLowerCase() || "").includes(searchTerm.toLowerCase())
            ))
      )
    : [];

  // Fetch patient details when a patient is selected
  const fetchPatientDetails = async (patientId: string) => {
    setIsLoadingPatient(true);
    setSelectedPatient(null);
    setLoadingPatientPercentage(0);

    try {
      // Simulate progress
      setLoadingPatientPercentage(15);
      const progressInterval = setInterval(() => {
        setLoadingPatientPercentage((prev) => (prev < 90 ? prev + 20 : prev));
      }, 600);

      const response = await fetch(`/api/patients/${patientId}`);

      clearInterval(progressInterval);
      setLoadingPatientPercentage(95);

      if (!response.ok) {
        throw new Error("Failed to fetch patient details");
      }

      const patientData = await response.json();
      setLoadingPatientPercentage(100);
      setSelectedPatient(patientData);
    } catch (error) {
      console.error("Error fetching patient details:", error);
    } finally {
      // Short delay to show 100% before hiding loader
      setTimeout(() => {
        setIsLoadingPatient(false);
      }, 300);
    }
  };

  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="ml-64 flex-1 flex flex-col">
        <div className="p-6 bg-white border-b">
          <h1 className="text-2xl font-bold text-gray-900">Patient Explorer</h1>
          <p className="mt-1 text-gray-600">
            View and analyze patient records and medical histories
          </p>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="max-w-4xl mx-auto flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search patients by name or condition..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Filter className="h-5 w-5 mr-2 text-gray-500" />
              Filters
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/2 overflow-auto border-r">
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
                <div className="w-48 bg-gray-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingPercentage}%` }}
                  ></div>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  {loadingPercentage}%
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => fetchPatientDetails(patient.id)}
                      className={`w-full text-left p-4 hover:bg-indigo-50 transition-colors ${
                        selectedPatient?.id === patient.id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {patient.name || `Patient ${patient.id}`}
                          </h3>
                          <div className="mt-1 flex items-center text-sm text-gray-500 space-x-2">
                            <span>
                              {patient.gender === "M" ? "Male" : "Female"}
                            </span>
                            <span>•</span>
                            <span>
                              {calculateAge(patient.birthdate)} years old
                            </span>
                            <span>•</span>
                            <span className="capitalize">{patient.race}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {Array.isArray(patient.conditions) &&
                          patient.conditions.map((condition, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {condition}
                            </span>
                          ))}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">
                      No patients match your search criteria
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-1/2 overflow-auto">
            {isLoadingPatient ? (
              <div className="h-full flex items-center justify-center flex-col">
                <Image
                  src="/arango.svg"
                  alt="Loading"
                  width={192}
                  height={192}
                  className="animate-pulse"
                />
                <p className="text-indigo-600 mt-4 font-medium">
                  Loading patient data...
                </p>
                <div className="w-48 bg-gray-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingPatientPercentage}%` }}
                  ></div>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  {loadingPatientPercentage}%
                </p>
              </div>
            ) : selectedPatient ? (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {selectedPatient.name || `Patient ${selectedPatient.id}`}
                </h2>

                <div className="bg-white rounded-lg border p-4 mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Demographics
                  </h3>
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Gender
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {selectedPatient.gender === "M" ? "Male" : "Female"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Date of Birth
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatDate(selectedPatient.birthdate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Age</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {calculateAge(selectedPatient.birthdate)} years
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Race
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 capitalize">
                        {selectedPatient.race}
                      </dd>
                    </div>
                  </dl>
                </div>

                <PatientSection
                  title="Conditions"
                  items={selectedPatient.conditions || []}
                />

                <PatientSection
                  title="Medications"
                  items={selectedPatient.medications || []}
                />

                <PatientSection
                  title="Encounters"
                  items={(selectedPatient.encounters || []).map(
                    (encounter) => `${encounter.type} (${encounter.date})`
                  )}
                />

                <PatientSection
                  title="Risk Factors"
                  items={(selectedPatient.riskFactors || []).map(
                    (risk) => `${risk.condition} - ${risk.level} Risk`
                  )}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Select a patient to view details
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PatientSection({ title, items }: PatientSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left"
      >
        <h3 className="font-medium text-gray-900">{title}</h3>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {items.length > 0 ? (
            items.map((item, i) => (
              <div key={i} className="py-2 border-t">
                <p className="text-sm text-gray-900">{item}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 py-2">No data available</p>
          )}
        </div>
      )}
    </div>
  );
}

function calculateAge(birthdate: string) {
  const today = new Date();
  const birthDate = new Date(birthdate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function formatDate(dateString: string) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
}
