# Plan: Excel Upload for Contacts and Text Edits

Switch contact capture from Gemini image processing to Excel/CSV upload for better speed and reliability. Apply the requested text edits for the invisible character placeholder.

## User Review Required

> [!IMPORTANT]
> The contact capture module currently uses AI (Gemini) to extract data from Shopee screenshots. Switching to Excel means you will need to export your contact list from Shopee/wherever and upload the file directly.

- Does the Shopee platform provide an Excel/CSV export of your contacts?
- Do you want to **keep** the image upload as an option, or **replace** it entirely with Excel?
- I will apply the literal text "U+2063" to the invisible characters as requested.

## Proposed Changes

### Contacts Module
- **Backend**: Add a new server function `importContactsFromExcel` in `src/lib/contacts.functions.ts`.
- **Backend**: Update RLS and database to handle bulk inserts efficiently if needed.
- **Frontend**: Modify `src/routes/_authenticated/contacts.tsx` to add an "Upload Excel/CSV" area.
- **Frontend**: Implement a parser using `xlsx` or `papaparse` to handle the uploaded file before sending to the server.
- **Frontend**: Keep the existing table view for managing the imported contacts.

### Text Edits
- **Source Code**: Search and replace any occurrence of `\\u2063` (Unicode 8291) with the literal string "U+2063" across the codebase, specifically in `src/routes/index.tsx` and `src/components/InvisibleCharReference.tsx`.

## Technical Details
- Use `xlsx` library for Excel parsing.
- Implement Zod validation for the Excel rows to ensure Name and Phone follow the existing normalization rules (Title Case first name, DDD + number).
- Maintain the 7-day message cycle logic for Excel-imported contacts.

