# Field type reference

Every block id usable as `fields[].blockId` when creating or editing a form. Derived from `packages/forms/src/blocks.ts` — the single source of truth; re-check that file if this list looks stale.

## Field spec shape

```ts
{
  blockId: string;       // one of the ids below
  name: string;          // the question label
  help?: string;         // helper text shown under the question
  placeholder?: string;  // input placeholder (text-like fields)
  required?: boolean;
  width?: "full" | "1/2" | "1/3" | "2/3" | "1/4" | "3/4";  // 12-col grid, default "full"
  options?: string[];    // choices — only used by select, radio, multi_select
}
```

Everything else about a field (validation, max lengths, etc.) uses the block's sensible defaults. There's no way to set those finer options through this spec today — use the form editor UI for that level of control.

## Input blocks (collect an answer)

| `blockId` | Title | What it is |
| --- | --- | --- |
| `text` | Text | A single-line text answer |
| `rich_text` | Rich text | A multi-line answer with bold, lists and links |
| `email` | Email | An email address, validated as you type |
| `phone_number` | Phone | A phone number with country code picker |
| `url` | URL | A web link, validated as a URL |
| `number` | Number | A numeric answer, digits only |
| `date` | Date | A date, or date range, picked from a calendar |
| `password` | Password | A masked text answer, hidden as it's typed |
| `select` | Dropdown | A dropdown with one choice from a list of options — pass `options` |
| `radio` | Single choice | A list of options shown as single-choice radio buttons — pass `options` |
| `multi_select` | Multiple choice | Pick several options — pass `options` |
| `checkbox` | Checkbox | A single yes/no checkbox |
| `toggle_switch` | Toggle switch | A single yes/no answer shown as a toggle |
| `rating` | Rating | A star rating out of a chosen maximum |
| `scale` | Scale | A numeric scale respondents slide or click along |
| `slider` | Slider | A draggable slider between a minimum and maximum |
| `matrix` | Matrix | A grid of rows and columns |
| `files` | File upload | Lets respondents upload one or more files |
| `signature` | Signature | Lets respondents draw a signature |
| `barcode` | Barcode reader | Scans a barcode using the device camera |
| `qrcode` | QR code reader | Scans a QR code using the device camera |

## Layout blocks (no answer — structure and content)

| `blockId` | Title | What it is |
| --- | --- | --- |
| `nf-text` | Text | Plain text or formatted content shown between fields |
| `nf-page-break` | Page break | Splits the form into a new page (classic layout only) |
| `nf-divider` | Divider | A horizontal rule to visually separate sections |
| `nf-image` | Image | An image shown inline in the form |
| `nf-video` | Video | An embedded or uploaded video |
| `nf-audio` | Audio | An embedded or uploaded audio clip |
| `nf-code` | HTML code | Custom HTML, for embeds nothing else covers |

## Notes

- `select`, `radio`, and `multi_select` are the only blocks that use the spec's `options` array; it's ignored for everything else.
- Pages (classic layout) are created by inserting an `nf-page-break` field at each break point — the fields before it are page 1, and so on.
- Width follows a 12-column grid per row: two `"1/2"` fields sit side by side, four `"1/4"` fields fill a row, etc. Default is `"full"` (its own row).
- An unknown `blockId` is rejected with an error listing the valid ids — if a create/update call fails, that's usually why.
