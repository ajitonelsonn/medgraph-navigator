import { NextResponse } from "next/server";
import { Database, aql } from "arangojs";

// Initialize ArangoDB connection
const db = new Database({
  url: process.env.ARANGODB_URL,
  databaseName: process.env.ARANGODB_DATABASE,
  auth: {
    username: process.env.ARANGODB_USERNAME || "root",
    password: process.env.ARANGODB_PASSWORD || "",
  },
});

export async function GET() {
  try {
    // Simplified gender distribution query
    const genderDistributionQuery = aql`
      FOR node IN MedGraph_node
      FILTER node.type == 'patient'
      LET normalizedGender = (
        node.GENDER == 'M' ? 'Male' : 
        (node.GENDER == 'F' ? 'Female' : 'Other/Unknown')
      )
      COLLECT gender = normalizedGender WITH COUNT INTO count
      SORT count DESC
      RETURN { name: gender, value: count }
    `;

    const genderDistribution = await db
      .query(genderDistributionQuery)
      .then((cursor) => cursor.all());

    // Simplified age distribution query - adding indexing hint
    const ageDistributionQuery = aql`
      FOR node IN MedGraph_node
      FILTER node.type == 'patient'
      LET birthYear = SUBSTRING(node.BIRTHDATE, 0, 4)
      LET age = 2017 - TO_NUMBER(birthYear)
      LET ageGroup = 
        age <= 17 ? '0-17' :
        age <= 34 ? '18-34' :
        age <= 50 ? '35-50' :
        age <= 65 ? '51-65' :
        age <= 80 ? '66-80' : '81+'
      COLLECT group = ageGroup WITH COUNT INTO groupCount
      SORT group
      RETURN { age: group, count: groupCount }
    `;

    const ageDistribution = await db
      .query(ageDistributionQuery)
      .then((cursor) => cursor.all());

    // Simplified race distribution - limiting to top 10 for performance
    const raceDistributionQuery = aql`
      FOR node IN MedGraph_node
    FILTER node.type == 'patient'
    LET race = (
        node.RACE == "white" || 
        node.RACE == "hispanic" || 
        node.RACE == "black" || 
        node.RACE == "asian" || 
        node.RACE == "native"
    ) ? node.RACE : "Unknown"
    COLLECT raceCategory = race WITH COUNT INTO count
    SORT count DESC
    RETURN { name: raceCategory, count: count }
    `;

    const raceDistribution = await db
      .query(raceDistributionQuery)
      .then((cursor) => cursor.all());

    // Simplified patient growth - only focusing on 2017
    const patientGrowthQuery = aql`
        FOR node IN MedGraph_node
  FILTER node.type == 'encounter'
  FILTER LIKE(node.DATE, '2017-%')
  LET monthNum = SUBSTRING(node.DATE, 5, 2)
  COLLECT month = monthNum WITH COUNT INTO patientCount
  LET monthInt = TO_NUMBER(month)
  SORT monthInt
  RETURN {
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthInt-1],
    patients: patientCount
  }
    `;

    const patientGrowth = await db
      .query(patientGrowthQuery)
      .then((cursor) => cursor.all());

    return NextResponse.json({
      genderDistribution,
      ageDistribution,
      raceDistribution,
      patientGrowth,
    });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch demographics analytics" },
      { status: 500 }
    );
  }
}
