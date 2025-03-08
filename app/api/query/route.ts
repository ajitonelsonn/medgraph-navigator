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

// Function to directly generate optimized query for common patterns
function generateOptimizedQueryForCommonPatterns(
  userQuery: string
): string | null {
  const lowercaseQuery = userQuery.toLowerCase();

  // Extract condition if present
  let conditionTerm = "";
  if (lowercaseQuery.includes("diabetes")) {
    conditionTerm = "diabetes";
  } else if (lowercaseQuery.includes("hypertension")) {
    conditionTerm = "hypertension";
  } else if (lowercaseQuery.includes("otitis")) {
    conditionTerm = "otitis";
  } else if (lowercaseQuery.includes("asthma")) {
    conditionTerm = "asthma";
  } else if (
    lowercaseQuery.includes("heart disease") ||
    lowercaseQuery.includes("cardiac")
  ) {
    conditionTerm = "heart";
  } else if (
    lowercaseQuery.includes("condition") &&
    !lowercaseQuery.includes("count") &&
    !lowercaseQuery.startsWith("how many")
  ) {
    // Generic condition case, but not for counting queries
    // Extract potential condition term after "condition" word
    const afterCondition = lowercaseQuery.split("condition")[1];
    if (afterCondition && afterCondition.trim()) {
      // Use first word after "condition" as potential condition term
      const words = afterCondition.trim().split(/\s+/);
      if (words.length > 0) {
        conditionTerm = words[0].replace(/[^\w]/g, ""); // Remove non-word chars
      }
    }

    if (!conditionTerm) {
      conditionTerm = "condition"; // Fallback
    }
  } else {
    // No recognized condition term
    return null;
  }

  // Extract year if present
  const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);
  const yearFilter =
    yearMatches && yearMatches.length > 0
      ? `FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "${yearMatches[0]}")`
      : "";

  // Extract gender if present
  let genderFilter = "";
  if (lowercaseQuery.includes(" male") || lowercaseQuery.includes("males")) {
    genderFilter = `FILTER patient.GENDER == 'M'`;
  } else if (
    lowercaseQuery.includes("female") ||
    lowercaseQuery.includes("females")
  ) {
    genderFilter = `FILTER patient.GENDER == 'F'`;
  }

  // Extract race if present
  let raceFilter = "";
  const races = ["white", "black", "asian", "hispanic", "native", "other"];
  for (const race of races) {
    if (lowercaseQuery.includes(race)) {
      raceFilter = `FILTER CONTAINS(LOWER(patient.RACE), "${race}")`;
      break;
    }
  }

  // Generate optimized query
  return `
    LET entity = "${conditionTerm}"
    
    // Get all matching conditions first
    LET matching_conditions = (
      FOR doc IN MedGraph_node
        FILTER doc.type == "condition"
        FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
        LIMIT 10000
        RETURN doc
    )
    
    // Process patient lookup in a separate phase
    FOR condition IN matching_conditions
      // Find encounter edges
      LET encounter_edges = (
        FOR enc_edge IN MedGraph_node_to_MedGraph_node
          FILTER enc_edge._to == condition._id
          FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
          LIMIT 2
          RETURN enc_edge
      )
      
      FILTER LENGTH(encounter_edges) > 0
      
      LET encounter = DOCUMENT(encounter_edges[0]._from)
      
      // Find patient edges
      LET patient_edges = (
        FOR pat_edge IN MedGraph_node_to_MedGraph_node
          FILTER pat_edge._to == encounter._id
          FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
          LIMIT 1
          RETURN pat_edge
      )
      
      FILTER LENGTH(patient_edges) > 0
      
      LET patient = DOCUMENT(patient_edges[0]._from)
      
      FILTER patient.type == 'patient'
      ${yearFilter}
      ${genderFilter}
      ${raceFilter}
      
      LIMIT 15
      RETURN DISTINCT {
        id: patient.ID,
        gender: patient.GENDER,
        birthdate: patient.BIRTHDATE,
        race: patient.RACE,
        condition: condition.DESCRIPTION
      }
  `;
}

