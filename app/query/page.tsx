"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  User,
  Bot,
  Plus,
  Info,
  CheckCircle,
  Circle,
} from "lucide-react";
import Navigation from "../components/Navigation";

// ---------- TYPE DEFINITIONS ----------

interface QueryDetails {
  thought: string;
  action: string;
  query: string;
  result: any[];
  conclusion: string;
  attempts?: number;
  attemptHistory?: string[];
  formattedResult?: string;
  intent?: any;
}

interface Message {
  role: string;
  content: string | React.ReactNode;
  details?: QueryDetails | null;
  isGreeting?: boolean;
}

interface IntentResponse {
  intent: "greeting" | "medical_query" | "off_topic";
  confidence: number;
  message: string;
  shouldProcessQuery: boolean;
}

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  current: boolean;
}

// ---------- UTILITY FUNCTIONS ----------

/**
 * Formats API response based on result type and query
 * Enhanced to better handle count queries
 */
const formatResponse = (
  result: any[],
  userQuery: string,
  queryType?: string
) => {
  const lowerQuery = userQuery.toLowerCase();

  // Empty result check
  if (!result || (Array.isArray(result) && result.length === 0)) {
    return "No results found for your query.";
  }

  // HANDLE COUNT RESULTS
  const isCountQuery =
    queryType === "count" ||
    lowerQuery.startsWith("how many") ||
    lowerQuery.includes("count") ||
    lowerQuery.includes("total number");

  // Single number result (count query)
  if (
    isCountQuery &&
    Array.isArray(result) &&
    result.length === 1 &&
    typeof result[0] === "number"
  ) {
    // Extract what we're counting from the query
    let countedEntity = "records";

    if (lowerQuery.includes("patient")) {
      countedEntity = "patients";
    } else if (lowerQuery.includes("condition")) {
      countedEntity = "conditions";
    } else if (lowerQuery.includes("medication")) {
      countedEntity = "medications";
    }

    return (
      <div className="space-y-2">
        <p className="text-lg font-medium">
          There are{" "}
          <span className="text-indigo-600 font-bold">
            {result[0].toLocaleString()}
          </span>{" "}
          {countedEntity} matching your criteria.
        </p>
      </div>
    );
  }

  // Gender distribution object
  if (
    Array.isArray(result) &&
    result.length === 1 &&
    result[0] &&
    result[0].hasOwnProperty("male") &&
    result[0].hasOwnProperty("female")
  ) {
    const total = result[0].male + result[0].female;
    const malePercent = ((result[0].male / total) * 100).toFixed(1);
    const femalePercent = ((result[0].female / total) * 100).toFixed(1);

    return (
      <div className="space-y-4">
        <p className="text-lg">Patient gender distribution:</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-blue-700">
              {result[0].male.toLocaleString()}
            </div>
            <div className="text-sm text-blue-600">
              Male patients ({malePercent}%)
            </div>
          </div>
          <div className="bg-pink-50 p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-pink-700">
              {result[0].female.toLocaleString()}
            </div>
            <div className="text-sm text-pink-600">
              Female patients ({femalePercent}%)
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Total: {total.toLocaleString()} patients
        </p>
      </div>
    );
  }

  // Single object with count properties
  if (
    Array.isArray(result) &&
    result.length === 1 &&
    typeof result[0] === "object"
  ) {
    const obj = result[0];
    if (obj.hasOwnProperty("race") && obj.hasOwnProperty("count")) {
      return `The most common race is "${obj.race}" with ${obj.count} patients.`;
    }
  }

  // Distribution results (array of objects with counts)
  if (
    Array.isArray(result) &&
    result.length > 1 &&
    result[0] &&
    (result[0].hasOwnProperty("count") || result[0].hasOwnProperty("value"))
  ) {
    return renderDistributionTable(result);
  }

  // Generic array of objects (table format)
  if (
    Array.isArray(result) &&
    result.length > 0 &&
    typeof result[0] === "object"
  ) {
    return renderGenericTable(result);
  }

  // Default case - return JSON
  return (
    <pre className="whitespace-pre-wrap overflow-x-auto">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
};

/**
 * Renders a distribution table
 */
const renderDistributionTable = (result: any[]) => {
  // Find the category key (first property that's not count or value)
  const firstObj = result[0];
  const categoryKey =
    Object.keys(firstObj).find((key) => key !== "count" && key !== "value") ||
    "category";

  // Find the count key
  const countKey = firstObj.hasOwnProperty("count") ? "count" : "value";

  // Calculate total and percentages
  const total = result.reduce((sum, item) => sum + (item[countKey] || 0), 0);

  return (
    <div className="space-y-2">
      <p>Distribution results:</p>
      <table className="w-full border border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 text-left capitalize">{categoryKey}</th>
            <th className="border p-2 text-right">Count</th>
            <th className="border p-2 text-right">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {result.map((item, i) => {
            const countValue = item[countKey] || 0;
            const percentage =
              total > 0 ? ((countValue / total) * 100).toFixed(1) : "0.0";
            return (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border p-2 font-medium">
                  {item[categoryKey] || "-"}
                </td>
                <td className="border p-2 text-right">
                  {countValue.toLocaleString()}
                </td>
                <td className="border p-2 text-right">{percentage}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100">
          <tr>
            <td className="border p-2 font-bold">Total</td>
            <td className="border p-2 text-right font-bold">
              {total.toLocaleString()}
            </td>
            <td className="border p-2 text-right font-bold">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/**
 * Renders a generic table for any array of objects
 */
const renderGenericTable = (result: any[]) => {
  // Get all possible keys from all objects
  const allKeys = [...new Set(result.flatMap((obj) => Object.keys(obj)))];

  // Sort keys with ID, name, gender, birthdate first, then alphabetically
  const sortedKeys = allKeys.sort((a, b) => {
    const keyOrder: Record<string, number> = {
      id: 1,
      ID: 1,
      patient_id: 1,
      name: 2,
      gender: 3,
      GENDER: 3,
      birthdate: 4,
      BIRTHDATE: 4,
      race: 5,
      RACE: 5,
      condition: 6,
      CONDITION: 6,
      description: 6,
      DESCRIPTION: 6,
    };

    const orderA = keyOrder[a] || 100;
    const orderB = keyOrder[b] || 100;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.localeCompare(b);
  });

  // Format header keys for better display
  const formatHeaderKey = (key: string) => {
    if (key.toUpperCase() === key) {
      return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <div className="space-y-2">
      <p>Here are the results:</p>
      <div className="overflow-x-auto max-h-96 border border-gray-200 rounded">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              {sortedKeys.map((key) => (
                <th key={key} className="border-b p-2 text-left">
                  {formatHeaderKey(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {sortedKeys.map((key) => (
                  <td key={key} className="border-t p-2">
                    {formatTableCell(key, item[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Formats table cell content with special handling for gender
 */
const formatTableCell = (key: string, value: any) => {
  if (key.toLowerCase().includes("gender") && value === "M") {
    return "Male";
  }

  if (key.toLowerCase().includes("gender") && value === "F") {
    return "Female";
  }

  // Handle date values
  if (
    key.toLowerCase().includes("date") ||
    key.toLowerCase().includes("birth") ||
    key.toLowerCase().includes("start") ||
    key.toLowerCase().includes("stop")
  ) {
    if (typeof value === "string" && value.includes("T")) {
      // Handle ISO dates
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        // Fall back to original value if parsing fails
        return value !== null && value !== undefined ? String(value) : "-";
      }
    }
  }

  return value !== null && value !== undefined ? String(value) : "-";
};

// ---------- MAIN COMPONENT ----------

export default function QueryPage() {
  // ---------- STATE MANAGEMENT ----------
  const [query, setQuery] = useState<string>("");
  const [conversation, setConversation] = useState<Message[]>([
    {
      role: "system",
      content:
        "Welcome to MedGraph Navigator. You can ask questions about the medical database in natural language.",
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedMessage, setSelectedMessage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("thoughts");
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    {
      id: "intent",
      label: "Intent Detection",
      description:
        "Determining if this is a medical query, greeting, or conversation",
      completed: false,
      current: false,
    },
    {
      id: "analyze",
      label: "Query Analysis",
      description: "Extracting intent, filters, and medical keywords",
      completed: false,
      current: false,
    },
    {
      id: "generate",
      label: "Query Generation",
      description: "Using AI to create optimized database query",
      completed: false,
      current: false,
    },
    {
      id: "execute",
      label: "Query Execution",
      description: "Running query against medical database",
      completed: false,
      current: false,
    },
    {
      id: "format",
      label: "Result Analysis & Processing",
      description: "Validating results with AI and enhancing if needed",
      completed: false,
      current: false,
    },
  ]);
  const [showProcessing, setShowProcessing] = useState<boolean>(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] =
    useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ---------- PROCESSING STEPS MANAGEMENT ----------

  /**
   * Updates the current processing step
   */
  const setCurrentProcessingStep = (stepId: string) => {
    setProcessingSteps((prevSteps) =>
      prevSteps.map((step, index) => {
        // Mark all previous steps as completed
        if (index < prevSteps.findIndex((s) => s.id === stepId)) {
          return { ...step, completed: true, current: false };
        }
        // Mark this step as current
        else if (step.id === stepId) {
          setCurrentProcessingIndex(index);
          return { ...step, completed: false, current: true };
        }
        // Reset future steps
        else {
          return { ...step, completed: false, current: false };
        }
      })
    );
  };

  /**
   * Completes the current processing step and moves to the next
   */
  const completeCurrentStep = () => {
    setProcessingSteps((prevSteps) => {
      const currentIndex = prevSteps.findIndex((step) => step.current);
      if (currentIndex === -1) return prevSteps;

      const nextIndex = currentIndex + 1;

      return prevSteps.map((step, index) => {
        if (index < nextIndex) {
          return { ...step, completed: true, current: false };
        } else if (index === nextIndex && nextIndex < prevSteps.length) {
          setCurrentProcessingIndex(nextIndex);
          return { ...step, completed: false, current: true };
        } else {
          return { ...step, completed: false, current: false };
        }
      });
    });
  };

  /**
   * Resets the processing steps to their initial state
   */
  const resetProcessingSteps = () => {
    setProcessingSteps((prevSteps) =>
      prevSteps.map((step) => ({ ...step, completed: false, current: false }))
    );
    setCurrentProcessingIndex(0);
  };

  // ---------- EVENT HANDLERS ----------

  /**
   * Starts a new chat by resetting the conversation
   */
  const startNewChat = () => {
    setConversation([
      {
        role: "system",
        content:
          "Welcome to MedGraph Navigator. You can ask questions about the medical database in natural language.",
      },
    ]);
    setSelectedMessage(null);
    setQuery("");
  };

  /**
   * Handles form submission and API interaction
   * Follows the updated flowchart workflow with advanced result processing
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Add user message
    addUserMessage(query);
    setIsLoading(true);
    setShowProcessing(true);
    resetProcessingSteps();
    setAttemptCount(1); // Reset attempt counter

    try {
      // STEP 1: Intent Detection
      setCurrentProcessingStep("intent");

      const intentResponse = await fetch("/api/detect-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!intentResponse.ok) {
        throw new Error(`Intent API error: ${intentResponse.status}`);
      }

      completeCurrentStep(); // Intent detection completed

      const intentData = (await intentResponse.json()) as IntentResponse;

      // If it's not a database query, just respond with the intent message
      if (!intentData.shouldProcessQuery) {
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content: intentData.message,
            isGreeting: intentData.intent === "greeting",
          },
        ]);

        // Complete the remaining steps quickly for visualization
        await simulateRemainingSteps();
      } else {
        // STEP 2: Query Analysis - Extracting intent and structure
        setCurrentProcessingStep("analyze");
        await new Promise((resolve) => setTimeout(resolve, 800)); // Small delay for visibility
        completeCurrentStep();

        // STEP 3: Query Generation - Using LLM to create database query
        setCurrentProcessingStep("generate");

        // Add slight delay to show the substeps in the UI
        await new Promise((resolve) => setTimeout(resolve, 1800));

        completeCurrentStep();

        // STEP 4: Query Execution - Running against database
        setCurrentProcessingStep("execute");
        const data = await fetchQueryResults(query);

        // Check if we needed multiple attempts to get results
        if (data.attempts > 1) {
          // Update attempt count for visualization
          setAttemptCount(data.attempts);

          // Brief delay to show the attempted count in the UI
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        completeCurrentStep();

        // STEP 5: Result Analysis with LLM and possible improved query execution
        setCurrentProcessingStep("format");

        // Add slight delay to show the processing substeps in the UI
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await handleDatabaseQueryResponse(data, query);
        completeCurrentStep();
      }

      // Select the user message for details viewing
      setSelectedMessage(conversation.length);
    } catch (error) {
      handleQueryError(error);

      // Mark all steps as completed if there's an error
      setProcessingSteps((steps) =>
        steps.map((step) => ({ ...step, completed: true, current: false }))
      );
    } finally {
      finishQueryProcess();
    }
  };

  /**
   * Simulates the remaining processing steps quickly for non-database queries
   */
  const simulateRemainingSteps = async () => {
    for (let i = currentProcessingIndex; i < processingSteps.length; i++) {
      completeCurrentStep();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  /**
   * Adds a user message to the conversation
   */
  const addUserMessage = (userQuery: string) => {
    const userMessage: Message = {
      role: "user",
      content: userQuery,
      details: null,
    };

    setConversation((prev) => [...prev, userMessage]);
  };

  /**
   * Fetches query results from the API
   */
  const fetchQueryResults = async (userQuery: string) => {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: userQuery }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  };

  /**
   * Handles database query responses with improved count handling
   */
  const handleDatabaseQueryResponse = async (data: any, userQuery: string) => {
    // Update user message with query details
    updateUserMessageWithDetails(data);

    // Process and display results
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      // Check if the backend provided a pre-formatted result (especially for count queries)
      if (data.formattedResult) {
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.formattedResult,
          },
        ]);
        return;
      }

      const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);

      if (hasYearWithNoBirthMatches(yearMatches, userQuery, data.result)) {
        addResponseWithYearWarning(data.result, userQuery, yearMatches![0]);
      } else {
        // Extract query type from action field
        const queryType = data.action
          .replace("execute_", "")
          .replace("_query", "");
        addStandardResponse(data.result, userQuery, queryType);
      }
    } else {
      addNoResultsResponse();
    }
  };

  /**
   * Updates the user message with query details
   */
  const updateUserMessageWithDetails = (data: any) => {
    setConversation((prev) => {
      const newConversation = [...prev];
      const userMessageIndex = newConversation.length - 1;
      newConversation[userMessageIndex] = {
        ...newConversation[userMessageIndex],
        details: {
          thought: data.thought,
          action: data.action,
          query: data.query,
          result: data.result,
          conclusion: data.conclusion,
          attempts: data.attempts,
          attemptHistory: data.attemptHistory,
          formattedResult: data.formattedResult,
          intent: data.intent,
        },
      };
      return newConversation;
    });
  };

  /**
   * Checks if query contains year with no matching birthdates
   */
  const hasYearWithNoBirthMatches = (
    yearMatches: RegExpMatchArray | null,
    userQuery: string,
    results: any[]
  ) => {
    if (!yearMatches || yearMatches.length === 0) return false;

    return (
      userQuery.toLowerCase().includes("birth") &&
      results.every((item: any) => {
        const birthdate = item.birthdate || item.BIRTHDATE;
        return !birthdate || !birthdate.includes(yearMatches[0]);
      })
    );
  };

  /**
   * Adds a response with a warning about missing year matches
   */
  const addResponseWithYearWarning = (
    result: any[],
    userQuery: string,
    year: string
  ) => {
    const formattedResponse = formatResponse(result, userQuery);

    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content: (
          <div>
            {formattedResponse}
            <p className="mt-3 text-yellow-600 text-sm">
              Note: No patients were found with birthdate in {year}. The results
              shown are from other years.
            </p>
          </div>
        ),
      },
    ]);
  };

  /**
   * Adds a standard response to the conversation
   */
  const addStandardResponse = (
    result: any[],
    userQuery: string,
    queryType?: string
  ) => {
    const formattedResponse = formatResponse(result, userQuery, queryType);

    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content: formattedResponse,
      },
    ]);
  };

  /**
   * Adds a no results response to the conversation
   */
  const addNoResultsResponse = () => {
    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "No results found for your query.",
      },
    ]);
  };

  /**
   * Handles query errors
   */
  const handleQueryError = (error: any) => {
    console.error("Error processing query:", error);

    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your query. The database might be unavailable. Please try again later.",
      },
    ]);
  };

  /**
   * Finishes the query process
   */
  const finishQueryProcess = () => {
    setIsLoading(false);
    setQuery("");
    setTimeout(() => {
      setShowProcessing(false);
    }, 500);

    // Scroll to bottom
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ---------- RENDER FUNCTIONS ----------

  /**
   * Renders the processing steps indicator with detailed workflow
   * Follows the complete flow including LLM analysis and result improvement
   */
  const renderProcessingSteps = () => {
    if (!showProcessing) return null;

    // Define the current active query attempt count
    const currentAttemptCount = attemptCount || 1;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Processing Query
            </h3>
            <div className="text-sm px-2 py-1 bg-gray-100 rounded-md">
              Attempt {currentAttemptCount > 1 ? currentAttemptCount : 1}
            </div>
          </div>

          <div className="space-y-5">
            {/* Main Processing Flow */}
            <div className="space-y-1">
              {/* Intent Detection */}
              <div className="border-l-2 border-indigo-500 pl-4 pb-6 relative">
                <div className="absolute -left-[9px] top-0">
                  {processingSteps[0].completed ? (
                    <CheckCircle className="h-4 w-4 bg-white text-green-500" />
                  ) : processingSteps[0].current ? (
                    <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse"></div>
                  ) : (
                    <Circle className="h-4 w-4 bg-white text-gray-300" />
                  )}
                </div>
                <div className="mb-1">
                  <span
                    className={`font-medium ${
                      processingSteps[0].current
                        ? "text-indigo-600"
                        : processingSteps[0].completed
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    Intent Detection
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Analyzing if this is a medical database query, greeting, or
                  off-topic request
                </p>
              </div>

              {/* Query Analysis - Only show if intent is medical */}
              {(processingSteps[1].current || processingSteps[1].completed) && (
                <div className="border-l-2 border-indigo-500 pl-4 pb-6 relative">
                  <div className="absolute -left-[9px] top-0">
                    {processingSteps[1].completed ? (
                      <CheckCircle className="h-4 w-4 bg-white text-green-500" />
                    ) : processingSteps[1].current ? (
                      <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse"></div>
                    ) : (
                      <Circle className="h-4 w-4 bg-white text-gray-300" />
                    )}
                  </div>
                  <div className="mb-1">
                    <span
                      className={`font-medium ${
                        processingSteps[1].current
                          ? "text-indigo-600"
                          : processingSteps[1].completed
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      Query Analysis
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Extracting intent components (data type, filters, keywords)
                    and determining query complexity
                  </p>

                  {processingSteps[1].current && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>
                          Identifying if this is a count, data, or analysis
                          query
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>Extracting filters (gender, race, year)</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>Identifying medical condition keywords</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Query Generation - Only show if previous steps completed */}
              {(processingSteps[2].current || processingSteps[2].completed) && (
                <div className="border-l-2 border-indigo-500 pl-4 pb-6 relative">
                  <div className="absolute -left-[9px] top-0">
                    {processingSteps[2].completed ? (
                      <CheckCircle className="h-4 w-4 bg-white text-green-500" />
                    ) : processingSteps[2].current ? (
                      <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse"></div>
                    ) : (
                      <Circle className="h-4 w-4 bg-white text-gray-300" />
                    )}
                  </div>
                  <div className="mb-1">
                    <span
                      className={`font-medium ${
                        processingSteps[2].current
                          ? "text-indigo-600"
                          : processingSteps[2].completed
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      Query Generation
                    </span>
                    {currentAttemptCount > 1 && (
                      <span className="ml-2 text-xs text-amber-600 font-normal">
                        (Attempt {currentAttemptCount})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    Using AI to translate natural language into optimized
                    database query
                  </p>

                  {/* Sub-steps for query generation */}
                  {processingSteps[2].current && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-indigo-300 rounded-full mr-2"></div>
                        <span>Creating LLM prompt with schema information</span>
                      </div>
                      <div className="flex items-center text-xs text-pink-500">
                        <div className="w-2 h-2 bg-pink-300 rounded-full mr-2"></div>
                        <span>Using LLM to generate AQL database query</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>Cleaning and validating query syntax</span>
                      </div>

                      {currentAttemptCount > 1 && (
                        <div className="mt-2 text-xs py-1 px-2 bg-amber-50 border border-amber-200 rounded-sm">
                          Previous query needed improvement. Generating
                          optimized version...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Query Execution - Only show if previous steps completed */}
              {(processingSteps[3].current || processingSteps[3].completed) && (
                <div className="border-l-2 border-indigo-500 pl-4 pb-6 relative">
                  <div className="absolute -left-[9px] top-0">
                    {processingSteps[3].completed ? (
                      <CheckCircle className="h-4 w-4 bg-white text-green-500" />
                    ) : processingSteps[3].current ? (
                      <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse"></div>
                    ) : (
                      <Circle className="h-4 w-4 bg-white text-gray-300" />
                    )}
                  </div>
                  <div className="mb-1">
                    <span
                      className={`font-medium ${
                        processingSteps[3].current
                          ? "text-indigo-600"
                          : processingSteps[3].completed
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      Query Execution
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Running query against medical database and retrieving
                    results
                  </p>

                  {processingSteps[3].current && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-xs text-blue-500">
                        <div className="w-2 h-2 bg-blue-300 rounded-full mr-2"></div>
                        <span>Executing AQL query on medical database</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>Waiting for results...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Result Analysis - Only show if previous steps completed */}
              {(processingSteps[4].current || processingSteps[4].completed) && (
                <div className="border-l-2 border-indigo-500 pl-4 pb-6 relative">
                  <div className="absolute -left-[9px] top-0">
                    {processingSteps[4].completed ? (
                      <CheckCircle className="h-4 w-4 bg-white text-green-500" />
                    ) : processingSteps[4].current ? (
                      <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse"></div>
                    ) : (
                      <Circle className="h-4 w-4 bg-white text-gray-300" />
                    )}
                  </div>
                  <div className="mb-1">
                    <span
                      className={`font-medium ${
                        processingSteps[4].current
                          ? "text-indigo-600"
                          : processingSteps[4].completed
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      Result Analysis & Processing
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Using AI to validate results and ensure they answer your
                    question
                  </p>

                  {/* Sub-steps for result processing */}
                  {processingSteps[4].current && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>Checking result format & structure</span>
                      </div>
                      <div className="flex items-center text-xs text-pink-500">
                        <div className="w-2 h-2 bg-pink-300 rounded-full mr-2"></div>
                        <span>Verifying if results match query intent</span>
                      </div>
                      <div className="flex items-center text-xs text-pink-500">
                        <div className="w-2 h-2 bg-pink-300 rounded-full mr-2"></div>
                        <span>Validating data quality and relevance</span>
                      </div>

                      {currentAttemptCount > 1 && (
                        <div className="flex items-center text-xs text-yellow-600">
                          <div className="w-2 h-2 bg-yellow-300 rounded-full mr-2"></div>
                          <span>
                            Comparing improved results with original results
                          </span>
                        </div>
                      )}

                      <div className="flex items-center text-xs text-pink-500">
                        <div className="w-2 h-2 bg-pink-300 rounded-full mr-2"></div>
                        <span>Generating natural language conclusion</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                        <span>Formatting final response</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center text-xs text-gray-500">
              <div className="w-2 h-2 bg-pink-300 rounded-full mr-1"></div>
              <span>AI Processing</span>
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <div className="w-2 h-2 bg-blue-300 rounded-full mr-1"></div>
              <span>Database Operations</span>
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span>Completed Steps</span>
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></div>
              <span>Current Step</span>
            </div>
          </div>

          {/* Processing message showing current step */}
          <div className="mt-4 text-center pt-3 border-t border-gray-200">
            <p className="text-sm font-medium text-indigo-600">
              {processingSteps.find((step) => step.current)?.description ||
                "Processing query..."}
            </p>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders the query details panel
   */
  const renderQueryDetails = () => {
    if (selectedMessage === null) return null;

    const message = conversation[selectedMessage];
    if (!message || !message.details) return null;

    const {
      thought,
      action,
      query,
      result,
      conclusion,
      attempts,
      attemptHistory,
      intent,
    } = message.details;

    // Switch between tabs
    switch (activeTab) {
      case "thoughts":
        return renderThoughtsTab(thought, action, attempts, conclusion, intent);
      case "query":
        return renderQueryTab(query, result, attemptHistory);
      default:
        return null;
    }
  };

  /**
   * Renders the thoughts tab content
   */
  const renderThoughtsTab = (
    thought: string,
    action: string,
    attempts?: number,
    conclusion?: string,
    intent?: any
  ) => {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Thought:</h3>
          <p className="text-sm text-gray-700">{thought}</p>
        </div>

        {intent && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              Intent Analysis:
            </h3>
            <div className="bg-gray-50 p-2 rounded text-xs">
              <p>
                <span className="font-medium">Type:</span> {intent.queryType}
              </p>
              {intent.keywords?.length > 0 && (
                <p>
                  <span className="font-medium">Keywords:</span>{" "}
                  {intent.keywords.join(", ")}
                </p>
              )}
              {Object.keys(intent.filters || {}).length > 0 && (
                <p>
                  <span className="font-medium">Filters:</span>{" "}
                  {Object.entries(intent.filters)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(", ")}
                </p>
              )}
              <p>
                <span className="font-medium">Complexity:</span>{" "}
                {intent.complexity}
              </p>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Action:</h3>
          <p className="text-sm text-gray-700">{action}</p>
        </div>

        {attempts && attempts > 1 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              Attempts:
            </h3>
            <p className="text-sm text-gray-700">
              {attempts} queries were tried to get accurate results
            </p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            Conclusion:
          </h3>
          <p className="text-sm text-gray-700">{conclusion}</p>
        </div>
      </div>
    );
  };

  /**
   * Renders the query tab content
   */
  const renderQueryTab = (
    query: string,
    result: any[],
    attemptHistory?: string[]
  ) => {
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          Generated Query:
        </h3>
        <div className="bg-gray-800 text-gray-100 p-3 rounded font-mono text-xs whitespace-pre overflow-x-auto">
          {query}
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            Query Results:
          </h3>
          <div className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-96">
            {Array.isArray(result) ? (
              result.map((item, i) => (
                <div key={i} className="mb-1">
                  {i + 1}. {JSON.stringify(item)}
                </div>
              ))
            ) : (
              <div>{JSON.stringify(result, null, 2)}</div>
            )}
          </div>
        </div>

        {attemptHistory && attemptHistory.length > 1 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              Query Attempts:
            </h3>
            <div className="space-y-2">
              {attemptHistory.map((attempt, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-500">Attempt {i + 1}:</p>
                  <div className="bg-gray-700 text-gray-100 p-2 rounded font-mono text-xs whitespace-pre overflow-x-auto">
                    {attempt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders a message bubble
   */
  const renderMessage = (message: Message, index: number) => {
    if (message.role === "system") {
      return (
        <div key={index} className="text-center my-4 text-gray-500 text-sm">
          {message.content}
        </div>
      );
    }

    return (
      <div
        key={index}
        className="mb-4"
        onClick={() => {
          if (message.role === "user" && message.details) {
            setSelectedMessage(index);
          }
        }}
      >
        <div
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`
            flex items-start max-w-xl rounded-lg p-4
            ${
              message.role === "user"
                ? `bg-indigo-50 cursor-pointer ${
                    selectedMessage === index ? "ring-2 ring-indigo-300" : ""
                  }`
                : message.isGreeting
                ? "bg-indigo-50 bg-opacity-30 shadow"
                : "bg-white shadow"
            }
          `}
          >
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${
                message.role === "user"
                  ? "bg-indigo-100"
                  : message.isGreeting
                  ? "bg-green-100"
                  : "bg-gray-200"
              }`}
            >
              {message.role === "user" ? (
                <User className="h-5 w-5 text-indigo-700" />
              ) : (
                <Bot className="h-5 w-5 text-gray-700" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {typeof message.content === "string" ? (
                <p className="text-gray-800">{message.content}</p>
              ) : (
                message.content
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- EXAMPLE QUERIES ----------

  const exampleQueries = [
    {
      text: "How many patients have the race 'white'?",
      label: "Count white patients",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "What is the distribution of patients by race?",
      label: "Race distribution",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "List 10 patients with their birthdates and genders",
      label: "Patient list",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "How many patients are female?",
      label: "Count female patients",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
  ];

  // ---------- COMPONENT RENDER ----------

  return (
    <div className="flex h-screen">
      <Navigation />
      <div className="ml-64 flex-1 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-white border-b flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                MedGraph Navigator
              </h1>
              <p className="mt-1 text-gray-600">
                Query the medical database using natural language
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={startNewChat}
                className="flex items-center px-4 py-2 bg-indigo-50 rounded-md text-indigo-600 hover:bg-indigo-100 transition"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </button>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-auto p-4 bg-gray-50">
            <div className="max-w-3xl mx-auto">
              {conversation.map((message, index) =>
                renderMessage(message, index)
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input box */}
          <div className="p-4 border-t bg-white">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Query the medical database..."
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="absolute right-2 top-2 p-2 text-indigo-600 disabled:text-gray-400"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </form>

              {/* Example queries */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2 flex items-center">
                  <Info className="h-3 w-3 mr-1" /> Try these example queries:
                </p>
                <div className="flex flex-wrap gap-2">
                  {exampleQueries.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(example.text)}
                      className={`text-xs ${example.className} px-3 py-1 rounded-full transition-colors duration-200`}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - Query details */}
        <div className="hidden md:block w-80 bg-white border-l overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab("thoughts")}
                className={`flex-1 py-3 text-sm font-medium ${
                  activeTab === "thoughts"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500"
                }`}
              >
                Thoughts
              </button>
              <button
                onClick={() => setActiveTab("query")}
                className={`flex-1 py-3 text-sm font-medium ${
                  activeTab === "query"
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500"
                }`}
              >
                Query
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {renderQueryDetails() || (
                <div className="p-4 text-gray-500 text-sm text-center">
                  {selectedMessage === null
                    ? "Select a query to see details"
                    : "This message doesn't have query details"}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <p className="text-xs text-gray-500 text-center">
                MedGraph Navigator displays query details showing how natural
                language is converted to database queries.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Processing steps overlay */}
      {renderProcessingSteps()}
    </div>
  );
}
