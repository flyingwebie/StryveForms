/**
 * StryveForms embed widget. Plain JS, no build step, no dependencies.
 *
 * Usage 1 — auto-resizing iframe:
 *   <iframe data-stryveforms src="https://yourdomain.com/forms/my-form"></iframe>
 *
 * Usage 2 — popup launcher button:
 *   <script data-sf='{"formUrl":"https://yourdomain.com/forms/my-form","icon":"message-circle","bgcolor":"#3B82F6","position":"right","width":"400"}'
 *           src="https://yourdomain.com/widgets/embed.js"></script>
 *
 * Popup config keys (all optional besides formUrl):
 *   bgcolor      button background colour, hex (default "#3B82F6")
 *   icon         one of the curated icon ids below (default "message-circle")
 *   iconUrl      a custom image URL — takes priority over `icon`
 *   iconColor    icon/label colour, hex (default "#ffffff")
 *   emoji        legacy: an emoji character shown instead of an icon. Kept for
 *                snippets generated before icon support was added.
 *   position     "left" | "right" (default "right")
 *   size         button diameter in px (default 56)
 *   width        panel width in px (default 400)
 *   label        optional text pill next to the button, e.g. "Contact us"
 *   openDelay    seconds after page load to open the panel automatically
 *   hideOnMobile hide the launcher under a 640px viewport (default false)
 *
 * Icon paths are a small curated subset of Lucide (https://lucide.dev),
 * ISC licensed — see https://github.com/lucide-icons/lucide/blob/main/LICENSE.
 * Copyright (c) Lucide Icons and Contributors.
 */
