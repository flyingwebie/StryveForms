import { describe, expect, test } from "bun:test";

import {
	buildPreview,
	cancelPreviewTask,
	type FormPreview,
	getPreviewTask,
	startPreviewTask,
} from "./preview";

const form: FormPreview = {
	action: "create",
	fields: [],
	files: null,
	filesSize: null,
	importedFormId: null,
	integrations: [],
	sourceId: "1",
	submissions: 3,
	targetWorkspace: "Test",
	title: "Contact",
	warnings: [],
};

describe("preview tasks", () => {
	test("reports progress, then the result", async () => {
		const { promise: gate, resolve: release } = Promise.withResolvers<void>();
		const id = startPreviewTask("user-1", 1, async (reporter) => {
			await gate;
			reporter.formDone(form);
			return buildPreview("jotform", [form], { estimatedSeconds: 1 });
		});

		expect(getPreviewTask(id, "user-1")?.status).toBe("running");
		expect(getPreviewTask(id, "someone-else")).toBeNull();

		release();
		await Bun.sleep(0);
		const task = getPreviewTask(id, "user-1");
		expect(task?.status).toBe("done");
		expect(task?.done).toBe(1);
		expect(task?.result?.totals.forms).toBe(1);
		expect(task?.log.some((l) => l.message.includes("Contact"))).toBe(true);
	});

	test("stops when cancelled", async () => {
		const id = startPreviewTask("user-1", 2, async (reporter) => {
			await Bun.sleep(0);
			reporter.throwIfCancelled();
			return buildPreview("jotform", [], { estimatedSeconds: 1 });
		});
		expect(cancelPreviewTask(id, "user-1")).toBe(true);
		await Bun.sleep(1);
		expect(getPreviewTask(id, "user-1")?.status).toBe("cancelled");
	});

	test("keeps the error message when the analysis fails", async () => {
		const id = startPreviewTask("user-1", 1, () =>
			Promise.reject(new Error("JotForm daily limit reached"))
		);
		await Bun.sleep(0);
		const task = getPreviewTask(id, "user-1");
		expect(task?.status).toBe("failed");
		expect(task?.error).toBe("JotForm daily limit reached");
	});
});
