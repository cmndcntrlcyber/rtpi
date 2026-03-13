import { db } from "../server/db";
import { mcpServers } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Enable autostart for all MCP servers
 */
async function enableMCPAutostart() {
  try {
    console.log("🔧 Updating all MCP servers to enable autostart...");

    // Update all MCP servers to have auto_restart = true
    const result = await db
      .update(mcpServers)
      .set({
        autoRestart: true,
        updatedAt: new Date(),
      })
      .returning();

    console.log(`✅ Updated ${result.length} MCP server(s) to enable autostart`);
    
    // Display updated servers
    result.forEach((server) => {
      console.log(`  - ${server.name}: autoRestart = ${server.autoRestart}`);
    });

    // Fetch and display current state of all MCP servers
    console.log("\n📊 Current MCP Server Configuration:");
    const allServers = await db.select().from(mcpServers);
    
    allServers.forEach((server) => {
      console.log(`  - ${server.name}:`);
      console.log(`      Status: ${server.status}`);
      console.log(`      Auto-restart: ${server.autoRestart}`);
      console.log(`      Max restarts: ${server.maxRestarts}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error enabling MCP autostart:", error);
    process.exit(1);
  }
}

enableMCPAutostart();
