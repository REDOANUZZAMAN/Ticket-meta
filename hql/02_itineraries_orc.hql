-- ============================================================================
-- OPTIMIZED ORC TABLE: itineraries_orc (~82M rows, ORC+SNAPPY)
-- Converts raw CSV ext_itineraries to columnar ORC for 10x faster queries
-- Run: hive -f 02_itineraries_orc.hql (takes ~15-30 min)
-- ============================================================================

USE ticketmeta09;

DROP TABLE IF EXISTS itineraries_orc;

CREATE TABLE itineraries_orc (
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
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY');

-- Load data from CSV external table into ORC
INSERT OVERWRITE TABLE itineraries_orc
SELECT * FROM ext_itineraries;

-- Verify
SELECT COUNT(*) AS row_count FROM itineraries_orc;
SELECT * FROM itineraries_orc LIMIT 5;
