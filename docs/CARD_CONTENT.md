# Card content pipeline

Card definitions are data-driven and must include a stable id, display name, counters, legal-response metadata, and artwork key. Rarity is presentation only and must never affect legality.

Artwork lives at `apps/web/public/cards/<definition-id>.png` and is exactly 1024×1024 pixels. Replacements keep the definition id and PNG format, are reviewed as a content change, and verify dimensions before merging. Missing or invalid art resolves to a deterministic SVG/CSS fallback containing the card name, rarity, and symbol; the image exposes accessible alt text with the card name. Fallback selection is derived only from the definition id, so rendering never changes game state.
