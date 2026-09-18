-- ============================================================================
-- EXTERNAL TABLE: ext_navaids (~11K navigation aids)
-- Source: OurAirports.com open data
-- Run: hive -f 05_ext_navaids.hql
-- ============================================================================

USE ticketmeta09;

DROP TABLE IF EXISTS ext_navaids;

CREATE EXTERNAL TABLE ext_navaids (
    id                    STRING,
    filename              STRING,
    ident                 STRING,
    name                  STRING,
    type                  STRING,
    frequency_khz         STRING,
    latitude_deg          STRING,
    longitude_deg         STRING,
    elevation_ft          STRING,
    iso_country           STRING,
    dme_frequency_khz     STRING,
    dme_channel           STRING,
    dme_latitude_deg      STRING,
    dme_longitude_deg     STRING,
    dme_elevation_ft      STRING,
    slaved_variation_deg  STRING,
    magnetic_variation_deg STRING,
    usageType             STRING,
    power                 STRING,
    associated_airport    STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
    "separatorChar" = ",",
    "quoteChar"     = "\"",
    "escapeChar"    = "\\"
)
STORED AS TEXTFILE
LOCATION '/user/ticketmeta09/data/navaids'
TBLPROPERTIES ("skip.header.line.count"="1");

-- Verify
SELECT COUNT(*) AS row_count FROM ext_navaids;
SELECT * FROM ext_navaids LIMIT 5;
