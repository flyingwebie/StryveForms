import { protectedProcedure, publicProcedure, router } from "../index";
import { aiRouter } from "./ai";
import { backupRouter } from "./backup";
import { backupAdminRouter } from "./backup-admin";
import { folderRouter } from "./folder";
import { formRouter } from "./form";
import { importerRouter } from "./importer";
import { instanceRouter } from "./instance";
import { integrationRouter } from "./integration";
import { mediaRouter } from "./media";
import { pdfRouter } from "./pdf";
import { publicRouter } from "./public";
import { shareRouter } from "./share";
import { statsRouter } from "./stats";
import { submissionRouter } from "./submission";
import { templateRouter } from "./template";
import { workspaceRouter } from "./workspace";
import { writerRouter } from "./writer";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	me: protectedProcedure.query(({ ctx }) => ctx.session.user),
	ai: aiRouter,
	backup: backupRouter,
	backupAdmin: backupAdminRouter,
	folder: folderRouter,
	form: formRouter,
	importer: importerRouter,
	instance: instanceRouter,
	integration: integrationRouter,
	media: mediaRouter,
	pdf: pdfRouter,
	public: publicRouter,
	share: shareRouter,
	stats: statsRouter,
	submission: submissionRouter,
	template: templateRouter,
	workspace: workspaceRouter,
	writer: writerRouter,
});

export type AppRouter = typeof appRouter;
