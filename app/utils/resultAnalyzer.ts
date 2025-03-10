// app/utils/resultAnalyzer.ts

import { TogetherAI } from "@langchain/community/llms/togetherai";
import { QueryIntent } from "./queryIntentAnalyzer";
import { cleanAqlQuery } from "./queryUtils";

/**
 * Analyzes query results with LLM to verify correctness and generate appropriate response
 */
export async function analyzeQueryResults(
  llm: TogetherAI,
  userQuery: string,
  executedQuery: string,
  results: any[],
  intent: QueryIntent
): Promise<{
  isValid: boolean;
  conclusion: string;
  improvedQuery?: string;
  explanation: string;
}> {
  // Check if this is a count query that returns a single number
  // This is critical for "how many" queries
  if (
    intent.queryType === "count" &&
    userQuery.toLowerCase().includes("how many") &&
    results.length === 1 &&
    typeof results[0] === "number"
  ) {
    // This is a valid count result - directly return it without LLM analysis
    let entityDescription = "patients";

    if (intent.filters.gender === "F") {
      entityDescription = "female patients";
    } else if (intent.filters.gender === "M") {
      entityDescription = "male patients";
    } else if (intent.filters.race) {
      entityDescription = `patients with race '${intent.filters.race}'`;
    }

    return {
      isValid: true,
      conclusion: `There are ${results[0].toLocaleString()} ${entityDescription} in the database.`,
      explanation: `The query correctly returned a count of ${entityDescription}.`,
    };
  }

  // For single number results that aren't explained as counts
  if (results.length === 1 && typeof results[0] === "number") {
    return {
      isValid: true,
      conclusion: `The count is ${results[0].toLocaleString()}.`,
      explanation: `The query returned a single numeric value.`,
    };
  }

  // For gender distribution objects
  if (
    results.length === 1 &&
    typeof results[0] === "object" &&
    results[0].male !== undefined &&
    results[0].female !== undefined
  ) {
    const total = results[0].male + results[0].female;
    const malePercent = ((results[0].male / total) * 100).toFixed(1);
    const femalePercent = ((results[0].female / total) * 100).toFixed(1);

    return {
      isValid: true,
      conclusion: `There are ${results[0].male.toLocaleString()} male patients (${malePercent}%) and ${results[0].female.toLocaleString()} female patients (${femalePercent}%).`,
      explanation: `The query returned a gender distribution count.`,
    };
  }

  // For count queries that incorrectly returned a list
  if (
    intent.queryType === "count" &&
    userQuery.toLowerCase().includes("how many") &&
    results.length > 10
  ) {
    // Suggest an improved count query
    let improvedQuery = "";

    if (intent.filters.gender) {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == '${intent.filters.gender}' RETURN 1)`;
    } else if (intent.filters.race) {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND CONTAINS(LOWER(node.RACE), "${intent.filters.race.toLowerCase()}") RETURN 1)`;
    } else if (intent.keywords.length > 0) {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'condition' AND CONTAINS(LOWER(node.DESCRIPTION), "${intent.keywords[0].toLowerCase()}") RETURN 1)`;
    } else {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' RETURN 1)`;
    }

    return {
      isValid: false,
      conclusion: `The query returned a list of items instead of a count. An improved query would return the total count.`,
      improvedQuery: improvedQuery,
      explanation: `For "how many" questions, you should return a single count using LENGTH() or COUNT(), not a list of records.`,
    };
  }

  // Prepare a sample of results for analysis
  // For large result sets, limit to a reasonable sample size
  const resultSample =
    results.length > 10
      ? [...results.slice(0, 3), "...", ...results.slice(results.length - 3)]
      : results;

  // Format results for LLM consumption
  const formattedResults = JSON.stringify(resultSample, null, 2);

  // Create a prompt for LLM analysis
  const prompt = `
    You are a medical database expert. Analyze these query results to determine if they correctly answer the user's question.

    USER QUERY: "${userQuery}"
    
    EXECUTED AQL QUERY:
    ${executedQuery}
    
    QUERY RESULTS (${results.length} total results):
    ${formattedResults}
    
    QUERY INTENT ANALYSIS:
    - Query type: ${intent.queryType}
    - Keywords: ${intent.keywords.join(", ") || "none"}
    - Filters: ${
      Object.entries(intent.filters)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "none"
    }
    - General query: ${intent.generalQuery ? "yes" : "no"}
    
    Analyze if the results correctly answer the user's question. Pay attention to:
    1. For "how many" questions, results should be a count (single number), not a list of records
    2. Results should match all filters (year, gender, race, etc.) mentioned in the query
    3. For condition queries, verify the results include condition information

    Respond in this structured format:
    {
      "isValid": true/false,
      "conclusion": "Natural language conclusion about the results that directly answers the user's question",
      "improvedQuery": "If the current query is wrong, provide a corrected AQL query, otherwise leave empty",
      "explanation": "Explain why the results are valid or invalid, and how they answer the original question"
    }
  `;

  try {
    // Get LLM analysis
    const analysis = await llm.invoke(prompt);

    // Parse the response
    try {
      const cleanedResponse = cleanJsonResponse(analysis);
      const parsedResponse = JSON.parse(cleanedResponse);

      return {
        isValid: parsedResponse.isValid,
        conclusion: parsedResponse.conclusion,
        improvedQuery: parsedResponse.improvedQuery || undefined,
        explanation: parsedResponse.explanation,
      };
    } catch (parseError) {
      console.error("Error parsing LLM response:", parseError);

      // Fallback if parsing fails
      return {
        isValid: results.length > 0,
        conclusion:
          results.length > 0
            ? `The query returned ${results.length} results.`
            : "No results found for your query.",
        explanation: "Unable to analyze results in detail.",
      };
    }
  } catch (error) {
    console.error("Error getting LLM analysis:", error);

    // Fallback if LLM call fails
    return {
      isValid: results.length > 0,
      conclusion:
        results.length > 0
          ? `The query returned ${results.length} results.`
          : "No results found for your query.",
      explanation: "Unable to analyze results.",
    };
  }
}

