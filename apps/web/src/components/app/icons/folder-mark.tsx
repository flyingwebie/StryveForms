import EntityIcon from "./entity-icon";

const DEFAULT_FOLDER_COLOR = "#64748b";

/**
 * A folder's icon tinted with its colour, or a coloured dot when it has no
 * icon. Used in badges and menus that mention a folder.
 */
export default function FolderMark({
	color,
	icon,
	size = 12,
}: {
	color?: string | null;
	icon?: string | null;
	size?: number;
}) {
	const tint = color ?? DEFAULT_FOLDER_COLOR;
	return (
		<EntityIcon
			color={tint}
			fallback={
				<span
					aria-hidden="true"
					className="inline-block size-1.5 shrink-0 rounded-full"
					style={{ backgroundColor: tint }}
				/>
			}
			icon={icon}
			size={size}
		/>
	);
}
