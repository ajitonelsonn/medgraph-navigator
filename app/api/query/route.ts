// app/api/query/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TogetherAI } from "@langchain/community/llms/togetherai";
import { db } from "@/app/utils/db";

// Initialize LLM
const llm = new TogetherAI({
  apiKey: process.env.TOGETHER_API_KEY || "",
  model: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
  temperature: 0.1,
  maxTokens: 1024,
});

// Database schema for prompting
function getGraphSchema(): string {
  // Schema unchanged from original code
  return `
        MedGraph Schema (Based on Synthea Medical Dataset):

    Node Types (lowercase) and Properties (ALL CAPS):
    - patient: {ID, BIRTHDATE, GENDER ('M'/'F'), RACE, ETHNICITY, MARITAL, etc.}
    - encounter: {ID, DATE, CODE, DESCRIPTION, REASONCODE, REASONDESCRIPTION}
    - condition: {CODE, DESCRIPTION, START, STOP, PATIENT, ENCOUNTER}
    - medication: {CODE, DESCRIPTION, START, STOP, PATIENT, ENCOUNTER, REASONCODE, REASONDESCRIPTION}
    - procedure: {CODE, DESCRIPTION, DATE, PATIENT, ENCOUNTER, REASONCODE, REASONDESCRIPTION}
    - observation: {CODE, DESCRIPTION, VALUE, UNITS, DATE, PATIENT, ENCOUNTER}
    - allergy: {CODE, DESCRIPTION, START, STOP, PATIENT, ENCOUNTER}
    - careplan: {ID, CODE, DESCRIPTION, START, STOP, PATIENT, ENCOUNTER, REASONCODE, REASONDESCRIPTION}
    - immunization: {CODE, DESCRIPTION, DATE, PATIENT, ENCOUNTER}

    EXAMPLE CORRECT AQL QUERIES:

    1. Count patients by race:
       RETURN LENGTH(
         FOR node IN MedGraph_node
         FILTER node.type == 'patient' AND node.RACE == 'white'
         RETURN node
       )

    2. Count patients by gender:
       RETURN {
         male: LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'M' RETURN 1),
         female: LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'F' RETURN 1)
       }

    3. Get patients with data:
       FOR node IN MedGraph_node
         FILTER node.type == 'patient'
         SORT node.BIRTHDATE DESC
         LIMIT 10
         RETURN { ID: node.ID, BIRTHDATE: node.BIRTHDATE, GENDER: node.GENDER, RACE: node.RACE }

    4. Group and count:
       FOR node IN MedGraph_node
         FILTER node.type == 'patient'
         COLLECT race = node.RACE WITH COUNT INTO count
         SORT count DESC
         RETURN { race: race, count: count }

    5. Average age calculation:
       RETURN AVERAGE(
         FOR node IN MedGraph_node
         FILTER node.type == 'patient'
         RETURN DATE_DIFF(DATE_NOW(), DATE_TIMESTAMP(node.BIRTHDATE), "year")
       )
  `;
}

