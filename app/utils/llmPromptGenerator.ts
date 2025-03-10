// app/utils/llmPromptGenerator.ts

import { QueryIntent } from "./queryIntentAnalyzer";
import { getGraphSchema } from "./schemaProvider";

/**
 * Generates a prompt for the LLM based on query intent and attempt history
 */
export function generateLLMPrompt(
  userQuery: string,
  intent: QueryIntent,
  attempt: number = 1,
  previousQuery: string = "",
  errorMessage: string = ""
): string {
  // Base prompt for first attempt
  if (attempt === 1) {
    let prompt = `
      You're a database expert. Transform this question into a proper AQL query for an ArangoDB medical database:
      Question: ${userQuery}

      ${getGraphSchema()}
    `;

    // Add specialized guidance for different query types
    if (
      intent.queryType === "count" &&
      userQuery.toLowerCase().includes("how many")
    ) {
      prompt += `
      IMPORTANT CONTEXT:
      - This is a COUNT query asking "how many" - you must return a COUNT, not a list of records
      - For "how many" questions, always use LENGTH() or COUNT() functions
      - Make sure your query returns a single number or an object with count properties
      - Examples of correct count queries:
        1. RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.RACE == 'white' RETURN 1)
        2. RETURN COUNT(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.RACE == 'white' RETURN 1)
      - DO NOT just return a list of nodes or IDs for count queries
      `;
    } else if (intent.generalQuery) {
      prompt += `
      IMPORTANT CONTEXT:
      - This appears to be a general query about patients, not looking for a specific condition
      - The user is asking for patient information ${
        intent.filters.year ? `born in ${intent.filters.year}` : ""
      }
      - Use a SIMPLE direct query pattern that just filters patients, DO NOT try to join with conditions
      - A query like example #14 will work better for this case
      `;
    } else if (
      intent.exactQuery &&
      intent.filters.year &&
      intent.keywords.length === 0
    ) {
      prompt += `
      IMPORTANT CONTEXT:
      - This is a specific query about patients born in ${intent.filters.year}
      - The user DOES NOT appear to be looking for patients with specific conditions
      - Use a SIMPLE direct query pattern that just filters patients by birth year (example #14)
      `;
    } else if (intent.complexity === "complex") {
      prompt += `
      ADDITIONAL CONTEXT:
      - This appears to be a ${intent.queryType} query
      - It involves these medical terms: ${intent.keywords.join(", ")}
      - It includes these filters: ${Object.entries(intent.filters)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}
      - For complex queries like this with multiple filters, use the optimized pattern from example #11 and #12 in the schema
      `;
    }

    prompt += `
      IMPORTANT RULES:
      1. Provide ONLY the working AQL query, nothing else
      2. All node types (patient, condition, etc.) are lowercase
      3. All properties (GENDER, RACE, etc.) are UPPERCASE
      4. For gender, use 'M' and 'F', not 'Male' and 'Female'
      5. When querying for patients with gender, always include the filter: FILTER node.GENDER == 'M' OR node.GENDER == 'F'
      6. Return properties with their original case (birthdate: node.BIRTHDATE)
      7. Don't use terms like "white" as gender values, they are race values
      8. For year specific queries (like birth year), use CONTAINS or LIKE operator
      9. For condition queries, always use LOWER() and CONTAINS() or LIKE for case-insensitive matching
      10. For complex relationship traversals, use the example patterns from the schema examples
      11. For complex queries involving conditions and patients, use the optimized pattern from example #11 to avoid performance issues
      12. Break down complex queries into stages using LET statements for better performance
      13. For queries involving patients with conditions AND birth years, always use the optimized pattern in example #12
      14. For distribution analytics, use COLLECT with COUNT as shown in example #13
      15. If the user is just asking for patients born in a specific year WITHOUT mentioning conditions, use a simple query directly on patients (example #14)
      16. For "how many" questions, return COUNT or LENGTH, not a list of records
      
      AQL QUERY:
    `;

    return prompt;
  }
  // Feedback-based prompt for subsequent attempts
  else {
    let prompt = `
      You're a database expert. The following AQL query didn't produce the expected results:
      
      QUERY: ${previousQuery}
      
      ORIGINAL QUESTION: ${userQuery}
      
      ERROR/ISSUE: ${errorMessage}
      
      This is attempt ${attempt} out of 8. Please generate an improved AQL query that will correctly answer the question.
      
      ${getGraphSchema()}
    `;

    // Special handling for count queries that returned lists
    if (
      intent.queryType === "count" &&
      userQuery.toLowerCase().includes("how many")
    ) {
      prompt += `
      CRITICAL ERROR: The previous query returned a list of records, but for a "how many" question, we need a COUNT.
      The query should return a single number or an object with count properties.
      
      Use a query like:
      RETURN LENGTH(
        FOR node IN MedGraph_node
          FILTER node.type == 'patient' AND node.RACE == 'white'
          RETURN 1
      )
      
      DO NOT just return a list of nodes or IDs - that would be incorrect for a count query.
      `;
    }
    // If no results were found after some attempts, suggest trying a more general approach
    else if (attempt >= 3 && errorMessage.includes("No results")) {
      if (intent.keywords.length > 0 && intent.filters.year) {
        prompt += `
        IMPORTANT: The previous query found no results. There might not be any ${intent.keywords.join(
          ", "
        )} patients born in ${intent.filters.year}.
        Try one of these approaches:
        1. If the user is asking about patients born in ${
          intent.filters.year
        } with their condition information, try a general patient query (example #14):
          FOR node IN MedGraph_node
            FILTER node.type == 'patient'
            FILTER CONTAINS(node.BIRTHDATE, '${intent.filters.year}')
            LIMIT 15
            RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER, race: node.RACE }
            
        2. If the user is specifically asking about ${intent.keywords.join(
          ", "
        )} patients, try searching without the year filter to see if any exist:
          LET entity = "${intent.keywords[0]}"
          LET matching_conditions = (
            FOR doc IN MedGraph_node
              FILTER doc.type == "condition"
              FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
              LIMIT 10000
              RETURN doc
          )
          // Then the rest of the optimized pattern without the year filter
        `;
      } else if (intent.filters.year) {
        prompt += `
        IMPORTANT: The previous query found no results. Try the simple approach in example #14:
        FOR node IN MedGraph_node
          FILTER node.type == 'patient'
          FILTER CONTAINS(node.BIRTHDATE, '${intent.filters.year}')
          LIMIT 15
          RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER, race: node.RACE }
        `;
      }
    }

    prompt += `
      IMPORTANT RULES:
      1. Provide ONLY the working AQL query, nothing else
      2. All node types (patient, condition, etc.) are lowercase
      3. All properties (GENDER, RACE, etc.) are UPPERCASE
      4. For gender, use 'M' and 'F', not 'Male' and 'Female'
      5. Specifically for questions about gender, include a filter for valid gender values: FILTER node.GENDER == 'M' OR node.GENDER == 'F'
      6. For year specific queries, make sure to include a FILTER with CONTAINS or LIKE to check for the year
      7. Return properties with appropriate capitalization (birthdate: node.BIRTHDATE, gender: node.GENDER)
      8. For condition queries, use LOWER() with CONTAINS() or LIKE to make case-insensitive matches
      9. When traversing relationships, use proper edge collections like MedGraph_node_to_MedGraph_node
      10. For complex relationships like finding patients with conditions, consider using temporary variables with LET
      11. For complex queries involving conditions and patients, always use the optimized pattern shown in example #11 and #12
      12. Break down complex queries into stages using LET statements for better performance
      13. For questions involving patients with conditions AND birth years, always use the optimized pattern in example #12
      14. For distribution analytics, use COLLECT with COUNT as shown in example #13
      15. If the user is just asking for patients born in a specific year WITHOUT mentioning specific conditions, use a simple query directly on patients (example #14)
      16. For "how many" questions, return COUNT or LENGTH, not a list of records
      
      IMPROVED AQL QUERY:
    `;

    return prompt;
  }
}

