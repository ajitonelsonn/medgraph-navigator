// app/utils/schemaProvider.ts

/**
 * Provides the database schema and example queries for LLM prompting
 */
export function getGraphSchema(): string {
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
            
      13. DISTRIBUTION QUERIES - For analytics on demographic distributions:
          // Find distribution of races among patients with a specific condition
          FOR node IN MedGraph_node
            FILTER node.type == 'condition'
            FILTER LOWER(node.DESCRIPTION) LIKE '%diabetes%'
            FOR patient IN MedGraph_node
              FILTER patient.type == 'patient'
              FILTER patient.ID == node.PATIENT
              COLLECT race = patient.RACE WITH COUNT INTO count
              SORT count DESC
              RETURN { race: race, count: count }
              
      14. LIST PATIENTS BORN IN SPECIFIC YEAR:
          // Simple query for patients born in a specific year without condition filtering
          FOR node IN MedGraph_node
            FILTER node.type == 'patient'
            FILTER CONTAINS(node.BIRTHDATE, '1997')
            SORT node.BIRTHDATE DESC
            LIMIT 15
            RETURN { 
              id: node.ID, 
              gender: node.GENDER, 
              birthdate: node.BIRTHDATE, 
              race: node.RACE 
            }
    `;
}
