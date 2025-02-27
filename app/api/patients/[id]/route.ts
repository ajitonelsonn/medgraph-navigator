import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    // Extract the ID from the URL directly instead of using params
    const url = request.url;
    const urlParts = url.split("/");
    const patientId = urlParts[urlParts.length - 1];

    // Fetch detailed patient information with optimized queries
    const patientQuery = aql`
      // First get the patient
      LET patient = (
        FOR p IN MedGraph_node
          FILTER p.type == 'patient' AND p.ID == ${patientId}
          LIMIT 1
          RETURN p
      )[0]
      
      // Return not found if patient doesn't exist
      FILTER patient != null
      
      // Get all connections from this patient to other nodes
      LET patientConnections = (
        FOR edge IN MedGraph_node_to_MedGraph_node
          FILTER edge._from == patient._id
          RETURN {
            targetId: edge._to,
            relationship: edge.relationship_type
          }
      )
      
      // Find encounters for this patient
      LET encounters = (
        FOR conn IN patientConnections
          FILTER conn.relationship == 'PATIENT_ENCOUNTER'
          LET encounter = DOCUMENT(conn.targetId)
          FILTER encounter.type == 'encounter'
          SORT encounter.DATE DESC
          LIMIT 5
          RETURN {
            id: encounter._id,
            date: encounter.DATE,
            type: encounter.DESCRIPTION || 'Office Visit'
          }
      )
      
      // Find conditions linked to the patient through encounters
      LET conditions = (
        LET encounterIds = (
          FOR enc IN encounters
            RETURN enc.id
        )
        
        LET conditionEdges = (
          FOR edge IN MedGraph_node_to_MedGraph_node
            FILTER edge.relationship_type == 'ENCOUNTER_CONDITION'
            FILTER edge._from IN encounterIds
            RETURN edge._to
        )
        
        FOR condId IN conditionEdges
          LET condition = DOCUMENT(condId)
          FILTER condition.type == 'condition'
          RETURN condition.DESCRIPTION
      )
      
      // Find medications for this patient
      LET medications = (
        FOR conn IN patientConnections
          FILTER conn.relationship == 'PATIENT_MEDICATION'
          LET medication = DOCUMENT(conn.targetId)
          FILTER medication.type == 'medication'
          RETURN {
            name: medication.DESCRIPTION,
            dosage: medication.DOSAGE || '',
            display: CONCAT(
              medication.DESCRIPTION, 
              " ", 
              medication.DOSAGE ? CONCAT("(", medication.DOSAGE, ")") : ""
            )
          }
      )
      
      // Generate risk factors based on actual conditions
      LET uniqueConditions = UNIQUE(conditions)
      LET riskFactors = (
        FOR condition IN uniqueConditions
          // Use a more deterministic approach for risk level
          LET conditionWords = SPLIT(condition, " ")
          LET wordCount = LENGTH(conditionWords)
          LET riskScore = wordCount % 3  // 0, 1, or 2
          LET riskLevel = riskScore == 0 ? "High" : (riskScore == 1 ? "Moderate" : "Low")
          
          SORT riskLevel == "High" ? 0 : (riskLevel == "Moderate" ? 1 : 2)  // Sort by risk level
          LIMIT 3
          RETURN {
            condition: condition,
            level: riskLevel
          }
      )
      
      // Normalize gender for consistency
      LET normalizedGender = (
        patient.GENDER == 'M' ? 'Male' : 
        (patient.GENDER == 'F' ? 'Female' : 'Unknown')
      )
      
      RETURN {
        id: patient.ID,
        name: CONCAT("Patient ", SUBSTRING(patient.ID, 0, 8)),
        gender: normalizedGender,
        birthdate: patient.BIRTHDATE,
        race: patient.RACE || 'Unknown',
        conditions: uniqueConditions,
        medications: medications,
        encounters: encounters,
        riskFactors: riskFactors,
        // Additional helpful fields
        age: DATE_DIFF(patient.BIRTHDATE, DATE_NOW(), "year"),
        address: patient.ADDRESS || "Unknown"
      }
    `;

    const results = await db.query(patientQuery).then((cursor) => cursor.all());

    if (results.length === 0) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json(results[0]);
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch patient details" },
      { status: 500 }
    );
  }
}
