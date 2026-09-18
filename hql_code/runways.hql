-- ============================================================================
-- STEP 1.7: EXTERNAL TABLE - runways
-- Run: hive -f 07_ext_runways.hql
-- ============================================================================

USE ticketmeta09;

DROP TABLE IF EXISTS ext_runways;

CREATE EXTERNAL TABLE ext_runways
(
    id                          STRING,
    airport_ref                 STRING,
    airport_ident               STRING,
    length_ft                   STRING,
    width_ft                    STRING,
    surface                     STRING,
    lighted                     STRING,
    closed                      STRING,
    le_ident                    STRING,
    le_latitude_deg             STRING,
    le_longitude_deg            STRING,
    le_elevation_ft             STRING,
    le_heading_degT             STRING,
    le_displaced_threshold_ft   STRING,
    he_ident                    STRING,
    he_latitude_deg             STRING,
    he_longitude_deg            STRING,
    he_elevation_ft             STRING,
    he_heading_degT             STRING,
    he_displaced_threshold_ft   STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
    "separatorChar" = ",",
    "quoteChar"     = "\"",
    "escapeChar"    = "\\"
)
STORED AS TEXTFILE
LOCATION '/user/ticketmeta09/data/runways'
TBLPROPERTIES ("skip.header.line.count"="1");

-- Verify
SELECT COUNT(*) AS row_count FROM ext_runways;
SELECT * FROM ext_runways LIMIT 5;
