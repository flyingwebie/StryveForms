import { type ParseArgsOptionsConfig, parseArgs } from "node:util";

/**
 * Joins `--flag value` into `--flag=value` for string options, so values that
 * start with "-" (StryveForms ids often do) aren't mistaken for flags.
 */
export function joinOptionValues(
	args: string[],
	options: ParseArgsOptionsConfig
): string[] {
	const out: string[] = [];
	let i = 0;
	while (i < args.length) {
		const arg = args[i] ?? "";
		const name = arg.startsWith("--") && !arg.includes("=") ? arg.slice(2) : "";
		const next = args[i + 1];
		if (name && options[name]?.type === "string" && next !== undefined) {
			out.push(`${arg}=${next}`);
			i += 2;
		} else {
			out.push(arg);
			i += 1;
		}
	}
	return out;
}

/** `parseArgs` with positionals allowed and dash-safe option values. */
export function parseCliArgs<T extends ParseArgsOptionsConfig>(
	args: string[],
	options: T
) {
	return parseArgs({
		allowPositionals: true as const,
		args: joinOptionValues(args, options),
		options,
	});
}

/** An id given as `--id <id>` (dash-safe) or as the first positional. */
export function idArg(
	option: string | undefined,
	positionals: string[]
): string | undefined {
	return option ?? positionals[0];
}
