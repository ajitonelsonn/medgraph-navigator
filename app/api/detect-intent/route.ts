// app/api/detect-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TogetherAI } from "@langchain/community/llms/togetherai";

// Initialize LLM
const llm = new TogetherAI({
  apiKey: process.env.TOGETHER_API_KEY || "",
  model: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
  temperature: 0.1,
  maxTokens: 256,
});

// List of relevant medical database keywords (reused from query API)
const medicalDataKeywords = [
  "patient",
  "patients",
  "gender",
  "male",
  "female",
  "birth",
  "birthdate",
  "race",
  "ethnicity",
  "condition",
  "conditions",
  "medication",
  "medications",
  "procedure",
  "procedures",
  "observation",
  "observations",
  "allergy",
  "allergies",
  "careplan",
  "immunization",
  "immunizations",
  "encounter",
  "encounters",
  "data",
  "database",
  "medical",
  "healthcare",
  "health",
  "record",
  "records",
  "diagnose",
  "diagnosis",
  "diagnosed",
  "treatment",
  "treatments",
  "white",
  "age",
  "old",
  "young",
  "count",
  "statistics",
  "list",
  "show",
  "find",
  "search",
  "display",
  "query",
  "medgraph",
];

// Common greeting phrases
const greetingPhrases = [
  "hello",
  "hi",
  "hey",
  "greetings",
  "good morning",
  "good afternoon",
  "good evening",
  "how are you",
  "how's it going",
  "what's up",
];

// Common chatbot inquiry phrases
const chatbotInquiries = [
  "what is your name",
  "who are you",
  "what can you do",
  "help me",
  "tell me about yourself",
  "what do you know",
  "who made you",
  "how do you work",
  "tell me a joke",
  "tell me a story",
];

// Function to check if a string includes any phrase from an array
function containsPhraseFrom(text: string, phrases: string[]): boolean {
  const lowercaseText = text.toLowerCase();
  return phrases.some((phrase) => lowercaseText.includes(phrase));
}

// Interface for the response
interface IntentResponse {
  intent: "greeting" | "medical_query" | "off_topic";
  confidence: number;
  message: string;
  shouldProcessQuery: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const userQuery = (body.query as string) || "";

    if (!userQuery.trim()) {
      return NextResponse.json(
        {
          intent: "off_topic",
          confidence: 1.0,
          message: "Please type a question or query.",
          shouldProcessQuery: false,
        } as IntentResponse,
        { status: 400 }
      );
    }

    // Quick check for obvious cases first (without using the LLM)
    const lowercaseQuery = userQuery.toLowerCase();

    // Check if it's an obvious greeting
    if (
      containsPhraseFrom(lowercaseQuery, greetingPhrases) &&
      lowercaseQuery.split(" ").length < 5
    ) {
      return NextResponse.json({
        intent: "greeting",
        confidence: 0.95,
        message: getGreetingResponse(lowercaseQuery),
        shouldProcessQuery: false,
      } as IntentResponse);
    }

    // Check if it's a common chatbot inquiry
    if (
      containsPhraseFrom(lowercaseQuery, chatbotInquiries) &&
      !containsPhraseFrom(lowercaseQuery, medicalDataKeywords)
    ) {
      return NextResponse.json({
        intent: "off_topic",
        confidence: 0.9,
        message:
          "I'm a medical database assistant. I can help you query patient data, conditions, medications, and other medical information. Please ask me a question about the medical database.",
        shouldProcessQuery: false,
      } as IntentResponse);
    }

    // Check if it's an obvious medical query by keyword count
    const medicalKeywordCount = medicalDataKeywords.filter((keyword) =>
      lowercaseQuery.includes(keyword)
    ).length;

    if (medicalKeywordCount >= 2) {
      return NextResponse.json({
        intent: "medical_query",
        confidence: 0.8 + Math.min(medicalKeywordCount, 5) * 0.04, // Up to 0.2 additional confidence
        message: "",
        shouldProcessQuery: true,
      } as IntentResponse);
    }

    // For more ambiguous cases, use the LLM
    const prompt = `
      Determine the intent of the following user query to a medical database system.
      
      USER QUERY: "${userQuery}"
      
      Possible intents:
      1. greeting - User is simply greeting the system
      2. medical_query - User is asking about medical data, patients, conditions, etc.
      3. off_topic - User is asking something unrelated to medical data
      
      IMPORTANT:
      - The system is ONLY for querying a medical database with patient records, conditions, medications, etc.
      - Any query about seeing data, statistics, or information about patients, conditions, demographics, etc. is a medical_query.
      - If uncertain, categorize as off_topic.
      
      Respond with ONLY ONE of these three options: "greeting", "medical_query", or "off_topic"
    `;

    const llmResponse = await llm.invoke(prompt);
    const intent = llmResponse.trim().toLowerCase();

    // Prepare the response based on the detected intent
    let response: IntentResponse;

    if (intent.includes("greeting")) {
      response = {
        intent: "greeting",
        confidence: 0.85,
        message: getGreetingResponse(lowercaseQuery),
        shouldProcessQuery: false,
      };
    } else if (intent.includes("medical_query")) {
      response = {
        intent: "medical_query",
        confidence: 0.8,
        message: "",
        shouldProcessQuery: true,
      };
    } else {
      response = {
        intent: "off_topic",
        confidence: 0.75,
        message:
          "I'm here to help with queries related to the medical database. Please ask me about patient data, conditions, medications, or other medical information.",
        shouldProcessQuery: false,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Intent detection error:", error);

    return NextResponse.json(
      {
        intent: "off_topic",
        confidence: 0.5,
        message:
          "I encountered an error processing your query. Please try asking about the medical database.",
        shouldProcessQuery: false,
      } as IntentResponse,
      { status: 500 }
    );
  }
}

// Function to generate a friendly greeting response
function getGreetingResponse(query: string): string {
  const timeOfDay = new Date().getHours();
  let greeting = "Hello! ";

  if (timeOfDay < 12) {
    greeting = "Good morning! ";
  } else if (timeOfDay < 18) {
    greeting = "Good afternoon! ";
  } else {
    greeting = "Good evening! ";
  }

  return (
    greeting +
    "I'm your medical database assistant. How can I help you with patient data today?"
  );
}
