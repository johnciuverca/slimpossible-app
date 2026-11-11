# Group compressed history preview (#407)

Group comparison in Overview and Charts uses a shared compressed horizontal timeline. Each older Monday–Sunday bucket occupies one display slot; the latest seven calendar dates occupy one slot each, inclusive of the newest authorized actual shared record (newest minus six). The partial boundary week stops before that cutoff. Empty older weeks keep one chronological slot but never invent a value. Individual member views and Dashboard remain detailed.

All participant points, paths, axis ticks, tooltips, trend/reference segments and date-range interactions use the same slot mapping. Unequal member histories do not move dates into different columns. Activating a weekly summary expands that week into daily slots for every displayed participant. Collapse restores compression. Original daily points retain the existing own edit/create callbacks; weekly averages never enter the editor.

Means use original actual authorized shared records, excluding estimates. Aggregation precedes visible-range filtering. Overlapping buckets remain reachable with a clamped display anchor and unchanged full-bucket mean; details retain original calendar coverage, actual recorded dates and count in DD.MM.YYYY. The source date domain and slider values remain calendar dates; pointer positions map through compressed slots and keyboard steps remain days. Trend/reference source calculations are unchanged, with geometry sampled through the shared slots.

Weekly visual dots retain radius seven; daily recorded/estimated visual dots use radius three, with hollow estimated styling. Separate transparent hit targets measure at least 44 CSS pixels across viewport scaling. Pointer selection resolves the nearest point where targets overlap; keyboard focus and touch details remain available.

These cutoff, partial-week and placement choices are initial preview proposals for owner adjustment. No data persistence, privacy, award, goal or statistical source changes are included. Verify normal, expanded and narrow-range states at 320/390/430 and desktop widths. Existing 320px Group subnavigation overflow is outside this chart change.
