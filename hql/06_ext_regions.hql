-- ============================================================================
-- EXTERNAL TABLE: ext_regions (~3.9K region records)
-- Source: OurAirports.com open data
-- Run: hive -f 06_ext_regions.hql
-- ============================================================================

USE ticketmeta09;

DROP TABLE IF EXISTS ext_regions;

CREATE EXTERNAL TABLE ext_regions (
    id              STRING,
    code            STRING,
    local_code      STRING,
    name            STRING,
    continent       STRING,
    iso_country     STRING,
    wikipedia_link  STRING,
    keywords        STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
    "separatorChar" = ",",
    "quoteChar"     = "\"",
    "escapeChar"    = "\\"
)
STORED AS TEXTFILE
LOCATION '/user/arafat/ticketmeta09/data/regions'
TBLPROPERTIES ("skip.header.line.count"="1");

-- Verify
SELECT COUNT(*) AS row_count FROM ext_regions;
SELECT * FROM ext_regions LIMIT 5;
