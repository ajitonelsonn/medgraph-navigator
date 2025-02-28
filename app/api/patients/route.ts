import { NextRequest, NextResponse } from "next/server";
import { aql } from "arangojs";
import { db } from "@/app/utils/db";

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Improved query with proper field filtering
    const patientsQuery = aql`
      // Get patients with validated gender
      LET patientsList = (
        FOR patient IN MedGraph_node
          FILTER patient.type == 'patient' AND (patient.GENDER == 'M' OR patient.GENDER == 'F')
          SORT patient.BIRTHDATE DESC
          LIMIT ${offset}, ${limit}
          
          // Normalize gender field
          LET normalizedGender = (
            patient.GENDER == 'M' ? 'Male' : 'Female'
          )
          
          RETURN {
            _id: patient._id,
            id: patient.ID,
            name: CONCAT("Patient ", SUBSTRING(patient.ID, 0, 8)),
            gender: normalizedGender,
            birthdate: patient.BIRTHDATE,
            race: patient.RACE || 'Unknown'
          }
      )
      
      // Get conditions for each patient
      FOR patient IN patientsList
        LET patientConditions = (
          // Find encounters for this patient
          LET patientEncounters = (
            FOR patientEdge IN MedGraph_node_to_MedGraph_node
              FILTER patientEdge._from == patient._id
              RETURN patientEdge._to
          )
          
          // Find conditions linked to these encounters
          FOR edge IN MedGraph_node_to_MedGraph_node
            FILTER edge.relationship_type == 'ENCOUNTER_CONDITION'
            FILTER edge._from IN patientEncounters
            LET condition = DOCUMENT(edge._to)
            FILTER condition.type == 'condition'
            RETURN condition.DESCRIPTION
        )
        
        RETURN {
          id: patient.id,
          name: patient.name,
          gender: patient.gender,
          birthdate: patient.birthdate,
          race: patient.race,
          conditions: UNIQUE(patientConditions)
        }
    `;

    const patients = await db
      .query(patientsQuery)
      .then((cursor) => cursor.all());

    // Get total count for pagination
    const countQuery = aql`
      RETURN COUNT(
        FOR patient IN MedGraph_node
          FILTER patient.type == 'patient' AND (patient.GENDER == 'M' OR patient.GENDER == 'F')
          RETURN 1
      )
    `;

    const [totalCount] = await db
      .query(countQuery)
      .then((cursor) => cursor.all());

    return NextResponse.json({
      patients,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}
