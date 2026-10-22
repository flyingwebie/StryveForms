import { createAuth } from "@StryveForms/auth";
import { createDb } from "@StryveForms/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
