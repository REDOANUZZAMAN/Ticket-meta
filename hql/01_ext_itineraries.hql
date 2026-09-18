-- ============================================================================
-- EXTERNAL TABLE: ext_itineraries (Main Fact Table ~82M rows, ~30GB CSV)
-- Source: Expedia/ITA Matrix scraped flight data
-- Run: hive -f 01_ext_itineraries.hql
-- ============================================================================

USE ticketmeta09;

DROP TABLE IF EXISTS ext_itineraries;

CREATE EXTERNAL TABLE ext_itineraries (
    legId                              STRING,
    searchDate                         STRING,
    flightDate                         STRING,
    startingAirport                    STRING,
    destinationAirport                 STRING,
    fareBasisCode                      STRING,
    travelDuration                     STRING,
    elapsedDays                        STRING,
    isBasicEconomy                     STRING,
    isRefundable                       STRING,
    isNonStop                          STRING,
    baseFare                           STRING,
    totalFare                          STRING,
    seatsRemaining                     STRING,
    totalTravelDistance                 STRING,
    segmentsDepartureTimeEpochSeconds  STRING,
    segmentsDepartureTimeRaw           STRING,
    segmentsArrivalTimeEpochSeconds    STRING,
    segmentsArrivalTimeRaw             STRING,
    segmentsArrivalAirportCode         STRING,
    segmentsDepartureAirportCode       STRING,
    segmentsAirlineName                STRING,
    segmentsAirlineCode                STRING,
    segmentsEquipmentDescription       STRING,
    segmentsDurationInSeconds          STRING,
    segmentsDistance                    STRING,
    segmentsCabinCode                  STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
    "separatorChar" = ",",
    "quoteChar"     = "\"",
    "escapeChar"    = "\\"
)
STORED AS TEXTFILE
LOCATION '/user/root/ticketmeta09/data/itineraries'
TBLPROPERTIES ("skip.header.line.count"="1");

-- Verify
SELECT COUNT(*) AS row_count FROM ext_itineraries;
SELECT * FROM ext_itineraries LIMIT 5;
