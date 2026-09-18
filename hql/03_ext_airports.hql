-- ============================================================================
-- EXTERNAL TABLE: ext_airports (~70K airports worldwide)
-- Source: OurAirports.com open data
-- Run: hive -f 03_ext_airports.hql
-- ============================================================================

USE ticketmeta09;

DROP TABLE IF EXISTS ext_airports;

CREATE EXTERNAL TABLE ext_airports (
    id              STRING,
    ident           STRING,
    type            STRING,
    name            STRING,
    latitude_deg    STRING,
    longitude_deg   STRING,
    elevation_ft    STRING,
    continent       STRING,
    iso_country     STRING,
    iso_region      STRING,
    municipality    STRING,
    scheduled_service STRING,
    gps_code        STRING,
    iata_code       STRING,
    local_code      STRING,
    home_link       STRING,
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
LOCATION '/user/ticketmeta09/data/airports'
TBLPROPERTIES ("skip.header.line.count"="1");

-- Verify
SELECT COUNT(*) AS row_count FROM ext_airports;
SELECT iata_code, name, municipality, iso_region, type
FROM ext_airports
WHERE iata_code != '' AND iso_country = 'US'
LIMIT 10;