/**
 * Generates specialized prompts for count queries when the LLM fails to provide the right structure
 */
export function generateCountQueryPrompt(intent: QueryIntent): string {
  let prompt = `
    I need to count patients with specific criteria in a medical database.
    
    ${getGraphSchema()}
    
    I want to count:
  `;

  if (intent.filters.race) {
    prompt += `Patients with race '${intent.filters.race}'`;
  } else if (intent.filters.gender) {
    prompt += `${intent.filters.gender === "M" ? "Male" : "Female"} patients`;
  } else if (intent.keywords.length > 0) {
    prompt += `Patients with ${intent.keywords.join(", ")}`;
  } else {
    prompt += `All patients`;
  }

  prompt += `
    
    IMPORTANT:
    - The query must return a COUNT, not a list of records
    - Use LENGTH() or COUNT() functions 
    - Return a single number
    
    Examples of correct count queries:
    1. RETURN LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.RACE == 'white' RETURN 1)
    2. RETURN COUNT(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'M' RETURN 1)
    
    AQL QUERY:
  `;

  return prompt;
}

/**
 * Generates specialized prompts for distribution queries
 */
export function generateDistributionQueryPrompt(
  userQuery: string,
  intent: QueryIntent
): string {
  let groupingProperty = "RACE";

  if (userQuery.toLowerCase().includes("gender distribution")) {
    groupingProperty = "GENDER";
  } else if (userQuery.toLowerCase().includes("race distribution")) {
    groupingProperty = "RACE";
  } else if (userQuery.toLowerCase().includes("age distribution")) {
    groupingProperty = "BIRTHDATE";
  }

  const prompt = `
    I need to analyze the distribution of ${groupingProperty.toLowerCase()} in a medical database.
    
    ${getGraphSchema()}
    
    Generate an AQL query that:
    1. Groups patient data by ${groupingProperty}
    2. Counts the occurrences in each group
    3. Returns the results sorted by count
    
    Use the COLLECT pattern as shown in example #13.
    
    AQL QUERY:
  `;

  return prompt;
}