/**
 * Clean LLM JSON response to ensure it's valid JSON
 */
function cleanJsonResponse(text: string): string {
  // Extract JSON from markdown codeblocks if present
  if (text.includes("```json")) {
    const blocks = text.split("```json");
    for (let i = 1; i < blocks.length; i++) {
      const endIndex = blocks[i].indexOf("```");
      if (endIndex !== -1) {
        return blocks[i].substring(0, endIndex).trim();
      }
    }
  }

  // Or extract JSON from regular codeblocks
  if (text.includes("```")) {
    const blocks = text.split("```");
    for (let i = 1; i < blocks.length; i += 2) {
      if (blocks[i].trim().startsWith("{") && blocks[i].trim().endsWith("}")) {
        return blocks[i].trim();
      }
    }
  }

  // Or try to find JSON object directly
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return text.substring(jsonStart, jsonEnd + 1);
  }

  // Return original if no JSON found
  return text;
}

/**
 * Process query results with LLM analysis before showing to user
 */
export async function processQueryResults(
  llm: TogetherAI,
  userQuery: string,
  executedQuery: string,
  results: any[],
  intent: QueryIntent,
  attempts: number,
  attemptHistory: string[]
): Promise<{
  query: string;
  result: any[];
  conclusion: string;
  attempts: number;
  attemptHistory: string[];
  explanation?: string;
}> {
  // For empty results, provide a simple response without LLM analysis
  if (!results || results.length === 0) {
    return {
      query: executedQuery,
      result: results,
      conclusion: "No results found for your query.",
      attempts: attempts,
      attemptHistory: attemptHistory,
      explanation: "The query returned no matching records in the database.",
    };
  }

  // For count queries with single number results, directly use the result
  if (
    intent.queryType === "count" &&
    (executedQuery.toLowerCase().includes("return length(") ||
      executedQuery.toLowerCase().includes("return count(")) &&
    results.length === 1 &&
    typeof results[0] === "number"
  ) {
    let entityDescription = "patients";

    if (intent.filters.gender === "F") {
      entityDescription = "female patients";
    } else if (intent.filters.gender === "M") {
      entityDescription = "male patients";
    } else if (intent.filters.race) {
      entityDescription = `patients with race '${intent.filters.race}'`;
    } else if (intent.keywords.length > 0) {
      entityDescription = `patients with ${intent.keywords.join(", ")}`;
    }

    return {
      query: executedQuery,
      result: results,
      conclusion: `There are ${results[0].toLocaleString()} ${entityDescription} in the database.`,
      attempts: attempts,
      attemptHistory: attemptHistory,
      explanation: `The query correctly counted ${entityDescription}.`,
    };
  }

  // For gender distribution objects
  if (
    results.length === 1 &&
    typeof results[0] === "object" &&
    results[0].male !== undefined &&
    results[0].female !== undefined
  ) {
    const total = results[0].male + results[0].female;
    const malePercent = ((results[0].male / total) * 100).toFixed(1);
    const femalePercent = ((results[0].female / total) * 100).toFixed(1);

    return {
      query: executedQuery,
      result: results,
      conclusion: `There are ${results[0].male.toLocaleString()} male patients (${malePercent}%) and ${results[0].female.toLocaleString()} female patients (${femalePercent}%).`,
      attempts: attempts,
      attemptHistory: attemptHistory,
      explanation: `The query returned a gender distribution.`,
    };
  }

  // For count queries that incorrectly returned a list, try to fix them
  if (
    intent.queryType === "count" &&
    userQuery.toLowerCase().includes("how many") &&
    results.length > 10
  ) {
    // We have a count query that returned a list - try to get a proper count
    let improvedQuery = "";

    if (intent.filters.gender) {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == '${intent.filters.gender}' RETURN 1)`;
    } else if (intent.filters.race) {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND CONTAINS(LOWER(node.RACE), "${intent.filters.race.toLowerCase()}") RETURN 1)`;
    } else if (intent.keywords.length > 0) {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'condition' AND CONTAINS(LOWER(node.DESCRIPTION), "${intent.keywords[0].toLowerCase()}") RETURN 1)`;
    } else {
      improvedQuery = `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' RETURN 1)`;
    }

    // Return the list count in the meantime
    return {
      query: executedQuery,
      result: [results.length], // Convert to count
      conclusion: `There are ${results.length.toLocaleString()} matching records.`,
      attempts: attempts,
      attemptHistory: attemptHistory,
      explanation: `The query returned a list of records. For a more accurate count, a query like: ${improvedQuery} would be better.`,
    };
  }

  // Analyze results with LLM
  const analysis = await analyzeQueryResults(
    llm,
    userQuery,
    executedQuery,
    results,
    intent
  );

  // If results are valid, return with LLM-generated conclusion
  if (analysis.isValid) {
    return {
      query: executedQuery,
      result: results,
      conclusion: analysis.conclusion,
      attempts: attempts,
      attemptHistory: attemptHistory,
      explanation: analysis.explanation,
    };
  }

  // If we have an improved query and haven't exceeded attempt limits
  if (analysis.improvedQuery && attempts < 8) {
    const correctedQuery = cleanAqlQuery(analysis.improvedQuery);
    attemptHistory.push(correctedQuery);

    // Since we can't directly execute the query here, we'll return the suggestion
    return {
      query: correctedQuery,
      result: results, // Keep original results
      conclusion:
        analysis.conclusion ||
        "An improved query might better answer your question.",
      attempts: attempts + 1,
      attemptHistory: attemptHistory,
      explanation: analysis.explanation,
    };
  }

  // If no improved query or too many attempts, return with warning
  return {
    query: executedQuery,
    result: results,
    conclusion:
      analysis.conclusion || `The query returned ${results.length} results.`,
    attempts: attempts,
    attemptHistory: attemptHistory,
    explanation: analysis.explanation,
  };
}

/**
 * Create a direct count query from intent
 */
export function createDirectCountQuery(intent: QueryIntent): string {
  if (intent.filters.gender === "F") {
    return `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'F' RETURN 1)`;
  } else if (intent.filters.gender === "M") {
    return `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'M' RETURN 1)`;
  } else if (intent.filters.race) {
    return `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND CONTAINS(LOWER(node.RACE), "${intent.filters.race.toLowerCase()}") RETURN 1)`;
  } else if (intent.keywords.length > 0 && intent.keywords[0]) {
    return `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'condition' AND CONTAINS(LOWER(node.DESCRIPTION), "${intent.keywords[0].toLowerCase()}") RETURN 1)`;
  } else {
    return `RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' RETURN 1)`;
  }
}
