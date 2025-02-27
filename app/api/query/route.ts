import { NextRequest, NextResponse } from "next/server";
import { TogetherAI } from "@langchain/community/llms/togetherai";
import { Database, aql } from "arangojs";

// Database connection
const db = new Database({
  url: process.env.ARANGODB_URL,
  databaseName: process.env.ARANGODB_DATABASE,
  auth: {
    username: process.env.ARANGODB_USERNAME || "root",
    password: process.env.ARANGODB_PASSWORD || "",
  },
});

// LLM setup
const llm = new TogetherAI({
  apiKey: process.env.TOGETHER_API_KEY,
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  temperature: 0.1,
  maxTokens: 2048,
});

// Database schema for prompt
function getDatabaseSchema() {
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
  `;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    // Generate AQL query using LLM
    const queryPrompt = `
      You're a database expert. Convert this natural language query to ArangoDB AQL:
      "${query}"
      
      ${getDatabaseSchema()}
      
      Rules:
      1. All node types (patient, condition, etc.) are lowercase
      2. All properties (GENDER, RACE, etc.) are UPPERCASE
      3. Only return the AQL query, nothing else
      4. Limit results to 15 records unless specifically requested
      5. For complex analysis, consider using aggregation functions
      
      AQL Query:
    `;

    const aqlQueryResult = await llm.invoke(queryPrompt);
    const aqlQuery = aqlQueryResult.trim();

    console.log("Generated AQL Query:", aqlQuery);

    // Execute the AQL query
    try {
      const queryResult = await db.query(aqlQuery);
      const result = await queryResult.all();

      // Format the result
      const analysisPrompt = `
        Based on this medical database query result, provide a clear analysis:
        
        Query: "${query}"
        Result: ${JSON.stringify(result)}
        
        Provide a comprehensive but concise analysis. Include key insights, patterns, 
        and medical implications if relevant. Format with headers and bullet points 
        for readability where appropriate.
      `;

      const analysisResult = await llm.invoke(analysisPrompt);

      return NextResponse.json({ result: analysisResult });
    } catch (dbError) {
      console.error("Database error:", dbError);

      // If the query fails, ask the LLM to fix it
      const fixQueryPrompt = `
        The following AQL query failed:
        ${aqlQuery}
        
        Error: ${dbError.message}
        
        Please fix the query to work with this schema:
        ${getDatabaseSchema()}
        
        Return ONLY the fixed AQL query:
      `;

      const fixedQueryResult = await llm.invoke(fixQueryPrompt);
      const fixedQuery = fixedQueryResult.trim();

      console.log("Fixed AQL Query:", fixedQuery);

      try {
        const retryResult = await db.query(fixedQuery);
        const fixedResult = await retryResult.all();

        const analysisPrompt = `
          Based on this medical database query result, provide a clear analysis:
          
          Query: "${query}"
          Result: ${JSON.stringify(fixedResult)}
          
          Provide a comprehensive but concise analysis. Include key insights, patterns, 
          and medical implications if relevant. Format with headers and bullet points 
          for readability where appropriate.
        `;

        const analysisResult = await llm.invoke(analysisPrompt);

        return NextResponse.json({ result: analysisResult });
      } catch (retryError) {
        return NextResponse.json(
          {
            result:
              "I couldn't process that query correctly. Please try rephrasing or simplifying your question.",
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        result: "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}
