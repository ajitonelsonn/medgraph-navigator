// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Database, aql } from "arangojs";

// Define the stats interface
interface DashboardStats {
  totalPatients: number;
  totalEncounters: number;
  nodesInGraph: number;
  edgesInGraph: number;
  connectionStatus: boolean;
  apiStatus: boolean;
  cacheNotice?: string;
  // Remove uniqueConditions and riskPatients since they're not used
}

// Initialize ArangoDB connection
const db = new Database({
  url: process.env.ARANGODB_URL,
  databaseName: process.env.ARANGODB_DATABASE,
  auth: {
    username: process.env.ARANGODB_USERNAME || "root",
    password: process.env.ARANGODB_PASSWORD || "",
  },
});

// Cache for stats - values will be updated every 10 minutes
let statsCache: {
  data: DashboardStats | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

export async function GET(request: NextRequest) {
  try {
    // Check if we have a recent cache (less than 10 minutes old)
    const now = Date.now();
    if (statsCache.data && now - statsCache.timestamp < 10 * 60 * 1000) {
      return NextResponse.json(statsCache.data);
    }

    // Check database connection by getting server version
    const dbStatus = await db.version().then(
      () => true,
      () => false
    );

    // Single fast query to get basic counts
    const basicCountsQuery = aql`
      LET patientCount = LENGTH(FOR node IN MedGraph_node FILTER node.type == 'patient' RETURN node)
      LET encounterCount = LENGTH(FOR node IN MedGraph_node FILTER node.type == 'encounter' RETURN node)
      LET nodeCount = LENGTH(FOR node IN MedGraph_node RETURN node)
      LET edgeCount = LENGTH(FOR edge IN MedGraph_node_to_MedGraph_node RETURN edge)
      
      RETURN {
        patientCount: patientCount,
        encounterCount: encounterCount,
        nodeCount: nodeCount,
        edgeCount: edgeCount
      }
    `;

    // Execute the fast query first
    const basicCounts = await db
      .query(basicCountsQuery)
      .then((cursor) => cursor.next());

    // Create the response data
    const responseData: DashboardStats = {
      totalPatients: basicCounts.patientCount,
      totalEncounters: basicCounts.encounterCount,
      nodesInGraph: basicCounts.nodeCount,
      edgesInGraph: basicCounts.edgeCount,
      connectionStatus: dbStatus,
      apiStatus: true,
    };

    // Update the cache
    statsCache = {
      data: responseData,
      timestamp: now,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Database query error:", error);

    // If we have cached data, return it even if it's old
    if (statsCache.data) {
      return NextResponse.json({
        ...statsCache.data,
        connectionStatus: false,
        cacheNotice: "Using cached data due to query error",
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
