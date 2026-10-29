import {
	AtSign,
	AudioLines,
	Calendar,
	ChevronDownSquare,
	CircleDot,
	Code,
	FormInput,
	Gauge,
	Grid3x3,
	Hash,
	Image,
	KeyRound,
	Link,
	ListChecks,
	type LucideIcon,
	Minus,
	Paperclip,
	Phone,
	PilcrowSquare,
	QrCode,
	ScanBarcode,
	SeparatorHorizontal,
	Signature,
	SlidersHorizontal,
	SquareCheck,
	Star,
	Text,
	ToggleRight,
	Type,
	Video,
} from "lucide-react";

/** Every lucide icon name referenced by `@StryveForms/forms/blocks`. */
const ICONS: Record<string, LucideIcon> = {
	AtSign,
	AudioLines,
	Calendar,
	ChevronDownSquare,
	CircleDot,
	Code,
	Gauge,
	Grid3x3,
	Hash,
	Image,
	KeyRound,
	Link,
	ListChecks,
	Minus,
	Paperclip,
	Phone,
	PilcrowSquare,
	QrCode,
	ScanBarcode,
	SeparatorHorizontal,
	Signature,
	SlidersHorizontal,
	SquareCheck,
	Star,
	Text,
	ToggleRight,
	Type,
	Video,
};

export function BlockIcon({
	className,
	name,
}: {
	className?: string;
	name: string;
}) {
	const Icon = ICONS[name] ?? FormInput;
	return <Icon className={className ?? "size-4"} />;
}