// Function to determine if a query might benefit from the optimized pattern
function isComplexRelationshipQuery(query: string): boolean {
  if (!query) {
    return false; // Handle null or empty query case explicitly
  }

  const lowercaseQuery = query.toLowerCase();

  // Check if it's likely a complex query involving conditions, encounters, and patients
  return (
    (lowercaseQuery.includes("patient") &&
      lowercaseQuery.includes("condition")) ||
    (lowercaseQuery.includes("diabetes") &&
      (lowercaseQuery.includes("patient") ||
        lowercaseQuery.includes("birthdate"))) ||
    (lowercaseQuery.includes("disease") &&
      lowercaseQuery.includes("patient")) ||
    (lowercaseQuery.includes("year") && lowercaseQuery.includes("condition")) ||
    (lowercaseQuery.match(/\b(19|20)\d{2}\b/g) !== null &&
      lowercaseQuery.includes("condition"))
  );
}

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

    6. List patients with specific demographics:
       FOR node IN MedGraph_node
         FILTER node.type == 'patient'
         FILTER node.GENDER == 'F' OR node.GENDER == 'M'
         SORT node.BIRTHDATE DESC
         LIMIT 15
         RETURN { 
           id: node.ID, 
           gender: node.GENDER, 
           birthdate: node.BIRTHDATE, 
           race: node.RACE 
         }

    7. Find patients with specific conditions:
       FOR node IN MedGraph_node
         FILTER node.type == 'condition'
         FILTER LOWER(node.DESCRIPTION) LIKE '%otitis media%'
         FOR patient IN MedGraph_node
           FILTER patient.type == 'patient' 
           FILTER patient.id == node.PATIENT || patient._id == node.PATIENT
           LIMIT 15
           RETURN {
             condition: node.DESCRIPTION,
             code: node.CODE,
             patient_id: patient.id,
             gender: patient.GENDER,
             race: patient.RACE,
             birthdate: patient.BIRTHDATE
           }

    8. Graph traversal for conditions and patients:
       FOR condition IN MedGraph_node
         FILTER condition.type == 'condition'
         FILTER CONTAINS(LOWER(condition.DESCRIPTION), "diabetes")
         FOR encounter IN INBOUND condition MedGraph_node_to_MedGraph_node
           FILTER encounter.type == 'encounter'
           FOR patient IN INBOUND encounter MedGraph_node_to_MedGraph_node
             FILTER patient.type == 'patient'
             LIMIT 15
             RETURN DISTINCT {
               patient_id: patient.ID,
               gender: patient.GENDER,
               birthdate: patient.BIRTHDATE,
               condition: condition.DESCRIPTION
             }

    9. Using variables for filtering:
       LET queryIntent = { gender: "F" }
       FOR node IN MedGraph_node
         FILTER node.type == 'patient' AND node.GENDER == queryIntent.gender
         SORT node.BIRTHDATE DESC
         LIMIT 15
         RETURN { 
           id: node.ID, 
           gender: node.GENDER, 
           birthdate: node.BIRTHDATE, 
           race: node.RACE 
         }

    10. Advanced condition to patient relationship query:
        LET entity = "diabetes"
        // Get all matching conditions first
        LET matching_conditions = (
          FOR doc IN MedGraph_node
            FILTER doc.type == "condition"
            FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
            LIMIT 100
            RETURN doc
        )
        
        // Then process patient lookup in a separate phase
        FOR condition IN matching_conditions
          // Find encounter edges that connect to this condition
          LET encounter_edges = (
            FOR enc_edge IN MedGraph_node_to_MedGraph_node
              FILTER enc_edge._to == condition._id
              FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
              LIMIT 2
              RETURN enc_edge
          )
          
          FILTER LENGTH(encounter_edges) > 0
          
          LET encounter = DOCUMENT(encounter_edges[0]._from)
          
          // Find patient edges that connect to this encounter
          LET patient_edges = (
            FOR pat_edge IN MedGraph_node_to_MedGraph_node
              FILTER pat_edge._to == encounter._id
              FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
              LIMIT 1
              RETURN pat_edge
          )
          
          FILTER LENGTH(patient_edges) > 0
          
          LET patient = DOCUMENT(patient_edges[0]._from)
          
          LIMIT 15
          RETURN DISTINCT {
            id: patient.ID,
            gender: patient.GENDER,
            race: patient.RACE,
            condition: condition.DESCRIPTION
          }
          
    11. OPTIMIZED QUERY PATTERN - For complex relationship queries:
        // AVOID THIS SLOW APPROACH:
        // FOR condition IN MedGraph_node
        //   FILTER condition.type == 'condition'
        //   FILTER CONTAINS(LOWER(condition.DESCRIPTION), "diabetes")
        //   FOR encounter IN INBOUND condition MedGraph_node_to_MedGraph_node
        //     FILTER encounter.type == 'encounter'
        //     FOR patient IN INBOUND encounter MedGraph_node_to_MedGraph_node
        //       FILTER patient.type == 'patient'
        //       FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "1964")
        //       LIMIT 15
        //       RETURN DISTINCT { ... }
        
        // USE THIS FASTER APPROACH INSTEAD:
        LET entity = "diabetes"
        // Step 1: Get all matching conditions first
        LET matching_conditions = (
          FOR doc IN MedGraph_node
            FILTER doc.type == "condition"
            FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
            LIMIT 10000
            RETURN doc
        )
        
        // Step 2: Process patient lookup in a separate phase
        FOR condition IN matching_conditions
          // Find encounter edges that connect to this condition
          LET encounter_edges = (
            FOR enc_edge IN MedGraph_node_to_MedGraph_node
              FILTER enc_edge._to == condition._id
              FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
              LIMIT 2
              RETURN enc_edge
          )
          
          FILTER LENGTH(encounter_edges) > 0
          
          LET encounter = DOCUMENT(encounter_edges[0]._from)
          
          // Find patient edges that connect to this encounter
          LET patient_edges = (
            FOR pat_edge IN MedGraph_node_to_MedGraph_node
              FILTER pat_edge._to == encounter._id
              FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
              LIMIT 1
              RETURN pat_edge
          )
          
          FILTER LENGTH(patient_edges) > 0
          
          LET patient = DOCUMENT(patient_edges[0]._from)
          
          // Step 3: Apply filters at the final stage
          FILTER patient.type == 'patient'
          FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "1964")
          
          LIMIT 15
          RETURN DISTINCT {
            id: patient.ID,
            gender: patient.GENDER,
            birthdate: patient.BIRTHDATE,
            race: patient.RACE,
            condition: condition.DESCRIPTION
          }
          
    12. PATIENTS WITH DIABETES BORN IN SPECIFIC YEAR:
        // This is the optimized pattern for queries about patients with conditions and birth year
        LET entity = "diabetes"
        
        // Step 1: Get matching conditions
        LET matching_conditions = (
          FOR doc IN MedGraph_node
            FILTER doc.type == "condition"
            FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
            LIMIT 10000
            RETURN doc
        )
        
        // Step 2: Process patient lookup in stages
        FOR condition IN matching_conditions
          LET encounter_edges = (
            FOR enc_edge IN MedGraph_node_to_MedGraph_node
              FILTER enc_edge._to == condition._id
              FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
              LIMIT 2
              RETURN enc_edge
          )
          
          FILTER LENGTH(encounter_edges) > 0
          
          LET encounter = DOCUMENT(encounter_edges[0]._from)
          
          LET patient_edges = (
            FOR pat_edge IN MedGraph_node_to_MedGraph_node
              FILTER pat_edge._to == encounter._id
              FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
              LIMIT 1
              RETURN pat_edge
          )
          
          FILTER LENGTH(patient_edges) > 0
          
          LET patient = DOCUMENT(patient_edges[0]._from)
          
          // Step 3: Apply birth year filter
          FILTER patient.type == 'patient'
          FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "1964")
          
          LIMIT 15
          RETURN DISTINCT {
            id: patient.ID,
            gender: patient.GENDER,
            birthdate: patient.BIRTHDATE,
            race: patient.RACE,
            condition: condition.DESCRIPTION
          }
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
    lowercaseQuery.includes("find") ||
    lowercaseQuery.includes("patients with") ||
    (lowercaseQuery.includes("patient") &&
      (lowercaseQuery.includes("diabetes") ||
        lowercaseQuery.includes("condition") ||
        lowercaseQuery.includes("disease")))
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

  // For condition-specific queries
  if (
    originalQuery.toLowerCase().includes("condition") ||
    originalQuery.toLowerCase().includes("diabetes") ||
    originalQuery.toLowerCase().includes("otitis")
  ) {
    // Check if the results contain condition information
    const hasConditionInfo = results.some((item) => {
      const condition =
        item.condition ||
        item.CONDITION ||
        item.Description ||
        item.DESCRIPTION;
      return condition && typeof condition === "string" && condition.length > 0;
    });
    return hasConditionInfo;
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
  // First, check if this is a condition + year query that should use the optimized pattern
  const lowerQuery = originalQuery.toLowerCase();
  const hasCondition =
    lowerQuery.includes("condition") ||
    lowerQuery.includes("diabetes") ||
    lowerQuery.includes("otitis") ||
    lowerQuery.includes("disease");
  const hasYear = lowerQuery.match(/\b(19|20)\d{2}\b/g) !== null;

  // If it's a condition + year query, directly use optimized pattern
  if (hasCondition && hasYear) {
    const optimizedQuery =
      generateOptimizedQueryForCommonPatterns(originalQuery);
    if (optimizedQuery) {
      console.log("Using optimized query pattern for condition + year query");
      return optimizedQuery;
    }
  }

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
      8. For condition queries, use LOWER() with CONTAINS() or LIKE to make case-insensitive matches
      9. When traversing relationships, use proper edge collections like MedGraph_node_to_MedGraph_node
      10. For complex relationships like finding patients with conditions, consider using temporary variables with LET
      11. For complex queries involving conditions and patients, always use the optimized pattern shown in example #11 and #12
      12. Break down complex queries into stages using LET statements for better performance
      13. For questions involving patients with conditions AND birth years, always use the optimized pattern in example #12
      
      IMPROVED AQL QUERY:
    `;

    const generation = await llm.invoke(prompt);
    return cleanAqlQuery(generation);
  } catch (error) {
    console.error("Error generating better query:", error);

    // Check if this is a condition + year query again as fallback
    if (hasCondition) {
      // Extract condition term
      let conditionTerm = "condition";
      if (lowerQuery.includes("diabetes")) {
        conditionTerm = "diabetes";
      } else if (lowerQuery.includes("otitis")) {
        conditionTerm = "otitis";
      } else if (lowerQuery.includes("hypertension")) {
        conditionTerm = "hypertension";
      }

      // Extract year if present
      const yearMatches = originalQuery.match(/\b(19|20)\d{2}\b/g);
      const yearFilter =
        yearMatches && yearMatches.length > 0
          ? `FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "${yearMatches[0]}")`
          : "";

      // Fallback to hardcoded optimized pattern
      return `
        LET entity = "${conditionTerm}"
        
        // Get all matching conditions first
        LET matching_conditions = (
          FOR doc IN MedGraph_node
            FILTER doc.type == "condition"
            FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
            LIMIT 10000
            RETURN doc
        )
        
        // Process patient lookup in a separate phase
        FOR condition IN matching_conditions
          // Find encounter edges
          LET encounter_edges = (
            FOR enc_edge IN MedGraph_node_to_MedGraph_node
              FILTER enc_edge._to == condition._id
              FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
              LIMIT 2
              RETURN enc_edge
          )
          
          FILTER LENGTH(encounter_edges) > 0
          
          LET encounter = DOCUMENT(encounter_edges[0]._from)
          
          // Find patient edges
          LET patient_edges = (
            FOR pat_edge IN MedGraph_node_to_MedGraph_node
              FILTER pat_edge._to == encounter._id
              FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
              LIMIT 1
              RETURN pat_edge
          )
          
          FILTER LENGTH(patient_edges) > 0
          
          LET patient = DOCUMENT(patient_edges[0]._from)
          
          FILTER patient.type == 'patient'
          ${yearFilter}
          
          LIMIT 15
          RETURN DISTINCT {
            id: patient.ID,
            gender: patient.GENDER,
            birthdate: patient.BIRTHDATE,
            race: patient.RACE,
            condition: condition.DESCRIPTION
          }
      `;
    }

    // Fallback for gender queries
    if (lowerQuery.includes("gender")) {
      return `
        FOR node IN MedGraph_node
          FILTER node.type == 'patient' AND (node.GENDER == 'M' OR node.GENDER == 'F')
          SORT node.BIRTHDATE DESC
          LIMIT 15
          RETURN { birthdate: node.BIRTHDATE, gender: node.GENDER, race: node.RACE }
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
        RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER, race: node.RACE }
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

    // PRE-PROCESS: Check if this is a common pattern that should use the optimized approach
    // Like patients with a condition born in a specific year
    const directOptimizedQuery =
      generateOptimizedQueryForCommonPatterns(userQuery);
    if (directOptimizedQuery) {
      console.log(
        "Using direct optimized query pattern based on query pattern recognition"
      );
      aqlQuery = directOptimizedQuery;
      attemptHistory.push(aqlQuery);
    } else {
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
        9. For condition queries, always use LOWER() and CONTAINS() or LIKE for case-insensitive matching
        10. For complex relationship traversals, use the example patterns from the schema examples
        11. For complex queries involving conditions and patients, use the optimized pattern from example #11 to avoid performance issues
        12. Break down complex queries into stages using LET statements for better performance
        13. For queries involving patients with conditions AND birth years, always use the optimized pattern in example #12
        
        AQL QUERY:
      `;

      try {
        // Get the initial query from LLM
        const generation = await llm.invoke(prompt);
        aqlQuery = cleanAqlQuery(generation);
        attemptHistory.push(aqlQuery);
      } catch (error) {
        console.error("Error generating initial query:", error);

        // Check if this query would benefit from optimized pattern
        const isComplexQuery = isComplexRelationshipQuery(userQuery);

        if (isComplexQuery) {
          // Use optimized pattern for complex relationship queries
          const optimizedQuery =
            generateOptimizedQueryForCommonPatterns(userQuery);
          if (optimizedQuery) {
            aqlQuery = optimizedQuery;
          } else {
            // Fallback for condition queries with simple pattern
            const lowercaseQuery = userQuery.toLowerCase();
            let conditionTerm = lowercaseQuery.includes("diabetes")
              ? "diabetes"
              : lowercaseQuery.includes("otitis")
              ? "otitis"
              : "condition";

            // Extract year if present
            const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);
            const yearFilter =
              yearMatches && yearMatches.length > 0
                ? `FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "${yearMatches[0]}")`
                : "";

            aqlQuery = `
              LET entity = "${conditionTerm}"
              
              // Get all matching conditions first
              LET matching_conditions = (
                FOR doc IN MedGraph_node
                  FILTER doc.type == "condition"
                  FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
                  LIMIT 10000
                  RETURN doc
              )
              
              // Process patient lookup in a separate phase
              FOR condition IN matching_conditions
                // Find encounter edges
                LET encounter_edges = (
                  FOR enc_edge IN MedGraph_node_to_MedGraph_node
                    FILTER enc_edge._to == condition._id
                    FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
                    LIMIT 2
                    RETURN enc_edge
                )
                
                FILTER LENGTH(encounter_edges) > 0
                
                LET encounter = DOCUMENT(encounter_edges[0]._from)
                
                // Find patient edges
                LET patient_edges = (
                  FOR pat_edge IN MedGraph_node_to_MedGraph_node
                    FILTER pat_edge._to == encounter._id
                    FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
                    LIMIT 1
                    RETURN pat_edge
                )
                
                FILTER LENGTH(patient_edges) > 0
                
                LET patient = DOCUMENT(patient_edges[0]._from)
                
                FILTER patient.type == 'patient'
                ${yearFilter}
                
                LIMIT 15
                RETURN DISTINCT {
                  id: patient.ID,
                  gender: patient.GENDER,
                  birthdate: patient.BIRTHDATE,
                  race: patient.RACE,
                  condition: condition.DESCRIPTION
                }
            `;
          }
        } else if (userQuery.toLowerCase().includes("gender")) {
          aqlQuery = `
            FOR node IN MedGraph_node
              FILTER node.type == 'patient' AND (node.GENDER == 'M' OR node.GENDER == 'F')
              SORT node.BIRTHDATE DESC
              LIMIT 15
              RETURN { birthdate: node.BIRTHDATE, gender: node.GENDER, race: node.RACE }
          `;
        } else {
          aqlQuery = `
            FOR node IN MedGraph_node
              FILTER node.type == 'patient'
              SORT node.BIRTHDATE DESC
              LIMIT 15
              RETURN { id: node.ID, birthdate: node.BIRTHDATE, gender: node.GENDER, race: node.RACE }
          `;
        }

        attemptHistory.push(aqlQuery);
      }
    }

    // Try executing the query, refining up to maxAttempts times if needed
    let queryTimedOut = false;
    let useOptimizedPattern = isComplexRelationshipQuery(userQuery);

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Attempt ${attempts}:`, aqlQuery);

      try {
        // Execute the query with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          queryTimedOut = true;
        }, 60000); // 30 second timeout

        let queryResult;
        try {
          // Execute the query
          queryResult = await db.query(aqlQuery);
          result = await queryResult.all();
          clearTimeout(timeoutId);
        } catch (timeoutError) {
          if (queryTimedOut) {
            console.log("Query timed out, will try optimized pattern");

            // Force use of optimized pattern for next attempt
            useOptimizedPattern = true;

            // Extract key information from the query
            let conditionTerm = "condition";
            const lowercaseQuery = userQuery.toLowerCase();
            if (lowercaseQuery.includes("diabetes")) {
              conditionTerm = "diabetes";
            } else if (lowercaseQuery.includes("otitis")) {
              conditionTerm = "otitis";
            } else if (lowercaseQuery.includes("hypertension")) {
              conditionTerm = "hypertension";
            } else if (lowercaseQuery.includes("asthma")) {
              conditionTerm = "asthma";
            }

            // Extract year if present
            const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);
            const yearFilter =
              yearMatches && yearMatches.length > 0
                ? `FILTER CONTAINS(SUBSTRING(patient.BIRTHDATE, 0, 4), "${yearMatches[0]}")`
                : "";

            // Create an optimized query
            aqlQuery = `
              LET entity = "${conditionTerm}"
              
              // Get all matching conditions first
              LET matching_conditions = (
                FOR doc IN MedGraph_node
                  FILTER doc.type == "condition"
                  FILTER LOWER(doc.DESCRIPTION) LIKE CONCAT("%", LOWER(entity), "%")
                  LIMIT 10000
                  RETURN doc
              )
              
              // Then process patient lookup in a separate phase
              FOR condition IN matching_conditions
                // Find encounter edges
                LET encounter_edges = (
                  FOR enc_edge IN MedGraph_node_to_MedGraph_node
                    FILTER enc_edge._to == condition._id
                    FILTER enc_edge.relationship_type == 'ENCOUNTER_CONDITION'
                    LIMIT 2
                    RETURN enc_edge
                )
                
                FILTER LENGTH(encounter_edges) > 0
                
                LET encounter = DOCUMENT(encounter_edges[0]._from)
                
                // Find patient edges
                LET patient_edges = (
                  FOR pat_edge IN MedGraph_node_to_MedGraph_node
                    FILTER pat_edge._to == encounter._id
                    FILTER pat_edge.relationship_type == 'PATIENT_ENCOUNTER'
                    LIMIT 1
                    RETURN pat_edge
                )
                
                FILTER LENGTH(patient_edges) > 0
                
                LET patient = DOCUMENT(patient_edges[0]._from)
                
                FILTER patient.type == 'patient'
                ${yearFilter}
                
                LIMIT 15
                RETURN DISTINCT {
                  id: patient.ID,
                  gender: patient.GENDER,
                  birthdate: patient.BIRTHDATE,
                  race: patient.RACE,
                  condition: condition.DESCRIPTION
                }
            `;

            attemptHistory.push(aqlQuery);
            continue; // Skip to next iteration with the new optimized query
          } else {
            throw timeoutError; // Re-throw if it's not a timeout
          }
        }

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
          } else if (
            userQuery.toLowerCase().includes("condition") ||
            userQuery.toLowerCase().includes("diabetes") ||
            userQuery.toLowerCase().includes("disease")
          ) {
            errorMessage +=
              "Results don't contain the expected condition information.";
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
        } else if (result[0].male && result[0].female) {
          const total = result[0].male + result[0].female;
          conclusion = `There are ${result[0].male} male patients (${(
            (result[0].male / total) *
            100
          ).toFixed(1)}%) and ${result[0].female} female patients (${(
            (result[0].female / total) *
            100
          ).toFixed(1)}%).`;
        } else {
          conclusion = `The analysis returned a single result with the requested information.`;
        }
      } else if (
        userQuery.toLowerCase().includes("condition") ||
        userQuery.toLowerCase().includes("diabetes") ||
        userQuery.toLowerCase().includes("disease")
      ) {
        // For year-specific condition queries
        const yearMatches = userQuery.match(/\b(19|20)\d{2}\b/g);
        if (yearMatches && yearMatches.length > 0) {
          conclusion = `The query returned ${result.length} patients with the specified condition born in ${yearMatches[0]}.`;
        } else {
          conclusion = `The query returned ${result.length} patients with the specified condition.`;
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
