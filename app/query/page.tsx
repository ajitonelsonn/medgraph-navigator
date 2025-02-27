"use client";

import { useState } from "react";
import Navigation from "../components/Navigation";
import { Send, Loader2 } from "lucide-react";

export default function QueryInterface() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<
    { question: string; answer: string }[]
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setResults((prev) => [...prev, { question: query, answer: "" }]);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error("Query failed");

      const data = await response.json();

      setResults((prev) => {
        const newResults = [...prev];
        newResults[newResults.length - 1].answer = data.result;
        return newResults;
      });
    } catch (error) {
      setResults((prev) => {
        const newResults = [...prev];
        newResults[newResults.length - 1].answer =
          "An error occurred while processing your query.";
        return newResults;
      });
    } finally {
      setIsLoading(false);
      setQuery("");
    }
  };

  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="ml-64 flex-1 flex flex-col">
        <div className="p-6 bg-white border-b">
          <h1 className="text-2xl font-bold text-gray-900">Query Interface</h1>
          <p className="mt-1 text-gray-600">
            Ask natural language questions about your medical database
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {results.length > 0 ? (
              <div className="space-y-6">
                {results.map((item, index) => (
                  <div key={index} className="space-y-3">
                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium shrink-0">
                        U
                      </div>
                      <div className="ml-3 bg-indigo-100 p-3 rounded-lg rounded-tl-none">
                        <p className="text-gray-800">{item.question}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium shrink-0">
                        M
                      </div>
                      <div className="ml-3 bg-white border p-3 rounded-lg rounded-tl-none">
                        {index === results.length - 1 &&
                        !item.answer &&
                        isLoading ? (
                          <div className="flex items-center text-gray-500">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing your query...
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none">
                            <p className="whitespace-pre-wrap">{item.answer}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <Beaker className="w-12 h-12 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  Ask a medical data question
                </h3>
                <p className="mt-2 text-gray-500 max-w-md mx-auto">
                  Try questions like "How many patients have diabetes?" or "Show
                  me patient journeys for heart conditions"
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-white">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about your medical data..."
                className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Beaker(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3v2"></path>
      <path d="M16 3v2"></path>
      <path d="M8 13h8"></path>
      <path d="M8 17h8"></path>
      <path d="M10 20h4"></path>
      <path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"></path>
    </svg>
  );
}