(() => {
	const RESIZE_TYPE = "stryveforms:resize";
	const SUBMIT_TYPE = "stryveforms:submit";
	const SVG_NS = "http://www.w3.org/2000/svg";
	const MOBILE_HIDE_CLASS = "sf-embed-hide-mobile";

	/* Inner <svg> markup for each curated icon. Authored by us (not user
	 * input), so setting it via innerHTML is safe — nothing here is built
	 * from widget config. */
	const ICONS = {
		calendar:
			'<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
		clipboard:
			'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
		headphones:
			'<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
		"help-circle":
			'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
		info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
		mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
		"message-circle":
			'<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
		phone:
			'<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
		send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
		sparkles:
			'<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
		x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	};

	/** Builds a 24x24 Lucide-style icon. `id` is looked up on our own fixed
	 * table only (never used as a selector into anything else), so an
	 * unexpected value just falls back to the default icon. */
	function createIcon(id) {
		const key = Object.hasOwn(ICONS, id) ? id : "message-circle";
		const svg = document.createElementNS(SVG_NS, "svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", "24");
		svg.setAttribute("height", "24");
		svg.setAttribute("fill", "none");
		svg.setAttribute("stroke", "currentColor");
		svg.setAttribute("stroke-width", "2");
		svg.setAttribute("stroke-linecap", "round");
		svg.setAttribute("stroke-linejoin", "round");
		svg.setAttribute("aria-hidden", "true");
		svg.innerHTML = ICONS[key];
		return svg;
	}

	/** Appends `embed=1` to a form URL so the public page drops its full-viewport
	 * min-height and (if "Transparent background" is on) shows through to the
	 * host page — see routes/forms/$slug.tsx. Idempotent, and falls back to
	 * the original string if the URL can't be parsed (e.g. a relative path
	 * with no base in an older browser). */
	function withEmbedParam(url) {
		try {
			const parsed = new URL(url, window.location.href);
			parsed.searchParams.set("embed", "1");
			return parsed.toString();
		} catch {
			return url;
		}
	}

	/** Finds the iframe on the page whose contentWindow matches the message source. */
	function resizeMatchingIframe(source, height) {
		const iframes = document.querySelectorAll("iframe[data-stryveforms]");
		for (const iframe of iframes) {
			if (iframe.contentWindow === source) {
				iframe.style.height = `${height}px`;
				return;
			}
		}
	}

	function listenForResizeAndSubmit() {
		window.addEventListener("message", (event) => {
			const { data } = event;
			if (!data || typeof data !== "object") {
				return;
			}
			if (data.type === RESIZE_TYPE && typeof data.height === "number") {
				resizeMatchingIframe(event.source, data.height);
			}
			if (data.type === SUBMIT_TYPE) {
				document.dispatchEvent(
					new CustomEvent("stryveforms:submit", { detail: data })
				);
			}
		});
	}

	/** Auto-resizing iframes: set a sensible default while waiting for the first resize message. */
	function prepareAutoResizeIframes() {
		const existingIframes = document.querySelectorAll(
			"iframe[data-stryveforms]"
		);
		for (const iframeEl of existingIframes) {
			if (!iframeEl.style.height) {
				iframeEl.style.height = "600px";
			}
			iframeEl.style.width = iframeEl.style.width || "100%";
			iframeEl.style.border = iframeEl.style.border || "0";
			// Embed mode (round 7): added here too, not just by the share dialog's
			// generated snippet, so a hand-written `<iframe data-stryveforms
			// src="...">` (no ?embed=1 baked in) still gets the shrink-to-fit
			// sizing and transparent-background behaviour.
			if (iframeEl.src) {
				iframeEl.src = withEmbedParam(iframeEl.src);
			}
		}
	}

	/** Reads and parses the popup config from the script tag that loaded this file. */
	function readPopupConfig() {
		const currentScript =
			document.currentScript ||
			(() => {
				const scripts = document.getElementsByTagName("script");
				return scripts.at(-1);
			})();
		const configRaw = currentScript?.getAttribute("data-sf");
		if (!configRaw) {
			return null;
		}
		let config;
		try {
			config = JSON.parse(configRaw);
		} catch {
			return null;
		}
		if (!config.formUrl || typeof config.formUrl !== "string") {
			return null;
		}
		return config;
	}

	/** Resolves widget options from raw config, applying every default. */
	function resolveOptions(config) {
		return {
			bgcolor: typeof config.bgcolor === "string" ? config.bgcolor : "#3B82F6",
			hideOnMobile: Boolean(config.hideOnMobile),
			iconColor:
				typeof config.iconColor === "string" ? config.iconColor : "#ffffff",
			label: typeof config.label === "string" ? config.label.slice(0, 60) : "",
			openDelay:
				typeof config.openDelay === "number" && config.openDelay >= 0
					? config.openDelay
					: null,
			position: config.position === "left" ? "left" : "right",
			size:
				typeof config.size === "number" &&
				config.size >= 40 &&
				config.size <= 96
					? config.size
					: 56,
			width: config.width || "400",
		};
	}

	function ariaLabelFor(open, label) {
		if (open) {
			return "Close form";
		}
		return label ? `Open ${label}` : "Open form";
	}

	/** Fills the launcher button with the configured icon/image, or the legacy emoji. Never an emoji by default. */
	function renderButtonContent(button, config, options, isOpen) {
		button.textContent = "";
		if (isOpen) {
			button.appendChild(createIcon("x"));
			return;
		}
		if (typeof config.iconUrl === "string" && config.iconUrl) {
			const img = document.createElement("img");
			img.src = config.iconUrl;
			img.alt = "";
			img.style.width = "60%";
			img.style.height = "60%";
			img.style.objectFit = "contain";
			img.style.borderRadius = "inherit";
			button.appendChild(img);
			return;
		}
		if (typeof config.icon === "string" && config.icon) {
			button.appendChild(createIcon(config.icon));
			return;
		}
		// Legacy snippets that only set `emoji` keep working.
		if (typeof config.emoji === "string" && config.emoji) {
			const span = document.createElement("span");
			span.style.fontSize = `${Math.round(options.size * 0.45)}px`;
			span.textContent = config.emoji;
			button.appendChild(span);
			return;
		}
		button.appendChild(createIcon("message-circle"));
	}

	function createButton(config, options) {
		const button = document.createElement("button");
		button.type = "button";
		button.style.position = "relative";
		button.style.width = `${options.size}px`;
		button.style.height = `${options.size}px`;
		button.style.borderRadius = "50%";
		button.style.border = "none";
		button.style.background = options.bgcolor;
		button.style.color = options.iconColor;
		button.style.cursor = "pointer";
		button.style.boxShadow = "0 4px 14px rgba(0,0,0,0.25)";
		button.style.display = "flex";
		button.style.alignItems = "center";
		button.style.justifyContent = "center";
		button.style.padding = "0";
		renderButtonContent(button, config, options, false);
		return button;
	}

	function createLabel(options) {
		if (!options.label) {
			return null;
		}
		const labelEl = document.createElement("button");
		labelEl.type = "button";
		labelEl.textContent = options.label; // textContent only — never innerHTML with admin-provided text.
		labelEl.style.border = "none";
		labelEl.style.borderRadius = "9999px";
		labelEl.style.padding = "10px 16px";
		labelEl.style.background = options.bgcolor;
		labelEl.style.color = options.iconColor;
		labelEl.style.fontSize = "14px";
		labelEl.style.fontFamily = "system-ui, -apple-system, sans-serif";
		labelEl.style.cursor = "pointer";
		labelEl.style.boxShadow = "0 4px 14px rgba(0,0,0,0.25)";
		return labelEl;
	}

	function createPanel(config, options) {
		const panel = document.createElement("div");
		panel.style.position = "fixed";
		panel.style.bottom = `${options.size + 34}px`;
		panel.style[options.position] = "20px";
		panel.style.width = `${options.width}px`;
		panel.style.maxWidth = "calc(100vw - 40px)";
		panel.style.height = "70vh";
		panel.style.maxHeight = "640px";
		panel.style.borderRadius = "12px";
		panel.style.overflow = "hidden";
		panel.style.boxShadow = "0 12px 40px rgba(0,0,0,0.3)";
		panel.style.display = "none";
		panel.style.zIndex = "2147483000";
		panel.style.background = "#fff";
		panel.tabIndex = -1;

		const iframe = document.createElement("iframe");
		iframe.src = withEmbedParam(config.formUrl);
		iframe.setAttribute("data-stryveforms", "");
		iframe.setAttribute("title", options.label || "Form");
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		iframe.style.border = "0";
		panel.appendChild(iframe);
		return panel;
	}

	function createWrap(options) {
		const wrap = document.createElement("div");
		wrap.style.position = "fixed";
		wrap.style.bottom = "20px";
		wrap.style[options.position] = "20px";
		wrap.style.zIndex = "2147483000";
		wrap.style.display = "flex";
		wrap.style.alignItems = "center";
		wrap.style.gap = "10px";
		wrap.style.flexDirection =
			options.position === "left" ? "row" : "row-reverse";
		if (options.hideOnMobile) {
			wrap.className = MOBILE_HIDE_CLASS;
			const style = document.createElement("style");
			style.textContent = `@media (max-width: 640px){.${MOBILE_HIDE_CLASS}{display:none !important}}`;
			document.head.appendChild(style);
		}
		return wrap;
	}

	/** Wires open/close state: button + label toggle it, Esc closes it, focus follows it. */
	function wireToggle({ button, config, labelEl, options, panel }) {
		let open = false;
		/** `moveFocus` is false for the silent initial call, so page load doesn't steal focus. */
		function setOpen(next, moveFocus = true) {
			open = next;
			panel.style.display = open ? "block" : "none";
			renderButtonContent(button, config, options, open);
			button.setAttribute("aria-label", ariaLabelFor(open, options.label));
			if (!moveFocus) {
				return;
			}
			if (open) {
				panel.focus();
			} else {
				button.focus();
			}
		}
		function toggle() {
			setOpen(!open);
		}
		button.addEventListener("click", toggle);
		labelEl?.addEventListener("click", toggle);
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && open) {
				setOpen(false);
			}
		});
		return setOpen;
	}

	function setupPopup(config) {
		const options = resolveOptions(config);
		const button = createButton(config, options);
		const labelEl = createLabel(options);
		const panel = createPanel(config, options);
		const wrap = createWrap(options);
		if (labelEl) {
			wrap.appendChild(labelEl);
		}
		wrap.appendChild(button);

		const setOpen = wireToggle({ button, config, labelEl, options, panel });
		setOpen(false, false); // sets the initial aria-label without stealing focus

		function mount() {
			document.body.appendChild(panel);
			document.body.appendChild(wrap);
			if (options.openDelay !== null) {
				setTimeout(() => setOpen(true), options.openDelay * 1000);
			}
		}
		if (
			document.readyState === "complete" ||
			document.readyState === "interactive"
		) {
			mount();
		} else {
			document.addEventListener("DOMContentLoaded", mount);
		}
	}

	listenForResizeAndSubmit();
	prepareAutoResizeIframes();
	const popupConfig = readPopupConfig();
	if (popupConfig) {
		setupPopup(popupConfig);
	}
})();
