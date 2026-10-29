import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

const OPTIONS = [
	{ icon: SunIcon, label: "Light", value: "light" },
	{ icon: MoonIcon, label: "Dark", value: "dark" },
	{ icon: MonitorIcon, label: "System", value: "system" },
] as const;

export default function ThemeToggle() {
	const { setTheme, theme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" />}>
				<SunIcon className="dark:hidden" />
				<MoonIcon className="hidden dark:block" />
				<span className="sr-only">Toggle theme</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{OPTIONS.map(({ icon: Icon, label, value }) => (
					<DropdownMenuItem
						className="data-active:bg-muted"
						data-active={theme === value}
						key={value}
						onClick={() => setTheme(value)}
					>
						<Icon /> {label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
