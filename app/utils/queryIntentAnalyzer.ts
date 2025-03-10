// app/utils/queryIntentAnalyzer.ts

/**
 * Interface for the query intent analysis result
 */
export interface QueryIntent {
  queryType: "count" | "data" | "analysis";
  keywords: string[];
  filters: Record<string, string>;
  complexity: "simple" | "moderate" | "complex";
  exactQuery: boolean;
  generalQuery: boolean;
}

/**
 * Analyzes a natural language query to determine intent and extract key components
 */
export function analyzeQueryIntent(userQuery: string): QueryIntent {
  const lowercaseQuery = userQuery.toLowerCase();

  // Determine if this is asking for a general list without specific conditions
  const generalQuery =
    (lowercaseQuery.startsWith("list") ||
      lowercaseQuery.startsWith("show") ||
      lowercaseQuery.startsWith("get") ||
      lowercaseQuery.includes("patients") ||
      lowercaseQuery.includes("born in")) &&
    !lowercaseQuery.includes("diabetes") &&
    !lowercaseQuery.includes("hypertension") &&
    !lowercaseQuery.includes("otitis") &&
    !lowercaseQuery.includes("asthma") &&
    !lowercaseQuery.includes("heart disease") &&
    !lowercaseQuery.includes("cancer");

  // Determine exact query matching - if specific phrases are used
  const exactQuery =
    lowercaseQuery.includes("list the patient") ||
    lowercaseQuery.includes("show me patient") ||
    lowercaseQuery.includes("patients born in") ||
    lowercaseQuery.includes("who were born in");

  // Determine query type
  let queryType: "count" | "data" | "analysis" = "data";
  if (
    lowercaseQuery.startsWith("how many") ||
    lowercaseQuery.includes("count") ||
    lowercaseQuery.includes("most common") ||
    lowercaseQuery.includes("distribution")
  ) {
    queryType = "count";
  } else if (
    lowercaseQuery.includes("analyze") ||
    lowercaseQuery.includes("trend") ||
    lowercaseQuery.includes("pattern") ||
    lowercaseQuery.includes("compare")
  ) {
    queryType = "analysis";
  }

  // Extract important keywords
  const keywords: string[] = [];
  const medicalTerms = [
    "diabetes",
    "hypertension",
    "otitis",
    "asthma",
    "heart disease",
    "cardiac",
    "cancer",
    "arthritis",
    "condition",
    "disease",
  ];

  // Only add medical terms if they're explicitly mentioned
  medicalTerms.forEach((term) => {
    if (lowercaseQuery.includes(term)) {
      keywords.push(term);
    }
  });

  // Don't assume conditions if not explicitly mentioned
  if (
    lowercaseQuery.includes("with their conditions") &&
    keywords.length === 0
  ) {
    // This is asking for conditions in general, not a specific condition
    keywords.push(""); // Empty string to indicate any condition
  }

  // Extract filters
  const filters: Record<string, string> = {};

  // Year filter
  const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches && yearMatches.length > 0) {
    filters.year = yearMatches[0];
  }

  // Gender filter
  if (
    lowercaseQuery.includes(" male") ||
    lowercaseQuery.includes("males") ||
    lowercaseQuery.includes(" men") ||
    lowercaseQuery.includes(" man")
  ) {
    filters.gender = "M";
  } else if (
    lowercaseQuery.includes("female") ||
    lowercaseQuery.includes("females") ||
    lowercaseQuery.includes("women") ||
    lowercaseQuery.includes("woman")
  ) {
    filters.gender = "F";
  }

  // Race filter
  const races = ["white", "black", "asian", "hispanic", "native", "other"];
  for (const race of races) {
    if (lowercaseQuery.includes(race)) {
      filters.race = race;
      break;
    }
  }

  // Determine complexity
  let complexity: "simple" | "moderate" | "complex" = "simple";

  if (keywords.length > 0 && Object.keys(filters).length > 0) {
    complexity = "complex";
  } else if (keywords.length > 0 || Object.keys(filters).length > 0) {
    complexity = "moderate";
  }

  return {
    queryType,
    keywords,
    filters,
    complexity,
    exactQuery,
    generalQuery,
  };
}
