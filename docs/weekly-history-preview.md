# Group weekly chart history preview (#407)

Comparison mode in Group Overview and Charts compacts history; selecting an individual member retains detailed daily points. Dashboard is unaffected.

The common detailed window starts 13 calendar days before the newest authorized actual shared record across the displayed participants, inclusive. UTC date-only arithmetic avoids local DST offsets. Older records are bucketed Monday–Sunday per participant. A boundary week stops the day before the detailed window; no record appears twice. Empty and estimated-only buckets produce no summary. Means use original numeric values; only labels use the existing maximum-two-decimal display precision.

Preview placement proposal: a weekly summary sits on its first actual recorded date, keeping the existing overall date domain. It reports both calendar coverage and the first/last actual record dates, plus count. Aggregation happens before visible-range clipping, so moving range controls never recalculates a mean. A summary whose anchor is outside the visible range is hidden even if another record in that bucket lies inside the range. This placement can be adjusted after owner preview.

Larger summary markers retain participant colour. Hover, touch, and keyboard focus expose details; activation expands the bucket to its original daily points, including the existing visual estimates. Only original daily own points enter the existing editor. The Collapse expanded weeks button restores summaries. Expansion is local display state, with no persistence or database changes. Trend/reference inputs, awards, milestones, and statistics continue to use original records.

Review the preview at 320, 390, 430 and desktop widths, including sparse/boundary weeks and selecting narrow ranges. The pre-existing 320px Group subnavigation overflow is outside this chart change.
