import { resolveMentions } from "@StryveForms/forms/mentions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
	CalendarClockIcon,
	EyeOffIcon,
	type LucideIcon,
	SearchXIcon,
	UsersIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FormRenderer } from "@/components/form-renderer/form-renderer";
import { getDictionary } from "@/components/form-renderer/i18n";
import { PasswordGate } from "@/components/form-renderer/password-gate";
import Loader from "@/components/loader";
import { googleFontCssUrl } from "@/lib/google-fonts";
import type { RouterAppContext } from "@/routes/__root";
import { useTRPC } from "@/utils/trpc";

/** Named + explicitly-typed so `head` can cast `loaderData` without relying on this router version's broken inference. */
async function fetchPublicForm(context: RouterAppContext, slug: string) {
	return await context.queryClient.ensureQueryData(
		context.trpc.public.form.queryOptions({ slug })
	);
}
type LoaderData = Awaited<ReturnType<typeof fetchPublicForm>>;

const TRACKING_PARAMS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"gclid",
	"fbclid",
	"msclkid",
];

interface UrlPrefillResult {
	autoSubmit: boolean;
	editSubmissionId?: string;
	initialValues: Record<string, unknown>;
	tracking: Record<string, unknown>;
}

/** Parses `?<fieldId>=value`, `?<fieldId>[]=a&<fieldId>[]=b`, JSON objects, tracking, and editor flags from the URL. */
function parseUrlParams(search: string): UrlPrefillResult {
	const params = new URLSearchParams(search);
	const initialValues: Record<string, unknown> = {};
	const tracking: Record<string, unknown> = {};
	const arrayKeys = new Set<string>();

	for (const key of params.keys()) {
		if (key.endsWith("[]")) {
			arrayKeys.add(key.slice(0, -2));
		}
	}
	for (const key of arrayKeys) {
		initialValues[key] = params.getAll(`${key}[]`);
	}
	for (const [key, value] of params.entries()) {
		if (
			key.endsWith("[]") ||
			key === "submission_id" ||
			key === "auto_submit" ||
			key === "embed"
		) {
			continue;
		}
		if (TRACKING_PARAMS.includes(key)) {
			tracking[key] = value;
			continue;
		}
		try {
			initialValues[key] = JSON.parse(value);
		} catch {
			initialValues[key] = value;
		}
	}

	return {
		autoSubmit: params.get("auto_submit") === "true",
		editSubmissionId: params.get("submission_id") ?? undefined,
		initialValues,
		tracking,
	};
}

/**
 * Only `embed` is validated here — everything else on this route's query
 * string is either a dynamic `?<fieldId>=value` prefill (parsed separately
 * by `parseUrlParams`, below) or one of a few fixed flags
 * (`auto_submit`/`submission_id`) that don't need SSR-safe access. `embed`
 * does: unlike `window.location.search` (empty during SSR), `Route.useSearch()`
 * is populated from the real request URL on the server too, so the
 * `min-h-svh`/padding class the server renders already matches what the
 * client settles on — no embed-mode hydration mismatch.
 */
const searchSchema = z
	.object({
		// The router's default search parser turns a bare `?embed=1` into the
		// *number* 1, not the string "1" — coerce so both `?embed=1` and
		// `?embed=true` keep working regardless of how a value lands here.
		embed: z.coerce.string().optional(),
	})
	.passthrough();

/** Preconnect + stylesheet for the form's Google Font, so it's there on first paint. */
function formFontLinks(fontFamily: string | null | undefined) {
	const href = googleFontCssUrl(fontFamily);
	if (!href) {
		return [];
	}
	return [
		{ href: "https://fonts.googleapis.com", rel: "preconnect" },
		{
			crossOrigin: "anonymous" as const,
			href: "https://fonts.gstatic.com",
			rel: "preconnect",
		},
		{ href, rel: "stylesheet" },
	];
}

