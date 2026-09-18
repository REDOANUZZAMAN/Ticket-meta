-- ============================================================================
-- ANALYTICS DASHBOARD QUERIES — 22 Analytical HiveQL Queries
-- Used by: /api/analytics/* endpoints in flask_api.py
-- Table: itineraries_orc | Joins: ext_airports, ext_runways
-- ============================================================================

USE ticketmeta09;

-- ═══════════════════════════════════════════════════════════
-- I.1 Pricing Overview (/api/analytics/overview)
-- ═══════════════════════════════════════════════════════════

SELECT
    COUNT(*) AS totalFlights,
    ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
    ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
    ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
    SUM(CASE WHEN isRefundable = 'True' THEN 1 ELSE 0 END) AS refundableCount,
    SUM(CASE WHEN isRefundable = 'False' THEN 1 ELSE 0 END) AS nonRefundableCount,
    ROUND(AVG(CASE WHEN isRefundable = 'True' THEN CAST(totalFare AS DOUBLE) END), 2) AS avgFareRefundable,
    ROUND(AVG(CASE WHEN isRefundable = 'False' THEN CAST(totalFare AS DOUBLE) END), 2) AS avgFareNonRefundable,
    SUM(CASE WHEN isBasicEconomy = 'True' THEN 1 ELSE 0 END) AS basicEconomyCount,
    SUM(CASE WHEN isBasicEconomy = 'False' THEN 1 ELSE 0 END) AS standardEconomyCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0;


-- ═══════════════════════════════════════════════════════════
-- I.2 Top 15 Airlines (/api/analytics/top-airlines)
-- ═══════════════════════════════════════════════════════════

SELECT segmentsAirlineName AS airline,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
  AND segmentsAirlineName IS NOT NULL
  AND TRIM(segmentsAirlineName) != ''
GROUP BY segmentsAirlineName
ORDER BY flightCount DESC
LIMIT 15;


-- ═══════════════════════════════════════════════════════════
-- I.3 Day of Week (/api/analytics/day-of-week)
-- ═══════════════════════════════════════════════════════════

SELECT
    DAYOFWEEK(TO_DATE(flightDate)) AS dayNum,
    CASE DAYOFWEEK(TO_DATE(flightDate))
        WHEN 1 THEN 'Sunday'    WHEN 2 THEN 'Monday'
        WHEN 3 THEN 'Tuesday'   WHEN 4 THEN 'Wednesday'
        WHEN 5 THEN 'Thursday'  WHEN 6 THEN 'Friday'
        WHEN 7 THEN 'Saturday'
    END AS dayName,
    COUNT(*) AS flightCount,
    ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY DAYOFWEEK(TO_DATE(flightDate))
ORDER BY dayNum;


-- ═══════════════════════════════════════════════════════════
-- I.4 Booking Window (/api/analytics/booking-window)
-- ═══════════════════════════════════════════════════════════

SELECT
    DATEDIFF(TO_DATE(flightDate), TO_DATE(searchDate)) AS bookingWindow,
    ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
    ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
    COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
  AND DATEDIFF(TO_DATE(flightDate), TO_DATE(searchDate)) BETWEEN 0 AND 120
GROUP BY DATEDIFF(TO_DATE(flightDate), TO_DATE(searchDate))
ORDER BY bookingWindow;


-- ═══════════════════════════════════════════════════════════
-- I.5 Weekend vs Midweek (/api/analytics/weekend-midweek)
-- ═══════════════════════════════════════════════════════════

SELECT
    CASE WHEN DAYOFWEEK(TO_DATE(flightDate)) IN (1, 6, 7)
         THEN 'Weekend' ELSE 'Midweek' END AS travelType,
    ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
    ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
    ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
    COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY CASE WHEN DAYOFWEEK(TO_DATE(flightDate)) IN (1, 6, 7)
              THEN 'Weekend' ELSE 'Midweek' END;


-- ═══════════════════════════════════════════════════════════
-- I.6 Economy Price Gap (/api/analytics/economy-gap)
-- ═══════════════════════════════════════════════════════════

SELECT startingAirport, destinationAirport,
       ROUND(AVG(CASE WHEN isBasicEconomy='True' THEN CAST(totalFare AS DOUBLE) END), 2) AS avgBasic,
       ROUND(AVG(CASE WHEN isBasicEconomy='False' THEN CAST(totalFare AS DOUBLE) END), 2) AS avgStandard,
       ROUND(AVG(CASE WHEN isBasicEconomy='False' THEN CAST(totalFare AS DOUBLE) END)
           - AVG(CASE WHEN isBasicEconomy='True' THEN CAST(totalFare AS DOUBLE) END), 2) AS priceGap,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport, destinationAirport
HAVING AVG(CASE WHEN isBasicEconomy='True' THEN CAST(totalFare AS DOUBLE) END) IS NOT NULL
   AND AVG(CASE WHEN isBasicEconomy='False' THEN CAST(totalFare AS DOUBLE) END) IS NOT NULL
ORDER BY priceGap DESC
LIMIT 15;


-- ═══════════════════════════════════════════════════════════
-- I.10 Nonstop Premium (/api/analytics/nonstop-premium)
-- ═══════════════════════════════════════════════════════════

SELECT route, nonstop_avg, connecting_avg,
       ROUND(nonstop_avg - connecting_avg, 2) AS premium
FROM (
    SELECT CONCAT(startingAirport, ' → ', destinationAirport) AS route,
           ROUND(AVG(CASE WHEN isNonStop='True' THEN CAST(totalFare AS DOUBLE) END), 2) AS nonstop_avg,
           ROUND(AVG(CASE WHEN isNonStop='False' THEN CAST(totalFare AS DOUBLE) END), 2) AS connecting_avg,
           COUNT(*) AS total
    FROM itineraries_orc
    WHERE CAST(totalFare AS DOUBLE) > 0
    GROUP BY startingAirport, destinationAirport
    HAVING COUNT(*) >= 1000
) sub
WHERE nonstop_avg IS NOT NULL AND connecting_avg IS NOT NULL
ORDER BY total DESC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════
-- II.1 Network Overview (/api/analytics/network-overview)
-- ═══════════════════════════════════════════════════════════

SELECT
    COUNT(DISTINCT startingAirport) AS unique_origins,
    COUNT(DISTINCT destinationAirport) AS unique_destinations,
    COUNT(*) AS total_records,
    SUM(CASE WHEN totalTravelDistance IS NULL
         OR TRIM(totalTravelDistance) = ''
         OR CAST(totalTravelDistance AS DOUBLE) = 0 THEN 1 ELSE 0 END) AS null_distance_records
FROM itineraries_orc;


-- ═══════════════════════════════════════════════════════════
-- II.2 Longest Flights (/api/analytics/longest-flights)
-- ═══════════════════════════════════════════════════════════

SELECT startingAirport, destinationAirport,
       CAST(totalTravelDistance AS DOUBLE) AS distance,
       segmentsAirlineName AS airline,
       CAST(totalFare AS DOUBLE) AS fare,
       travelDuration
FROM itineraries_orc
WHERE CAST(totalTravelDistance AS DOUBLE) > 0
ORDER BY CAST(totalTravelDistance AS DOUBLE) DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- II.3 Top 20 Routes (/api/analytics/top-routes)
-- ═══════════════════════════════════════════════════════════

SELECT CONCAT(startingAirport, ' → ', destinationAirport) AS route,
       COUNT(*) AS flightCount,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY startingAirport, destinationAirport
ORDER BY flightCount DESC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════
-- II.4 Top Municipalities (/api/analytics/top-municipalities)
-- JOIN: ext_airports
-- ═══════════════════════════════════════════════════════════

SELECT a.municipality, COUNT(*) AS flightCount,
       ROUND(AVG(CAST(f.totalFare AS DOUBLE)), 2) AS avgFare
FROM itineraries_orc f
JOIN ext_airports a ON f.startingAirport = a.iata_code
WHERE a.municipality IS NOT NULL AND TRIM(a.municipality) != ''
  AND CAST(f.totalFare AS DOUBLE) > 0
GROUP BY a.municipality
ORDER BY flightCount DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- II.5 Top Regions (/api/analytics/top-regions)
-- JOIN: ext_airports
-- ═══════════════════════════════════════════════════════════

SELECT a.iso_region AS region,
       COUNT(DISTINCT f.startingAirport) AS airportCount,
       COUNT(*) AS flightCount
FROM itineraries_orc f
JOIN ext_airports a ON f.startingAirport = a.iata_code
WHERE a.iso_region IS NOT NULL
GROUP BY a.iso_region
ORDER BY airportCount DESC
LIMIT 5;


-- ═══════════════════════════════════════════════════════════
-- II.6 Expensive Destinations (/api/analytics/expensive-destinations)
-- ═══════════════════════════════════════════════════════════

SELECT destinationAirport,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MIN(CAST(totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(MAX(CAST(totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY destinationAirport
HAVING COUNT(*) >= 100
ORDER BY avgFare DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- II.7 Nonstop Route Volume (/api/analytics/nonstop-routes)
-- ═══════════════════════════════════════════════════════════

SELECT CONCAT(startingAirport, ' → ', destinationAirport) AS route,
       SUM(CASE WHEN isNonStop = 'True' THEN 1 ELSE 0 END) AS nonstopCount,
       COUNT(*) AS totalFlights
FROM itineraries_orc
GROUP BY startingAirport, destinationAirport
HAVING SUM(CASE WHEN isNonStop = 'True' THEN 1 ELSE 0 END) > 0
ORDER BY nonstopCount DESC
LIMIT 20;


-- ═══════════════════════════════════════════════════════════
-- II.8 Hub vs Regional Pricing (/api/analytics/hub-vs-regional)
-- JOIN: ext_airports
-- ═══════════════════════════════════════════════════════════

SELECT a.type AS airport_type,
       ROUND(AVG(CAST(f.totalFare AS DOUBLE)), 2) AS avgFare,
       ROUND(MIN(CAST(f.totalFare AS DOUBLE)), 2) AS minFare,
       ROUND(MAX(CAST(f.totalFare AS DOUBLE)), 2) AS maxFare,
       COUNT(*) AS flightCount
FROM itineraries_orc f
JOIN ext_airports a ON f.startingAirport = a.iata_code
WHERE a.type IN ('large_airport', 'medium_airport', 'small_airport')
  AND CAST(f.totalFare AS DOUBLE) > 0
GROUP BY a.type
ORDER BY flightCount DESC;


-- ═══════════════════════════════════════════════════════════
-- II.9 Region Pricing (/api/analytics/region-pricing)
-- JOIN: ext_airports
-- ═══════════════════════════════════════════════════════════

SELECT a.iso_region AS region,
       ROUND(AVG(CAST(f.totalFare AS DOUBLE)), 2) AS avgFare,
       COUNT(*) AS flightCount
FROM itineraries_orc f
JOIN ext_airports a ON f.startingAirport = a.iata_code
WHERE a.iso_region IS NOT NULL
  AND CAST(f.totalFare AS DOUBLE) > 0
GROUP BY a.iso_region
ORDER BY avgFare DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- II.10 Monopoly vs Competition (/api/analytics/monopoly-routes)
-- ═══════════════════════════════════════════════════════════

SELECT competition,
       COUNT(*) AS routeCount,
       ROUND(AVG(overallAvgFare), 2) AS overallAvgFare,
       ROUND(AVG(avgPricePerMile), 4) AS avgPricePerMile
FROM (
    SELECT startingAirport, destinationAirport,
           COUNT(DISTINCT segmentsAirlineName) AS airlineCount,
           CASE
               WHEN COUNT(DISTINCT segmentsAirlineName) = 1 THEN 'Monopoly (1 airline)'
               WHEN COUNT(DISTINCT segmentsAirlineName) = 2 THEN 'Duopoly (2 airlines)'
               ELSE 'Competitive (3+ airlines)'
           END AS competition,
           ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS overallAvgFare,
           ROUND(AVG(CAST(totalFare AS DOUBLE) / NULLIF(CAST(totalTravelDistance AS DOUBLE), 0)), 4) AS avgPricePerMile
    FROM itineraries_orc
    WHERE CAST(totalFare AS DOUBLE) > 0
    GROUP BY startingAirport, destinationAirport
) sub
GROUP BY competition;


-- ═══════════════════════════════════════════════════════════
-- II.11 Hub Carrier Pricing (/api/analytics/hub-carriers)
-- ═══════════════════════════════════════════════════════════

SELECT startingAirport AS hub,
       segmentsAirlineName AS airline,
       ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
  AND segmentsAirlineName IS NOT NULL
  AND startingAirport IN (
      SELECT startingAirport
      FROM itineraries_orc
      GROUP BY startingAirport
      ORDER BY COUNT(*) DESC
      LIMIT 5
  )
GROUP BY startingAirport, segmentsAirlineName
ORDER BY hub, flightCount DESC;


-- ═══════════════════════════════════════════════════════════
-- III.1 Aircraft Overview (/api/analytics/aircraft-overview)
-- ═══════════════════════════════════════════════════════════

SELECT
    COUNT(DISTINCT segmentsEquipmentDescription) AS totalModels,
    SUM(CASE WHEN LOWER(segmentsEquipmentDescription) LIKE '%boeing%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%737%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%747%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%757%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%767%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%777%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%787%'
         THEN 1 ELSE 0 END) AS boeing,
    SUM(CASE WHEN LOWER(segmentsEquipmentDescription) LIKE '%airbus%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a318%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a319%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a320%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a321%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a330%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a340%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a350%'
              OR LOWER(segmentsEquipmentDescription) LIKE '%a380%'
         THEN 1 ELSE 0 END) AS airbus,
    COUNT(*) AS total
FROM itineraries_orc;

-- Top 10 Aircraft Types
SELECT segmentsEquipmentDescription AS aircraft,
       COUNT(*) AS flightCount
FROM itineraries_orc
WHERE segmentsEquipmentDescription IS NOT NULL
  AND TRIM(segmentsEquipmentDescription) != ''
GROUP BY segmentsEquipmentDescription
ORDER BY flightCount DESC
LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- III.2 Seats vs Pricing (/api/analytics/seats-pricing)
-- ═══════════════════════════════════════════════════════════

SELECT
    CASE
        WHEN CAST(seatsRemaining AS INT) = 0 THEN '0 seats'
        WHEN CAST(seatsRemaining AS INT) BETWEEN 1 AND 3 THEN '1-3 seats'
        WHEN CAST(seatsRemaining AS INT) BETWEEN 4 AND 6 THEN '4-6 seats'
        ELSE '7+ seats'
    END AS seatCategory,
    ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
    COUNT(*) AS flightCount
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
GROUP BY
    CASE
        WHEN CAST(seatsRemaining AS INT) = 0 THEN '0 seats'
        WHEN CAST(seatsRemaining AS INT) BETWEEN 1 AND 3 THEN '1-3 seats'
        WHEN CAST(seatsRemaining AS INT) BETWEEN 4 AND 6 THEN '4-6 seats'
        ELSE '7+ seats'
    END
ORDER BY avgFare DESC;


-- ═══════════════════════════════════════════════════════════
-- III.3 Runway Length vs Price (/api/analytics/runway-pricing)
-- JOIN: ext_airports, ext_runways
-- ═══════════════════════════════════════════════════════════

SELECT
    CASE
        WHEN CAST(r.length_ft AS INT) < 5000 THEN 'Short (<5000ft)'
        WHEN CAST(r.length_ft AS INT) BETWEEN 5000 AND 8000 THEN 'Medium (5000-8000ft)'
        ELSE 'Long (>8000ft)'
    END AS runwayCategory,
    ROUND(AVG(CAST(f.totalFare AS DOUBLE)), 2) AS avgFare,
    COUNT(*) AS flightCount
FROM itineraries_orc f
JOIN ext_airports a ON f.startingAirport = a.iata_code
JOIN ext_runways r ON a.ident = r.airport_ident
WHERE CAST(f.totalFare AS DOUBLE) > 0
  AND r.length_ft IS NOT NULL
  AND TRIM(r.length_ft) != ''
GROUP BY
    CASE
        WHEN CAST(r.length_ft AS INT) < 5000 THEN 'Short (<5000ft)'
        WHEN CAST(r.length_ft AS INT) BETWEEN 5000 AND 8000 THEN 'Medium (5000-8000ft)'
        ELSE 'Long (>8000ft)'
    END
ORDER BY avgFare DESC;


-- ═══════════════════════════════════════════════════════════
-- III.4 Aircraft Category Pricing (/api/analytics/aircraft-pricing)
-- ═══════════════════════════════════════════════════════════

SELECT
    CASE
        WHEN LOWER(segmentsEquipmentDescription) LIKE '%777%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%787%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a330%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a340%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a350%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a380%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%747%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%767%'
        THEN 'Wide-body'
        WHEN LOWER(segmentsEquipmentDescription) LIKE '%737%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a319%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a320%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a321%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%757%'
        THEN 'Narrow-body'
        WHEN LOWER(segmentsEquipmentDescription) LIKE '%embraer%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%crj%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%erj%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%bombardier%'
        THEN 'Regional Jet'
        ELSE 'Other'
    END AS aircraftCategory,
    ROUND(AVG(CAST(totalFare AS DOUBLE)), 2) AS avgFare,
    COUNT(*) AS flightCount,
    ROUND(AVG(CAST(totalTravelDistance AS DOUBLE)), 0) AS avgDistance
FROM itineraries_orc
WHERE CAST(totalFare AS DOUBLE) > 0
  AND segmentsEquipmentDescription IS NOT NULL
GROUP BY
    CASE
        WHEN LOWER(segmentsEquipmentDescription) LIKE '%777%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%787%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a330%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a340%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a350%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a380%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%747%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%767%'
        THEN 'Wide-body'
        WHEN LOWER(segmentsEquipmentDescription) LIKE '%737%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a319%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a320%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%a321%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%757%'
        THEN 'Narrow-body'
        WHEN LOWER(segmentsEquipmentDescription) LIKE '%embraer%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%crj%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%erj%'
          OR LOWER(segmentsEquipmentDescription) LIKE '%bombardier%'
        THEN 'Regional Jet'
        ELSE 'Other'
    END
ORDER BY avgFare DESC;
