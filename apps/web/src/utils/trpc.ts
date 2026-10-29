import type { AppRouter } from "@StryveForms/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

/** Response types of every API procedure, e.g. `RouterOutputs["form"]["get"]`. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
