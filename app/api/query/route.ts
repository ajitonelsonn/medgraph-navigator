// app/api/query/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TogetherAI } from "@langchain/community/llms/togetherai";
import { db } from "@/app/utils/db";

// Import utility functions
import { analyzeQueryIntent } from "@/app/utils/queryIntentAnalyzer";
import { executeQueryWithLLM } from "@/app/utils/queryExecutor";
import { generateThought } from "@/app/utils/queryUtils";
import { processQueryResults } from "@/app/utils/resultAnalyzer";

// Initialize LLM
const llm = new TogetherAI({
  apiKey: process.env.TOGETHER_API_KEY || "",
  model: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
  temperature: 0.1,
  maxTokens: 1024,
});

// Define response types
interface QueryResponse {
  thought: string;
  action: string;
  query: string;
  result: any[];
  conclusion: string;
  attempts: number;
  attemptHistory: string[];
  intent?: any;
  explanation?: string;
}

interface IntentResponse {
  intent: "greeting" | "medical_query" | "off_topic";
  confidence: number;
  message: string;
  shouldProcessQuery: boolean;
}

// Function to create a conclusion for count queries
function createCountConclusion(results: any[], intent: any): string {
  if (!results || results.length === 0) {
    return "No results found for your query.";
  }

  // For single number results
  if (results.length === 1 && typeof results[0] === "number") {
    let entityDescription = "patients";

    if (intent.filters.gender === "F") {
      entityDescription = "female patients";
    } else if (intent.filters.gender === "M") {
      entityDescription = "male patients";
    } else if (intent.filters.race) {
      entityDescription = `patients with race '${intent.filters.race}'`;
    }

    return `There are ${results[0].toLocaleString()} ${entityDescription} in the database.`;
  }

  // For gender distribution
  if (
    results.length === 1 &&
    typeof results[0] === "object" &&
    results[0].male !== undefined &&
    results[0].female !== undefined
  ) {
    const total = results[0].male + results[0].female;
    const malePercent = ((results[0].male / total) * 100).toFixed(1);
    const femalePercent = ((results[0].female / total) * 100).toFixed(1);

    return `There are ${results[0].male.toLocaleString()} male patients (${malePercent}%) and ${results[0].female.toLocaleString()} female patients (${femalePercent}%).`;
  }

  // Generic for other results
  return `The query returned ${results.length} results.`;
}

export async function POST(request: NextRequest) {
  try {
    // Safely parse the request body
    const body = await request.json();
    const userQuery = (body.query as string) || "";

    if (!userQuery.trim()) {
      return NextResponse.json(
        {
          error: "Query is required",
        },
        { status: 400 }
      );
    }

    // FIRST STEP: Call the intent detection API
    try {
      // Use relative URL for same-origin API calls
      const intentResponse = await fetch(
        new URL("/api/detect-intent", request.url),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: userQuery }),
        }
      );

      if (intentResponse.ok) {
        const intentData = (await intentResponse.json()) as IntentResponse;

        // If this is a greeting or off-topic query, return early with the appropriate response
        if (!intentData.shouldProcessQuery) {
          return NextResponse.json({
            thought: `This appears to be a ${intentData.intent} query.`,
            action: "respond_to_user",
            query: "",
            result: [],
            conclusion: intentData.message,
            attempts: 0,
            attemptHistory: [],
          } as QueryResponse);
        }

        // If we reach here, it's a medical query - continue with normal processing
        console.log(
          "Intent detected as medical query, proceeding with database query"
        );
      }
    } catch (intentError) {
      // Log the error but continue with the query process
      console.error(
        "Error detecting intent, proceeding with normal query:",
        intentError
      );
      // We'll continue with normal processing even if the intent detection fails
    }

    // SECOND STEP: Analyze query intent
    const intent = analyzeQueryIntent(userQuery);

    // Generate appropriate thought based on query intent
    const thought = generateThought(intent);

    // THIRD STEP: Execute query using LLM-based generation and refinement
    const { query, result, attempts, attemptHistory } =
      await executeQueryWithLLM(userQuery, llm, db, intent);

    // FOURTH STEP: Process results
    let conclusion = "";
    let finalResult = result;

    // For count queries with single number results, directly format the conclusion
    if (
      intent.queryType === "count" &&
      query.toLowerCase().includes("return length(") &&
      result.length === 1 &&
      typeof result[0] === "number"
    ) {
      conclusion = createCountConclusion(result, intent);
    }
    // For count queries with no results, try a direct count
    else if (
      intent.queryType === "count" &&
      (result.length === 0 ||
        (result.length > 10 && userQuery.toLowerCase().includes("how many")))
    ) {
      // Try a direct count query as a fallback
      let directCountQuery = "";

      if (intent.filters.gender === "F") {
        directCountQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'F' RETURN 1)`;
      } else if (intent.filters.gender === "M") {
        directCountQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'M' RETURN 1)`;
      } else if (intent.filters.race) {
        directCountQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND CONTAINS(LOWER(node.RACE), "${intent.filters.race.toLowerCase()}") RETURN 1)`;
      } else {
        directCountQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' RETURN 1)`;
      }

      try {
        console.log("Trying direct count query:", directCountQuery);
        const directResult = await db.query(directCountQuery);
        const countData = await directResult.all();

        if (countData.length === 1 && typeof countData[0] === "number") {
          finalResult = countData;
          conclusion = createCountConclusion(countData, intent);

          // Add the direct query to the attempt history
          attemptHistory.push(directCountQuery);
        }
      } catch (countError) {
        console.error("Error executing direct count query:", countError);
      }
    }
    // For other queries, use LLM analysis
    else {
      try {
        // Process with LLM analysis
        const processedResults = await processQueryResults(
          llm,
          userQuery,
          query,
          result,
          intent,
          attempts,
          attemptHistory
        );

        conclusion = processedResults.conclusion;
      } catch (analysisError) {
        console.error("Error processing results with LLM:", analysisError);

        // Fallback if LLM analysis fails
        if (result.length === 0) {
          conclusion = "No results found for your query.";
        } else if (result.length === 1 && typeof result[0] === "number") {
          conclusion = `The count is ${result[0].toLocaleString()}.`;
        } else {
          conclusion = `The query returned ${result.length} results.`;
        }
      }
    }

    // Format the response with processed results
    const response: QueryResponse = {
      thought: thought,
      action: `execute_${intent.queryType}_query`,
      query: query,
      result: finalResult,
      attempts: attempts,
      attemptHistory: attemptHistory,
      conclusion: conclusion,
      intent: intent,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("API error:", error);

    return NextResponse.json(
      {
        thought: "I need to execute a query to answer this question.",
        action: "execute_query",
        query: "Error generating or executing query",
        result: [],
        attempts: 0,
        attemptHistory: [],
        conclusion: `Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
