// app/utils/queryUtils.ts

import { QueryIntent } from "./queryIntentAnalyzer";

/**
 * Cleans up AQL query text from LLM response
 */
export function cleanAqlQuery(text: string): string {
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

/**
 * Checks if the query results are valid/relevant based on the original query intent
 */
export function isValidResult(
  results: any[],
  queryType: string,
  originalQuery: string,
  intent: QueryIntent
): boolean {
  if (!results || results.length === 0) {
    return false;
  }

  // For count queries, we expect different result structures
  if (queryType === "count") {
    // If we're explicitly asking for a count but getting a list of IDs/nodes
    if (
      originalQuery.toLowerCase().includes("how many") &&
      results.length > 10 &&
      typeof results[0] !== "number" &&
      !results[0].hasOwnProperty("count")
    ) {
      // This is likely returning a list of nodes instead of a count
      return false;
    }

    // If a single number, it's valid for a count query
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

    // If it's a distribution array
    if (
      results.length > 1 &&
      results[0] &&
      (results[0].count || results[0].value)
    ) {
      return true;
    }

    // For "how many" queries, we should only accept count results, not lists
    if (originalQuery.toLowerCase().startsWith("how many")) {
      return false;
    }
  }

  // For data queries about patients with gender
  if (queryType === "data" && intent.filters.gender) {
    // Check if the results have valid gender values (M or F)
    const hasValidGenders = results.some((item) => {
      const gender = item.gender || item.Gender || item.GENDER;
      return gender === intent.filters.gender;
    });
    return hasValidGenders;
  }

  // For data queries about patients with birthdate
  if (queryType === "data" && intent.filters.year) {
    // Check if the results have non-empty birthdate values with the right year
    const hasValidBirthdates = results.some((item) => {
      const birthdate = item.birthdate || item.Birthdate || item.BIRTHDATE;
      return (
        birthdate &&
        typeof birthdate === "string" &&
        birthdate.includes(intent.filters.year)
      );
    });
    return hasValidBirthdates;
  }

  // For condition-specific queries
  if (intent.keywords.length > 0 && !intent.generalQuery) {
    // Check if the results contain condition information
    const hasConditionInfo = results.some((item) => {
      const condition =
        item.condition ||
        item.CONDITION ||
        item.Description ||
        item.DESCRIPTION;
      return (
        condition &&
        typeof condition === "string" &&
        intent.keywords.some(
          (keyword) =>
            keyword && condition.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    });
    return hasConditionInfo;
  }

  // For general patient queries, any results with patient data are valid
  if (intent.generalQuery && results.length > 0) {
    const hasPatientData = results.some((item) => {
      return item.id || item.ID || item.patient_id;
    });
    return hasPatientData;
  }

  // Default to true for other types or if we have results
  return results.length > 0;
}

/**
 * Generates a natural language conclusion based on the query results and intent
 */
export function generateConclusion(
  results: any[],
  queryType: string,
  intent: QueryIntent
): string {
  if (!results || results.length === 0) {
    let noResultsMessage = "The query returned no results. ";

    if (intent.keywords.length > 0 && intent.filters.year) {
      noResultsMessage += `There appear to be no patients with ${intent.keywords.join(
        ", "
      )} born in ${intent.filters.year} in the database.`;
    } else if (intent.filters.year) {
      noResultsMessage += `There appear to be no patients born in ${intent.filters.year} in the database.`;
    } else if (intent.keywords.length > 0) {
      noResultsMessage += `There appear to be no patients with ${intent.keywords.join(
        ", "
      )} matching your criteria.`;
    } else {
      noResultsMessage += "There may not be any data matching your criteria.";
    }

    return noResultsMessage;
  }

  // For count queries
  if (queryType === "count") {
    if (results.length === 1 && typeof results[0] === "number") {
      let entityDescription = "records";

      if (intent.filters.gender) {
        entityDescription =
          intent.filters.gender === "M" ? "male patients" : "female patients";
      } else if (intent.keywords.length > 0) {
        entityDescription = `patients with ${intent.keywords.join(", ")}`;

        if (intent.filters.year) {
          entityDescription += ` born in ${intent.filters.year}`;
        }
      } else if (intent.filters.race) {
        entityDescription = `patients with race '${intent.filters.race}'`;
      } else if (intent.filters.year) {
        entityDescription = `patients born in ${intent.filters.year}`;
      }

      return `There are ${results[0].toLocaleString()} ${entityDescription} matching your criteria.`;
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

    // For race distribution
    if (
      results.length > 1 &&
      results[0] &&
      (results[0].race !== undefined || results[0].count !== undefined)
    ) {
      let topRace = results[0].race || "";
      let topCount = results[0].count || 0;

      return `Found ${
        results.length
      } different demographic categories. The most common is '${topRace}' with ${topCount.toLocaleString()} patients.`;
    }
  }

  // For data queries
  if (queryType === "data") {
    let description = "results";
    let conditionInfo = "";

    // Check if we have condition data or not
    const hasConditionData = results.some(
      (item) => item.condition || item.CONDITION
    );

    if (intent.keywords.length > 0 && hasConditionData) {
      description = `patients with ${intent.keywords.join(", ")}`;

      if (intent.filters.year) {
        description += ` born in ${intent.filters.year}`;
      }

      if (intent.filters.gender) {
        description += ` who are ${
          intent.filters.gender === "M" ? "male" : "female"
        }`;
      }

      if (intent.filters.race) {
        description += ` with race '${intent.filters.race}'`;
      }
    } else if (intent.filters.year) {
      description = `patients born in ${intent.filters.year}`;

      if (!hasConditionData && intent.generalQuery) {
        conditionInfo =
          " To see conditions for these patients, you can ask specifically about their conditions.";
      }

      if (intent.filters.gender) {
        description += ` who are ${
          intent.filters.gender === "M" ? "male" : "female"
        }`;
      }
    } else if (intent.filters.gender) {
      description = `${
        intent.filters.gender === "M" ? "male" : "female"
      } patients`;
    }

    return `The query returned ${results.length} ${description}.${conditionInfo}`;
  }

  // Generic fallback
  return `The query returned ${results.length} results that match your criteria.`;
}

/**
 * Generates a fallback query for patients born in a specific year
 */
export function generateYearPatientFallbackQuery(year: string): string {
  return `
    FOR node IN MedGraph_node
      FILTER node.type == 'patient'
      FILTER CONTAINS(node.BIRTHDATE, '${year}')
      SORT node.BIRTHDATE DESC
      LIMIT 15
      RETURN { 
        id: node.ID, 
        birthdate: node.BIRTHDATE, 
        gender: node.GENDER, 
        race: node.RACE 
      }
  `;
}

/**
 * Generates a fallback query for counting by specific criteria
 */
export function generateCountFallbackQuery(intent: QueryIntent): string {
  // Count by race
  if (intent.filters.race) {
    return `
      RETURN LENGTH(
        FOR node IN MedGraph_node
          FILTER node.type == 'patient'
          FILTER CONTAINS(LOWER(node.RACE), "${intent.filters.race.toLowerCase()}")
          RETURN 1
      )
    `;
  }

  // Count by gender
  if (intent.filters.gender) {
    return `
      RETURN LENGTH(
        FOR node IN MedGraph_node
          FILTER node.type == 'patient'
          FILTER node.GENDER == '${intent.filters.gender}'
          RETURN 1
      )
    `;
  }

  // Count by year
  if (intent.filters.year) {
    return `
      RETURN LENGTH(
        FOR node IN MedGraph_node
          FILTER node.type == 'patient'
          FILTER CONTAINS(node.BIRTHDATE, '${intent.filters.year}')
          RETURN 1
      )
    `;
  }

  // Count by condition
  if (intent.keywords.length > 0) {
    return `
      RETURN LENGTH(
        FOR node IN MedGraph_node
          FILTER node.type == 'condition'
          FILTER CONTAINS(LOWER(node.DESCRIPTION), "${intent.keywords[0].toLowerCase()}")
          RETURN 1
      )
    `;
  }

  // Generic gender distribution fallback
  return `
    RETURN {
      male: LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'M' RETURN 1),
      female: LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' AND node.GENDER == 'F' RETURN 1)
    }
  `;
}

/**
 * Generates a dynamic thought based on the query type and intent
 */
export function generateThought(intent: QueryIntent): string {
  if (intent.queryType === "count") {
    if (intent.keywords.length > 0) {
      return `To answer this counting question, I need to query the MedGraph database for statistics about patients with ${intent.keywords.join(
        ", "
      )}.`;
    } else if (intent.filters.year) {
      return `To answer this counting question, I need to query the MedGraph database for statistics about patients born in ${intent.filters.year}.`;
    } else if (intent.filters.gender) {
      return `To answer this counting question, I need to query the MedGraph database for statistics about ${
        intent.filters.gender === "M" ? "male" : "female"
      } patients.`;
    } else if (intent.filters.race) {
      return `To answer this counting question, I need to query the MedGraph database for statistics about patients with race '${intent.filters.race}'.`;
    } else {
      return `To answer this counting question, I need to query the MedGraph database for patient statistics.`;
    }
  } else if (intent.queryType === "data") {
    if (intent.generalQuery && intent.filters.year) {
      return `This question asks for patient records from ${intent.filters.year}. I'll query the database for patients born in that year.`;
    } else if (intent.keywords.length > 0 && intent.filters.year) {
      return `This question asks for patients with ${intent.keywords.join(
        ", "
      )} born in ${
        intent.filters.year
      }. I'll query the database using an optimized pattern.`;
    } else if (intent.keywords.length > 0) {
      return `This question requires retrieving patients with ${intent.keywords.join(
        ", "
      )} from the database.`;
    } else {
      return `This question requires retrieving specific patient records from the MedGraph database.`;
    }
  } else {
    return `This question requires analyzing data patterns in the MedGraph database to identify trends and relationships.`;
  }
}
