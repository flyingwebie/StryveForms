import type { Session } from "@StryveForms/auth";
import type { Database } from "@StryveForms/db";

export type Context = {
  session: Session | null;
  db: Database;
};