// Helper function to clean up the AQL query from LLM response
function cleanAqlQuery(text: string): string {
  // Remove markdown code blocks
  let query = text;
  if (query.includes("```")) {
    const blocks = query.split("```");
    for (let i = 1; i < blocks.length; i += 2) {
      const blockContent = blocks[i].trim();
      const lines = blockContent.split("\n");

      // Remove language identifier if present
      if (lines[0].match(/^(sql|aql)$/i)) {
        query = lines.slice(1).join("\n").trim();
      } else {
        query = blockContent;
      }

      break;
    }
  }

  // Remove language prefixes
  const prefixes = ["aql", "sql", "AQL:", "SQL:"];
  for (const prefix of prefixes) {
    if (query.toLowerCase().startsWith(prefix.toLowerCase())) {
      query = query.substring(prefix.length).trim();
    }
  }

  // Remove trailing backticks
  query = query.replace(/```/g, "").trim();

  return query;
}

// Function to determine query type
function determineQueryType(queryText: string): string {
  const lowercaseQuery = queryText.toLowerCase();

  if (
    lowercaseQuery.startsWith("how many") ||
    lowercaseQuery.includes("count") ||
    lowercaseQuery.includes("most common") ||
    lowercaseQuery.includes("distribution")
  ) {
    return "count";
  } else if (
    lowercaseQuery.startsWith("list") ||
    lowercaseQuery.startsWith("show") ||
    lowercaseQuery.startsWith("get") ||
    lowercaseQuery.includes("find")
  ) {
    return "data";
  } else {
    return "analysis";
  }
}

// Check if the query results are valid/relevant
function isValidResult(
  results: any[],
  queryType: string,
  originalQuery: string
): boolean {
  if (!results || results.length === 0) {
    return false;
  }

  // For data queries about patients with gender
  if (
    queryType === "data" &&
    originalQuery.toLowerCase().includes("patient") &&
    originalQuery.toLowerCase().includes("gender")
  ) {
    // Check if the results have valid gender values (M or F)
    const hasValidGenders = results.some((item) => {
      const gender = item.gender || item.Gender || item.GENDER;
      return gender === "M" || gender === "F";
    });
    return hasValidGenders;
  }

  // For data queries about patients with birthdate
  if (
    queryType === "data" &&
    originalQuery.toLowerCase().includes("patient") &&
    originalQuery.toLowerCase().includes("birth")
  ) {
    // Check if the results have non-empty birthdate values
    const hasValidBirthdates = results.some((item) => {
      const birthdate = item.birthdate || item.Birthdate || item.BIRTHDATE;
      return birthdate && typeof birthdate === "string" && birthdate.length > 0;
    });
    return hasValidBirthdates;
  }

  // For year-specific queries
  const yearMatches = originalQuery.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches && yearMatches.length > 0) {
    const requestedYear = yearMatches[0];

    // Check if at least one result contains the requested year
    const hasYearMatch = results.some((item) => {
      const valuesString = JSON.stringify(Object.values(item)).toLowerCase();
      return valuesString.includes(requestedYear);
    });

    return hasYearMatch;
  }

  // For count queries
  if (queryType === "count") {
    // If a single number, it's probably valid
    if (results.length === 1 && typeof results[0] === "number") {
      return true;
    }

    // If it's an object with count properties
    if (results.length === 1 && typeof results[0] === "object") {
      const keys = Object.keys(results[0]);
      return keys.some(
        (key) =>
          key.includes("count") ||
          key === "male" ||
          key === "female" ||
          key === "race"
      );
    }
  }

  // Default to true for other types
  return true;
}

// Generate a better query based on previous results
async function generateBetterQuery(
  originalQuery: string,
  previousQuery: string,
  errorMessage: string,
  attempt: number
): Promise<string> {
  try {
    const prompt = `
      You're a database expert. The following AQL query didn't produce the expected results:
      
      QUERY: ${previousQuery}
      
      ORIGINAL QUESTION: ${originalQuery}
      
      ERROR/ISSUE: ${errorMessage}
      
      This is attempt ${attempt} out of 8. Please generate an improved AQL query that will correctly answer the question.
      
      ${getGraphSchema()}
      
      IMPORTANT RULES:
      1. Provide ONLY the working AQL query, nothing else
      2. All node types (patient, condition, etc.) are lowercase
      3. All properties (GENDER, RACE, etc.) are UPPERCASE
      4. For gender, use 'M' and 'F', not 'Male' and 'Female'
      5. Specifically for questions about gender, include a filter for valid gender values: FILTER node.GENDER == 'M' OR node.GENDER == 'F'
      6. For year specific queries, make sure to include a FILTER with CONTAINS or LIKE to check for the year
      7. Return properties with appropriate capitalization (birthdate: node.BIRTHDATE, gender: node.GENDER)
      
      IMPROVED AQL QUERY:
    `;

    const generation = await llm.invoke(prompt);
    return cleanAqlQuery(generation);
  } catch (error) {
    console.error("Error generating better query:", error);

    // Fallback improvement if LLM fails
    if (originalQuery.toLowerCase().includes("gender")) {
      return `
        FOR node IN MedGraph_node
          FILTER node.type == 'patient' AND (node.GENDER == 'M' OR node.GENDER == 'F')
          SORT node.BIRTHDATE DESC
          LIMIT 10
          RETURN { birthdate: node.BIRTHDATE, gender: node.GENDER }
      `;
    }

    // Fallback for year queries
    const yearMatches = originalQuery.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches && yearMatches.length > 0) {
      const year = yearMatches[0];
      return `
        FOR node IN MedGraph_node
          FILTER node.type == 'patient' AND CONTAINS(node.BIRTHDATE, '${year}')
          SORT node.BIRTHDATE DESC
          LIMIT 10
          RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER }
      `;
    }

    // Generic fallback
    return `
      FOR node IN MedGraph_node
        FILTER node.type == 'patient'
        SORT node.BIRTHDATE DESC
        LIMIT 10
        RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER }
    `;
  }
}

// Define response types
interface QueryResponse {
  thought: string;
  action: string;
  query: string;
  result: any[];
  conclusion: string;
  attempts: number;
  attemptHistory: string[];
}

interface IntentResponse {
  intent: "greeting" | "medical_query" | "off_topic";
  confidence: number;
  message: string;
  shouldProcessQuery: boolean;
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

    // SECOND STEP: Continue with the original query processing
    const queryType = determineQueryType(userQuery);
    let aqlQuery = "";
    let thought = "";
    let result: any[] = [];
    let attempts = 0;
    let maxAttempts = 8;
    let successfulQuery = "";
    let attemptHistory: string[] = [];

    // Generate the appropriate thought based on query type
    if (queryType === "count") {
      thought = `To answer this counting question, I need to query the MedGraph database for numerical statistics.`;
    } else if (queryType === "data") {
      thought = `This question requires retrieving specific records from the MedGraph database.`;
    } else {
      thought = `This question requires analysis of data patterns in the MedGraph database.`;
    }

    // Generate initial AQL query from natural language using LLM
    const prompt = `
      You're a database expert. Transform this question into a proper AQL query for an ArangoDB medical database:
      Question: ${userQuery}

      ${getGraphSchema()}

      IMPORTANT RULES:
      1. Provide ONLY the working AQL query, nothing else
      2. All node types (patient, condition, etc.) are lowercase
      3. All properties (GENDER, RACE, etc.) are UPPERCASE
      4. For gender, use 'M' and 'F', not 'Male' and 'Female'
      5. When querying for patients with gender, always include the filter: FILTER node.GENDER == 'M' OR node.GENDER == 'F'
      6. Return properties with their original case (birthdate: node.BIRTHDATE)
      7. Don't use terms like "white" as gender values, they are race values
      8. For year specific queries (like birth year), use CONTAINS or LIKE operator
      
      AQL QUERY:
    `;

    try {
      // Get the initial query from LLM
      const generation = await llm.invoke(prompt);
      aqlQuery = cleanAqlQuery(generation);
      attemptHistory.push(aqlQuery);
    } catch (error) {
      console.error("Error generating initial query:", error);

      // Fallback for common query types
      if (userQuery.toLowerCase().includes("gender")) {
        aqlQuery = `
          FOR node IN MedGraph_node
            FILTER node.type == 'patient' AND (node.GENDER == 'M' OR node.GENDER == 'F')
            SORT node.BIRTHDATE DESC
            LIMIT 10
            RETURN { birthdate: node.BIRTHDATE, gender: node.GENDER }
        `;
      } else {
        aqlQuery = `
          FOR node IN MedGraph_node
            FILTER node.type == 'patient'
            SORT node.BIRTHDATE DESC
            LIMIT 10
            RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER }
        `;
      }

      attemptHistory.push(aqlQuery);
    }

    // Try executing the query, refining up to maxAttempts times if needed
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Attempt ${attempts}:`, aqlQuery);

      try {
        // Execute the query
        const queryResult = await db.query(aqlQuery);
        result = await queryResult.all();

        // Check if the results look valid/relevant
        if (isValidResult(result, queryType, userQuery)) {
          successfulQuery = aqlQuery;
          break;
        } else {
          // Results don't match expectations, generate a better query
          let errorMessage = "Results don't match expectations. ";

          if (
            queryType === "data" &&
            userQuery.toLowerCase().includes("gender")
          ) {
            errorMessage +=
              "Gender values should be 'M' or 'F', but got invalid values or nulls.";
          } else if (userQuery.match(/\b(19|20)\d{2}\b/g)) {
            const yearMatch = userQuery.match(/\b(19|20)\d{2}\b/g);
            const year = yearMatch ? yearMatch[0] : "";
            errorMessage += `Results don't contain the requested year ${year}.`;
          } else if (result.length === 0) {
            errorMessage += "No results returned.";
          } else {
            errorMessage += "Results may not be relevant to the question.";
          }

          try {
            aqlQuery = await generateBetterQuery(
              userQuery,
              aqlQuery,
              errorMessage,
              attempts
            );
            attemptHistory.push(aqlQuery);
          } catch (error) {
            console.error(
              `Error in generating better query for attempt ${attempts}:`,
              error
            );
            break; // Break the loop if we can't generate a better query
          }
        }
      } catch (error) {
        console.error(`Error in attempt ${attempts}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        try {
          aqlQuery = await generateBetterQuery(
            userQuery,
            aqlQuery,
            errorMessage,
            attempts
          );
          attemptHistory.push(aqlQuery);
        } catch (genError) {
          console.error(
            `Error in generating better query for attempt ${attempts}:`,
            genError
          );
          break; // Break the loop if we can't generate a better query
        }
      }
    }

    // If we didn't get a successful query after max attempts, use the last one
    if (!successfulQuery && attempts >= 1) {
      successfulQuery = aqlQuery;

      // Try one last time
      try {
        const queryResult = await db.query(aqlQuery);
        result = await queryResult.all();
      } catch (error) {
        console.error("Final attempt also failed:", error);

        // Return a helpful error response
        return NextResponse.json({
          thought: thought,
          action: `execute_${queryType}_query`,
          query: aqlQuery,
          result: [],
          conclusion:
            "Unable to generate a working query after multiple attempts. Please try rephrasing your question.",
          attempts: attempts,
          attemptHistory: attemptHistory,
        });
      }
    }

    // Generate a conclusion based on the results
    let conclusion = "";
    if (Array.isArray(result)) {
      if (result.length === 0) {
        conclusion =
          "The query returned no results. There may not be any data matching your criteria.";
      } else if (result.length === 1 && typeof result[0] === "number") {
        conclusion = `The count is ${result[0]}.`;
      } else if (result.length === 1 && typeof result[0] === "object") {
        if (result[0].race && result[0].count) {
          conclusion = `The most common race is "${result[0].race}" with ${result[0].count} patients.`;
        } else {
          conclusion = `The analysis returned a single result with the requested information.`;
        }
      } else {
        conclusion = `The query returned ${result.length} results that match your criteria.`;
      }
    } else {
      conclusion = "The query returned a complex result structure.";
    }

    // Format the response
    const response: QueryResponse = {
      thought: thought,
      action: `execute_${queryType}_query`,
      query: successfulQuery,
      result: result,
      attempts: attempts,
      attemptHistory: attemptHistory,
      conclusion: conclusion,
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
