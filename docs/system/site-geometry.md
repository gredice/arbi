# Site geometry

## Repository baseline

| Property | Baseline value | Evidence status |
| --- | ---: | --- |
| Bed size | 2.0 × 1.0 m | Recorded site definition |
| Gap between beds | 0.8 m | Recorded site definition |
| Layout | 3 rows × N columns | Recorded site definition |
| Current beds | 25 | Recorded baseline; current live site not surveyed here |
| Planned capacity | 30 beds, arranged 3 × 10 | Product target |
| Final bed footprint | 27.2 × 4.6 m | Calculated from the recorded dimensions |
| Recommended anchor rectangle | Approximately 29.2 × 6.6 m | Starting concept with approximately 1 m margin |

The long-axis calculation is `10 × 2.0 m + 9 × 0.8 m = 27.2 m`. The width is `3 × 1.0 m + 2 × 0.8 m = 4.6 m`.

## Height model

| Item | Baseline or target |
| --- | ---: |
| Maximum expected plant height | 2.3 m |
| Top pulley | Approximately 3.0 m |
| Cable spider / pod connection during normal imaging | Approximately 2.7–2.8 m |
| Camera lens during normal imaging | Approximately 2.55–2.65 m |
| Nominal clearance over a 2.3 m plant | Approximately 25–35 cm |

These heights are **unverified targets**. The installed system needs a three-dimensional safe workspace derived from actual anchor positions, pod geometry, line sag, wind/motion allowance, plant envelope, people, paths, and maintenance zones.

## Coordinate convention

The repository should define one right-handed site coordinate frame and version it with the site configuration. A recommended convention is:

- origin at a surveyed reference near one corner of the bed footprint;
- `+X` along the long bed axis;
- `+Y` across the three rows;
- `+Z` upward;
- anchor coordinates measured at the effective positioning-line tangent point, not merely the post center;
- bed and plant targets stored in the same frame;
- camera/gimbal transforms explicitly separated from the cable-spider position.

This convention is proposed and should become authoritative only when adopted in configuration and tests.

## Survey record

The as-built configuration must record:

- anchor coordinates and measurement uncertainty;
- pulley, dock, and fiducial coordinates;
- post verticality and observed movement under proof load;
- bed outlines and access paths;
- lowest measured line height in operating and parked configurations;
- exclusion and maintenance zones;
- underground or protected field-cable routes;
- survey date, coordinate-frame revision, tools, and reviewer.

## Safe workspace

The safe workspace is not equal to the geometric region in which Euclidean cable lengths can be calculated. It must also satisfy:

- positive tension in every line;
- configured line force and motor limits;
- plant, post, dock, and ground clearance;
- no commanded gimbal or ribbon collision;
- positioning-line height over accessible areas;
- dock approach and departure envelopes;
- margins for calibration uncertainty and modeled/observed error.

The V1 parking requirement targets at least 2.2 m line height over accessible work or walking areas. This value must be confirmed by measuring the lowest point of every line in the installed parked state, including the heavier powered line.

## Acceptance criteria

- The 30-bed target set fits inside the validated workspace without rebuilding anchors.
- Every anchor, bed, fiducial, dock, and exclusion zone is recorded in one versioned coordinate frame.
- The minimum clearance calculation includes tolerances, sag, pod dimensions, and measured error.
- Configuration outside the validated envelope is rejected locally.
- Survey data can be loaded by both operational software and simulation.

## Open questions

- What are the actual site coordinates, slopes, paths, obstacles, and soil conditions?
- Is approximately 3.0 m pulley height sufficient through the final crop and line-tension envelope?
- Which survey method and uncertainty are practical for commissioning and periodic checks?
- How far can posts move seasonally before recalibration or structural intervention is required?
- Which locations require privacy masking or capture exclusion?
