# Dashboard compressed history preview (#415)

Dashboard opts its personal chart into the existing shared weekly presentation from #407. The points-only input is normalized to one internal personal series; the shared aggregation, seven-day cutoff, compressed slots, paths, date controls, details, hit areas and Back to weekly averages action are reused. No separate renderer or timeline implementation is introduced. Other personal-detail callers remain detailed by default; Group policies are unchanged.

Weekly means receive only the signed-in owner's actual records. Estimates remain hollow display-only daily points, and neither they nor summary markers become saved records through chart activation. Expanding a week exposes the original dates and invokes the existing personal chart editor. Explicit saves use the existing note/share preservation and same-date resolution paths; a successful workspace refresh retains its existing remount behavior, returning to the normal compressed chart.

The title and source counts still describe original saved entries. The first-to-latest change, trend and goal/reference inputs use original records. Personal date-window axis bounds/tick policy retain the original interpolated history even when older display estimates are collapsed. Extrema labels, colours, fonts and fit behavior retain their personal chart settings.

Review normal, expanded, collapsed and clipped-range screenshots at 320/390/430 and desktop widths. Confirm old-week edit/cancel, explicit actual update preserving private note/shares, and recent estimate cancel/save without automatic sharing. These are synthetic local checks; owner visual approval of the deployed preview is still required before merge. No database, source semantics, awards or Live release is included.