export const Route = createFileRoute("/forms/$slug")({
	component: PublicFormPage,
	validateSearch: searchSchema,
	// This router version's `head({ loaderData })` typing collapses to `never`
	// through the normal inference path (a known issue when the same route's
	// `component` is a named function referencing `Route`), so `loaderData` is
	// cast to the loader's own named-function return type instead of relying on it.
	head: ({ loaderData }) => {
		const data = loaderData as LoaderData | undefined;
		const dto = data?.form;
		if (!dto) {
			return { meta: [{ title: "StryveForms" }] };
		}
		// `seoMeta`'s fields collapse to `{}` through this passthrough-zod-object's
		// inferred type (same quirk as `analytics` below); cast back to real strings.
		const seo = (dto.seoMeta ?? {}) as {
			page_description?: string | null;
			page_favicon?: string | null;
			page_thumbnail?: string | null;
			page_title?: string | null;
		};
		return {
			links: [
				...(seo.page_favicon ? [{ href: seo.page_favicon, rel: "icon" }] : []),
				...formFontLinks(dto.fontFamily),
			],
			meta: [
				{ title: seo.page_title || dto.title },
				seo.page_description
					? { content: seo.page_description, name: "description" }
					: undefined,
				seo.page_thumbnail
					? { content: seo.page_thumbnail, property: "og:image" }
					: undefined,
				dto.canBeIndexed ? undefined : { content: "noindex", name: "robots" },
			].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
		};
	},
	notFoundComponent: () => (
		<main className="flex min-h-svh items-center justify-center bg-app">
			<ClosedOrFullScreen
				eyebrow="404"
				html="<p>This form could not be found. The link may be broken, or the form may have been moved or deleted.</p>"
				icon={SearchXIcon}
			/>
		</main>
	),
	loader: async ({ context, params }) => {
		try {
			return await fetchPublicForm(context, params.slug);
		} catch (error) {
			throw notFound({ data: error });
		}
	},
});

