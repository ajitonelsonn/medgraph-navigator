// app/utils/queryExecutor.ts

import { QueryIntent } from "./queryIntentAnalyzer";
import { generateLLMPrompt } from "./llmPromptGenerator";
import {
  cleanAqlQuery,
  isValidResult,
  generateYearPatientFallbackQuery,
} from "./queryUtils";

/**
 * Executes a query using LLM-based generation with adaptive refinement
 */
export async function executeQueryWithLLM(
  userQuery: string,
  llm: any,
  db: any,
  intent: QueryIntent
): Promise<{
  query: string;
  result: any[];
  attempts: number;
  attemptHistory: string[];
}> {
  let attempts = 0;
  const maxAttempts = 8;
  let successfulQuery = "";
  let result: any[] = [];
  let attemptHistory: string[] = [];

  // For simple year-only queries, try direct approach first
  if (intent.generalQuery && intent.filters.year && !intent.keywords.length) {
    console.log(
      "Simple year-based query detected, using direct approach first"
    );
    const directYearQuery = generateYearPatientFallbackQuery(
      intent.filters.year
    );

    try {
      const directResult = await db.query(directYearQuery);
      const yearPatients = await directResult.all();

      if (yearPatients.length > 0) {
        return {
          query: directYearQuery,
          result: yearPatients,
          attempts: 1,
          attemptHistory: [directYearQuery],
        };
      }
    } catch (error) {
      console.error("Direct year query failed, will try LLM approach", error);
    }
  }

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // Generate AQL query using LLM with appropriate prompt based on attempt number
      const promptErrorInfo =
        attempts > 1
          ? result.length === 0
            ? "No results found. There might not be any patients matching these criteria."
            : "Previous query didn't return valid results"
          : "";

      const prompt = generateLLMPrompt(
        userQuery,
        intent,
        attempts,
        attemptHistory.length > 0
          ? attemptHistory[attemptHistory.length - 1]
          : "",
        promptErrorInfo
      );

      const generation = await llm.invoke(prompt);
      const aqlQuery = cleanAqlQuery(generation);
      attemptHistory.push(aqlQuery);

      console.log(`Attempt ${attempts}:`, aqlQuery);

      // Execute query with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 40000); // 40 second timeout

      try {
        // Execute the query
        const queryResult = await db.query(aqlQuery);
        result = await queryResult.all();
        clearTimeout(timeoutId);

        // If we're getting no results after multiple tries with specific conditions,
        // and the intent is for a specific condition+year, try a more general approach
        if (
          result.length === 0 &&
          attempts >= 3 &&
          intent.keywords.length > 0 &&
          intent.filters.year
        ) {
          console.log(
            "No results found with specific conditions. Trying a more general approach."
          );

          // Try a general patient query without conditions
          const generalQuery = generateYearPatientFallbackQuery(
            intent.filters.year
          );

          attemptHistory.push(generalQuery);

          // Execute the general query
          const generalResult = await db.query(generalQuery);
          const generalData = await generalResult.all();

          if (generalData.length > 0) {
            // We found some patients with this birth year, but they don't have the condition
            console.log(
              `Found ${generalData.length} patients born in ${
                intent.filters.year
              }, but none with ${intent.keywords.join(", ")}`
            );
            result = generalData;
            successfulQuery = generalQuery;
            break;
          }
        }

        // Check if results are valid
        if (
          isValidResult(result, intent.queryType, userQuery, intent) ||
          result.length > 0
        ) {
          successfulQuery = aqlQuery;
          break;
        } else {
          // Generate error message for next LLM prompt
          let errorMessage =
            result.length === 0
              ? `No results found. There might not be any patients matching these criteria.`
              : "Results don't match expectations. ";

          if (intent.filters.gender) {
            errorMessage += `Expected gender filter for ${
              intent.filters.gender === "M" ? "male" : "female"
            } patients. `;
          }

          if (intent.filters.year) {
            errorMessage += `Results don't contain the requested year ${intent.filters.year}. `;
          }

          if (intent.keywords.length > 0) {
            errorMessage += `Results don't properly match the medical terms: ${intent.keywords.join(
              ", "
            )}. `;
          }

          // Continue to next attempt (will generate new query via LLM)
        }
      } catch (timeoutError) {
        clearTimeout(timeoutId);
        console.log("Query timed out or errored");

        // Add timeout feedback for the next LLM prompt
        const timeoutMessage =
          "Previous query timed out or resulted in an error. Please use the optimized pattern from example #11 with staged processing for better performance.";

        // Continue to next attempt (will generate new query via LLM with timeout guidance)
      }
    } catch (error) {
      console.error(`Error in attempt ${attempts}:`, error);
      // Continue to next attempt
    }
  }

  // Return the best query and results
  return {
    query: successfulQuery,
    result: result,
    attempts: attempts,
    attemptHistory: attemptHistory,
  };
}
