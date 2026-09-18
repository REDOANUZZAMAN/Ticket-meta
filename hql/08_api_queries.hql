-- ============================================================================
-- API QUERIES — All HiveQL queries used by flask_api.py endpoints
-- These are SparkSQL queries executed via the Flask REST API
-- Table: itineraries_orc (or ext_itineraries as fallback)
-- ============================================================================

USE ticketmeta09;

-- ═══════════════════════════════════════════════════════════
-- /api/search-flights — Flight Search
-- Params: origin, dest, nonstop, sort, limit
-- ═══════════════════════════════════════════════════════════

SELECT legId, searchDate, flightDate, startingAirport, destinationAirport,
       travelDuration, isNonStop, isBasicEconomy, isRefundable,
       CAST(baseFare AS DOUBLE) AS baseFare,
       CAST(totalFare AS DOUBLE) AS totalFare,
       CAST(seatsRemaining AS INT) AS seatsRemaining,
       CAST(totalTravelDistance AS DOUBLE) AS totalTravelDistance,
       segmentsAirlineName, segmentsEquipmentDescription,
       segmentsDepartureTimeRaw, segmentsArrivalTimeRaw,
       segmentsArrivalAirportCode, segmentsDepartureAirportCode
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'LAX'
  AND isNonStop = 'True'
ORDER BY CAST(totalFare AS DOUBLE) ASC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════
-- /api/where-to-fly — Cheapest Destinations
-- Params: origin, limit, nonstop
-- ═══════════════════════════════════════════════════════════

SELECT destinationAirport,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND CAST(totalFare AS DOUBLE) > 0
GROUP BY destinationAirport
ORDER BY minFare ASC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- /api/where-to-fly-budget — Budget Destinations with Distance
-- Params: origin, budget, nonstop
-- ═══════════════════════════════════════════════════════════

SELECT destinationAirport,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)), 0) AS avgDistance,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND CAST(totalFare AS DOUBLE) > 0
  AND CAST(totalFare AS DOUBLE) <= 500
GROUP BY destinationAirport
HAVING COUNT(*) >= 3
ORDER BY minFare ASC
LIMIT 30;


-- ═══════════════════════════════════════════════════════════
-- /api/when-to-fly — Monthly Price Trends
-- Params: origin, dest
-- ═══════════════════════════════════════════════════════════

SELECT SUBSTR(flightDate, 1, 7) AS month,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'LAX'
  AND CAST(totalFare AS DOUBLE) > 0
GROUP BY SUBSTR(flightDate, 1, 7)
ORDER BY month;


-- ═══════════════════════════════════════════════════════════
-- /api/airline-comparison — Compare Airlines on Route
-- Params: origin, dest
-- ═══════════════════════════════════════════════════════════

SELECT segmentsAirlineName AS airline,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'LAX'
  AND CAST(totalFare AS DOUBLE) > 0
  AND segmentsAirlineName IS NOT NULL
  AND TRIM(segmentsAirlineName) != ''
GROUP BY segmentsAirlineName
ORDER BY avgFare ASC;


-- ═══════════════════════════════════════════════════════════
-- /api/airports — Airport Search
-- Params: q (search term), limit
-- ═══════════════════════════════════════════════════════════

SELECT id, ident, type, name, latitude_deg, longitude_deg,
       elevation_ft, continent, iso_country, iso_region,
       municipality, scheduled_service, gps_code, iata_code,
       local_code, home_link, wikipedia_link, keywords
FROM ext_airports
WHERE (LOWER(name) LIKE '%tokyo%'
    OR LOWER(municipality) LIKE '%tokyo%'
    OR LOWER(iata_code) LIKE '%tokyo%'
    OR LOWER(ident) LIKE '%tokyo%')
  AND type IN ('large_airport','medium_airport','small_airport')
ORDER BY
  CASE type
    WHEN 'large_airport' THEN 1
    WHEN 'medium_airport' THEN 2
    ELSE 3
  END
LIMIT 20;


-- ═══════════════════════════════════════════════════════════
-- /api/optimize-route — Flight Splicing (Route Optimization)
-- Step 1: Direct flight baseline
-- ═══════════════════════════════════════════════════════════

-- Direct flight price
SELECT ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS bestDirect,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgDirect,
       COUNT(*) AS directCount
FROM itineraries_orc
WHERE startingAirport = 'ATL'
  AND destinationAirport = 'SFO'
  AND CAST(totalFare AS DOUBLE) > 0;

-- Splice via intermediate hub (CTE approach)
WITH leg1 AS (
    SELECT destinationAirport AS hub,
           ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS leg1Fare,
           COUNT(*) AS leg1Count
    FROM itineraries_orc
    WHERE startingAirport = 'ATL'
      AND CAST(totalFare AS DOUBLE) > 0
    GROUP BY destinationAirport
    HAVING COUNT(*) >= 5
    LIMIT 30
),
leg2 AS (
    SELECT startingAirport AS hub,
           ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS leg2Fare,
           COUNT(*) AS leg2Count
    FROM itineraries_orc
    WHERE destinationAirport = 'SFO'
      AND CAST(totalFare AS DOUBLE) > 0
    GROUP BY startingAirport
    HAVING COUNT(*) >= 5
    LIMIT 30
)
SELECT l1.hub,
       l1.leg1Fare, l2.leg2Fare,
       ROUND(l1.leg1Fare + l2.leg2Fare, 2) AS splicedTotal,
       l1.leg1Count, l2.leg2Count
FROM leg1 l1
JOIN leg2 l2 ON l1.hub = l2.hub
ORDER BY splicedTotal ASC
LIMIT 10;