function ClosedOrFullScreen({
	eyebrow,
	html,
	icon: Icon,
}: {
	eyebrow?: string;
	html: string;
	icon: LucideIcon;
}) {
	return (
		<div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
			<div
				aria-hidden="true"
				className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
			>
				<Icon className="size-5" />
			</div>
			{eyebrow ? (
				<p className="font-mono text-subtle-foreground text-xs">{eyebrow}</p>
			) : null}
			<div
				className="prose prose-sm dark:prose-invert mx-auto prose-headings:font-semibold prose-p:text-muted-foreground"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: form owner's own closed/limit-reached message
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}

/** Loads analytics + custom head code once, only for real (non-preview) visitors. */
function useLiveHeadInjections(
	customCode: string | null,
	analytics: { provider?: string | null; trackingId?: string | null } | null
) {
	useEffect(() => {
		if (!customCode) {
			return;
		}
		const wrapper = document.createElement("div");
		wrapper.innerHTML = customCode;
		const nodes = [...wrapper.childNodes];
		for (const node of nodes) {
			document.head.append(node);
		}
		return () => {
			for (const node of nodes) {
				node.parentNode?.removeChild(node);
			}
		};
	}, [customCode]);

	useEffect(() => {
		if (!(analytics?.provider && analytics.trackingId)) {
			return;
		}
		const id = analytics.trackingId;
		const script = document.createElement("script");
		script.async = true;
		if (analytics.provider === "gtm") {
			script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
		} else if (analytics.provider === "google_analytics") {
			script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
		} else if (analytics.provider === "meta_pixel") {
			script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
		}
		document.head.append(script);
		return () => {
			script.remove();
		};
	}, [analytics?.provider, analytics?.trackingId]);
}

/**
 * Embed mode always clears the surrounding html/body background (not just
 * when "Transparent background" is on): the form's own wrapper paints
 * whatever colour it needs, so this just removes the page chrome that would
 * otherwise show as an opaque rectangle around it inside the iframe.
 */
/** Drops the full-viewport min-height on the "closed"/"password"/"max
 * submissions" screens in embed mode too, same reasoning as the form
 * renderer's own `min-h-svh` (see `livePagePadding` in form-renderer.tsx). */
function embedAwareMainClass(isEmbed: boolean, rest: string): string {
	return isEmbed ? rest : `min-h-svh ${rest}`;
}

function useEmbedTransparentPage(isEmbed: boolean) {
	useEffect(() => {
		if (!isEmbed) {
			return;
		}
		const { body, documentElement } = document;
		const previousHtmlBackground = documentElement.style.backgroundColor;
		const previousBodyBackground = body.style.backgroundColor;
		// Without this, a `background: transparent` root still paints as a
		// solid dark canvas when the OS/browser prefers dark colour scheme:
		// browsers auto-darken the UA's default page canvas from
		// `prefers-color-scheme` unless `color-scheme` is explicitly forced
		// away from "auto", so "transparent" alone isn't actually transparent
		// in a dark host page (most visible cross-origin, e.g. a plain HTML
		// page embedding the iframe — same-document navigation hides it since
		// there's nothing else behind the page to reveal the dark canvas).
		const previousHtmlColorScheme = documentElement.style.colorScheme;
		documentElement.style.backgroundColor = "transparent";
		body.style.backgroundColor = "transparent";
		documentElement.style.colorScheme = "light";
		return () => {
			documentElement.style.backgroundColor = previousHtmlBackground;
			body.style.backgroundColor = previousBodyBackground;
			documentElement.style.colorScheme = previousHtmlColorScheme;
		};
	}, [isEmbed]);
}

function PublicFormPage() {
	const { slug } = Route.useParams();
	const trpc = useTRPC();
	const [password, setPassword] = useState<string | undefined>();
	const [passwordSubmitting, setPasswordSubmitting] = useState(false);
	const viewedRef = useRef(false);
	const embedRef = useRef<HTMLElement>(null);
	const { embed } = Route.useSearch();
	const isEmbed = embed === "1";

	useEffect(() => {
		const el = embedRef.current;
		if (!(el && window.parent !== window)) {
			return;
		}
		const observer = new ResizeObserver(() => {
			window.parent.postMessage(
				{ height: el.offsetHeight, slug, type: "stryveforms:resize" },
				"*"
			);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [slug]);

	useEmbedTransparentPage(isEmbed);

	const query = useQuery(trpc.public.form.queryOptions({ password, slug }));
	const viewMutation = useMutation(trpc.public.view.mutationOptions());

	const urlState = useMemo(() => {
		if (typeof window === "undefined") {
			return { autoSubmit: false, initialValues: {}, tracking: {} };
		}
		return parseUrlParams(window.location.search);
	}, []);

	const submissionQuery = useQuery({
		...trpc.public.submission.queryOptions({
			password,
			slug,
			submissionId: urlState.editSubmissionId ?? "",
		}),
		enabled: Boolean(urlState.editSubmissionId),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: fires once the form unlocks, not on every viewMutation identity change
	useEffect(() => {
		if (query.data && !query.data.passwordRequired && !viewedRef.current) {
			viewedRef.current = true;
			viewMutation.mutate({ slug });
		}
	}, [query.data, slug]);

	const { data } = query;
	const dict = getDictionary(data?.form.language);

	const analytics = data?.form.analytics as
		| { provider?: string | null; tracking_id?: string | null }
		| null
		| undefined;
	useLiveHeadInjections(
		data?.passwordRequired ? null : (data?.form.customCode ?? null),
		analytics
			? { provider: analytics.provider, trackingId: analytics.tracking_id }
			: null
	);

	// biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag
	if (query.isLoading) {
		return <Loader />;
	}
	if (!data) {
		return (
			<main className="flex min-h-svh items-center justify-center bg-app">
				<ClosedOrFullScreen
					eyebrow="404"
					html="<p>This form could not be found.</p>"
					icon={SearchXIcon}
				/>
			</main>
		);
	}

	if (data.passwordRequired) {
		return (
			<main
				className={embedAwareMainClass(
					isEmbed,
					"flex items-center justify-center bg-app p-6"
				)}
			>
				<PasswordGate
					dict={dict}
					onSubmit={(value) => {
						setPasswordSubmitting(true);
						setPassword(value);
						setPasswordSubmitting(false);
					}}
					submitting={passwordSubmitting || query.isFetching}
					title={data.form.title}
					wrongPassword={data.wrongPassword}
				/>
			</main>
		);
	}

	if (data.isClosed && !data.isOwner) {
		return (
			<main
				className={embedAwareMainClass(
					isEmbed,
					"flex items-center justify-center bg-app p-6"
				)}
			>
				<ClosedOrFullScreen
					html={
						resolveMentions(data.form.closedText, {}) ||
						`<p>${dict.formClosed}</p>`
					}
					icon={CalendarClockIcon}
				/>
			</main>
		);
	}
	if (data.maxSubmissionsReached && !data.isOwner) {
		return (
			<main
				className={embedAwareMainClass(
					isEmbed,
					"flex items-center justify-center bg-app p-6"
				)}
			>
				<ClosedOrFullScreen
					html={
						resolveMentions(data.form.maxSubmissionsReachedText, {}) ||
						`<p>${dict.maxReached}</p>`
					}
					icon={UsersIcon}
				/>
			</main>
		);
	}

	const initialValues =
		submissionQuery.data && !submissionQuery.isLoading
			? { ...submissionQuery.data.data, ...urlState.initialValues }
			: urlState.initialValues;

	return (
		<main ref={embedRef}>
			{data.isOwner && data.form.visibility === "draft" ? (
				<div className="flex items-center justify-center gap-2 border-warning/30 border-b bg-warning-soft px-4 py-2 text-center font-medium text-sm text-warning">
					<EyeOffIcon aria-hidden="true" className="size-4 shrink-0" />
					This form is a draft — only you can see it.
				</div>
			) : null}
			<FormRenderer
				autoSubmit={urlState.autoSubmit}
				embed={isEmbed}
				form={data.form}
				initialValues={initialValues}
				mode="live"
				onSubmitted={(outcome) => {
					if (window.parent !== window) {
						window.parent.postMessage(
							{ slug, type: "stryveforms:submit", ...outcome },
							"*"
						);
					}
				}}
				submissionId={submissionQuery.data?.submissionId}
				tracking={urlState.tracking}
			/>
		</main>
	);
}
