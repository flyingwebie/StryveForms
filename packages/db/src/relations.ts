import { defineRelations } from "drizzle-orm";

// biome-ignore lint/performance/noNamespaceImport: relations are defined over every table
import * as schema from "./schema";

const { authRelations, formRelations, ...tables } = schema;

export const relations = {
	...defineRelations(tables),
	...authRelations,
	...formRelations,
};
