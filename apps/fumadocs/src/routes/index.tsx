import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";
import { gitConfig } from "@/lib/shared";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <picture>
          <source
            media="(prefers-color-scheme: dark)"
            srcSet="/brand/stryveforms-logo-dark.svg"
          />
          <img
            alt="StryveForms"
            className="h-14 w-auto"
            height={56}
            src="/brand/stryveforms-logo.svg"
            width={226}
          />
        </picture>
        <div className="max-w-xl space-y-3">
          <h1 className="font-semibold text-3xl tracking-tight">
            The open-source form builder you host yourself
          </h1>
          <p className="text-fd-muted-foreground">
            Build beautiful forms, collect answers, send them anywhere. Your
            brand, your server, your data.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-lg bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground text-sm"
            params={{ _splat: "" }}
            to="/docs/$"
          >
            Read the docs
          </Link>
          <a
            className="rounded-lg border px-4 py-2 font-medium text-sm"
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            rel="noopener"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </HomeLayout>
  );
}
