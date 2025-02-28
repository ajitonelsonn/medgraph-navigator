// app/query/page.tsx
"use client";

import React, { useState, useRef } from "react";
import { Send, Loader2, User, Bot, Plus } from "lucide-react";
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
}

interface Message {
  role: string;
  content: string | React.ReactNode;
  details?: QueryDetails | null;
  isGreeting?: boolean;
}

// ---------- UTILITY FUNCTIONS ----------

/**
 * Formats API response based on result type and query
 */
const formatResponse = (result: any[], userQuery: string) => {
  const lowerQuery = userQuery.toLowerCase();

  // Empty result check
  if (!result || (Array.isArray(result) && result.length === 0)) {
    return "No results found for your query.";
  }

  // Single number result (count query)
  if (
    Array.isArray(result) &&
    result.length === 1 &&
    typeof result[0] === "number"
  ) {
    if (lowerQuery.includes("how many")) {
      return `There are ${result[0]} records matching your query.`;
    }
    return `The count is ${result[0]}.`;
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
    typeof result[0] === "object" &&
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
  return (
    <div className="space-y-2">
      <p>Here is the distribution:</p>
      <table className="w-full border border-collapse">
        <thead className="bg-gray-100">
          <tr>
            {Object.keys(result[0]).map((key) => (
              <th key={key} className="border p-2 text-left">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.map((item, i) => (
            <tr key={i}>
              {Object.entries(item).map(([key, value]) => (
                <td key={key} className="border p-2">
                  {value !== null && value !== undefined ? String(value) : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
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

  return (
    <div className="space-y-2">
      <p>Here are the results:</p>
      <table className="w-full border border-collapse">
        <thead className="bg-gray-100">
          <tr>
            {allKeys.map((key) => (
              <th key={key} className="border p-2 text-left">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.map((item, i) => (
            <tr key={i}>
              {allKeys.map((key) => (
                <td key={key} className="border p-2">
                  {formatTableCell(key, item[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Add user message
    addUserMessage(query);
    setIsLoading(true);

    try {
      const data = await fetchQueryResults(query);

      if (isConversationalResponse(data)) {
        handleConversationalResponse(data);
      } else {
        await handleDatabaseQueryResponse(data, query);
      }

      // Set the selected message to the user query
      setSelectedMessage(conversation.length);
    } catch (error) {
      handleQueryError(error);
    } finally {
      finishQueryProcess();
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
   * Checks if the response is conversational (greeting or off-topic)
   */
  const isConversationalResponse = (data: any) => {
    return data.action === "respond_to_user";
  };

  /**
   * Handles conversational responses (greetings, off-topic)
   */
  const handleConversationalResponse = (data: any) => {
    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.conclusion,
        isGreeting: data.thought.includes("greeting"),
      },
    ]);
  };

  /**
   * Handles database query responses
   */
  const handleDatabaseQueryResponse = async (data: any, userQuery: string) => {
    // Update user message with query details
    updateUserMessageWithDetails(data);

    // Process and display results
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);

      if (hasYearWithNoBirthMatches(yearMatches, userQuery, data.result)) {
        addResponseWithYearWarning(data.result, userQuery, yearMatches![0]);
      } else {
        addStandardResponse(data.result, userQuery);
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
  const addStandardResponse = (result: any[], userQuery: string) => {
    const formattedResponse = formatResponse(result, userQuery);

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
    console.error("Error querying database:", error);

    setConversation((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your query. Please try again.",
      },
    ]);
  };

  /**
   * Finishes the query process
   */
  const finishQueryProcess = () => {
    setIsLoading(false);
    setQuery("");

    // Scroll to bottom
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ---------- RENDER FUNCTIONS ----------

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
    } = message.details;

    // Switch between tabs
    switch (activeTab) {
      case "thoughts":
        return renderThoughtsTab(thought, action, attempts, conclusion);
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
    conclusion?: string
  ) => {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Thought:</h3>
          <p className="text-sm text-gray-700">{thought}</p>
        </div>
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
      text: "What is the most common race among patients?",
      label: "Most common race",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "How many patients have the race 'white'?",
      label: "White patients count",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "List 10 patients with their birthdates and genders?",
      label: "Patient birthdates and genders",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "Show me 5 patients born in 2016",
      label: "Patients born in 2016",
      className: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    },
    {
      text: "Hello, how can you help me?",
      label: "Say hello",
      className: "text-green-600 bg-green-50 hover:bg-green-100",
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
            <button
              onClick={startNewChat}
              className="flex items-center px-4 py-2 bg-indigo-50 rounded-md text-indigo-600 hover:bg-indigo-100 transition"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </button>
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
                  placeholder="Query the medical database or just say hello..."
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
              <div className="mt-4 flex flex-wrap gap-2">
                {exampleQueries.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(example.text)}
                    className={`text-xs ${example.className} px-3 py-1 rounded-full`}
                  >
                    {example.label}
                  </button>
                ))}
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
    </div>
  );
}
