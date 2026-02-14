import { db } from "../../db";
import { securityTools } from "@shared/schema";
import { BaseReporter, PageData } from "./base-reporter";

export class ToolsReporter extends BaseReporter {
  constructor() {
    super("tools");
  }

  async fetchPageData(_operationId: string): Promise<PageData> {
    const tools = await db.select().from(securityTools);

    return {
      tools,
      totalCount: tools.length,
      byCategory: this.groupByField(tools, "category"),
      byStatus: this.groupByField(tools, "status"),
    };
  }
}

export const toolsReporter = new ToolsReporter();
