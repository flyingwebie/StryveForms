import rootPackage from "../../../../../package.json" with { type: "json" };

/** App version shown in the sidebar footer, read from the root package.json. */
export const APP_VERSION: string = rootPackage.version;
