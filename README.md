<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-2.x-000000?logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/Apache%20Hive-3.x-FDEE21?logo=apachehive&logoColor=black" />
  <img src="https://img.shields.io/badge/Spark-3.x-E25A1C?logo=apachespark&logoColor=white" />
  <img src="https://img.shields.io/badge/Hadoop-3.x-66CCFF?logo=apachehadoop&logoColor=black" />
</p>

# ✈ Data Turbulence — Big Data Flight Analytics Platform

A full-stack **Big Data flight analytics platform** that queries **82M+ flight itineraries** stored in Apache Hive on a Hadoop cluster. Features real-time flight search, 22-card analytics dashboard, AI-powered chatbot, route optimization, visual suggestions, and external data enrichment — all with a premium dark-themed UI.

---

## 🏗 Architecture

```
┌─────────────────────┐          ┌──────────────────────────────────┐
│  React Frontend     │  HTTP    │  Flask + SparkSQL Backend        │
│  (Windows PC)       │◄────────►│  (Hadoop VM: 192.168.56.101)    │
│  localhost:3000     │  :5000   │                                  │
│                     │          │  ┌────────────────────────────┐  │
│  • Landing Page     │          │  │  Apache Hive (HiveQL)      │  │
│  • Flight Search    │          │  │  ticketmeta09 database     │  │
│  • Analytics (22)   │          │  │  82M+ itineraries_orc      │  │
│  • Visual Suggest.  │          │  │  ext_airports              │  │
│  • Route Optimizer  │          │  │  ext_runways               │  │
│  • Data Enrichment  │          │  │  + 7 external tables       │  │
│  • AI Chatbot       │          │  └────────────────────────────┘  │
└─────────────────────┘          └──────────────────────────────────┘
```

---

## 📁 Project Structure

```
webapp/
├── flask_api.py                  # Flask + SparkSQL backend (50+ endpoints)
├── optimize_table.py             # Convert CSV → ORC optimized table
├── quick_optimize.py             # Quick table optimization utility
├── enrichment_endpoints.py       # External data enrichment endpoints
├── generate_report.py            # Auto-generate analytics report
├── fix_safemode.py               # HDFS safe mode fix utility
├── hive_metastore_schema.sql     # Complete Hive schema reference
├── ext_regions.hql               # Region mapping HQL
│
├── hql/                          # Core HiveQL scripts
│   └── itineraries.hql           # Main itineraries table DDL
│
├── hql_code/                     # External data HQL scripts
│   ├── acsi_scores.hql           # Customer satisfaction scores
│   ├── airline_delay_cause.hql   # FAA delay cause data
│   ├── amtrak_rail_routes.hql    # Amtrak alternative routes
│   ├── dot_complaint_rates.hql   # DOT complaint rates
│   ├── navaids.hql               # Navigation aids data
│   ├── reddit_posts.hql          # Reddit airline sentiment
│   └── runways.hql               # Airport runway data
│
├── external_data/                # External CSV/JSON datasets
│   ├── acsi_airline_scores.csv
│   ├── amtrak_ne_corridor_routes.csv
│   ├── dot_complaint_rates.csv
│   └── reddit_api.json
│
└── frontend/                     # React 18 SPA
    ├── media/
    │   └── herovideo.mp4         # Landing page hero video
    ├── public/
    ├── src/
    │   ├── api.js                # Axios API helper
    │   ├── App.js                # Router (8 routes)
    │   ├── App.css               # 6000+ lines dark theme
    │   ├── index.css             # Base styles
    │   ├── components/
    │   │   └── Navbar.js         # Navigation + health indicator
    │   └── pages/
    │       ├── Landing.js              # Hero page with video background
    │       ├── FlightSearch.js         # Flight search with cards + HiveQL
    │       ├── AnalyticsDashboard.js   # 22-card analytics dashboard
    │       ├── VisualSuggestions.js     # Where/When to Fly visualizations
    │       ├── Optimized_Route.js      # Route optimization engine
    │       ├── DataEnrichment.js       # External data enrichment
    │       └── Chatbot.js              # AI text-to-SQL chatbot
    └── package.json
```

---

## 🚀 Setup Instructions

### Prerequisites

- **Hadoop Cluster** with Hive & Spark (3-node minimum)
- **Node.js** 16+ (for React frontend)
- **Python** 3.8+ with `pip`
- **Deepseek API Key** (for chatbot)

### 1. Backend — Hadoop VM (192.168.56.101)

```bash
# Copy flask_api.py to the VM
scp flask_api.py vboxuser@192.168.56.101:~/

# SSH into the VM
ssh vboxuser@192.168.56.101

# Install Python dependencies
pip install flask flask-cors pyhive thrift openai

# (Optional) Set OpenAI API key for chatbot
export DEEPSEEK_API_KEY="sk-your-key-here"

# Start the Flask API with Spark
spark-submit --master yarn flask_api.py
```

The API will be available at `http://192.168.56.101:5000`

**Verify it's running:**
```bash
curl http://192.168.56.101:5000/api/health
curl http://192.168.56.101:5000/api/tables
```

### 2. Frontend — Windows PC

```bash
cd frontend

# Install dependencies
npm install

# Configure the API URL (create .env from example)
copy .env.example .env
# Edit .env: REACT_APP_API_BASE_URL=http://192.168.56.101:5000/api

# Start development server
npm start
```

The React app will open at **http://localhost:3000**

---

## 📱 Pages & Features

### 1. 🏠 Landing Page
- **Hero section** with fullscreen video background (`herovideo.mp4`)
- Animated feature cards showcasing all platform capabilities
- Direct navigation to all sections

### 2. ✈ Flight Search
- Search by origin, destination, date range, nonstop preference
- Trip.com-style flight result cards with airline, duration, stops, fare
- Sort by cheapest, fastest, or best value
- **Show HiveQL Query** toggle displays the exact Hive query executed
- Pagination with configurable results per page

### 3. 📊 Analytics Dashboard (22 Cards)

The analytics dashboard contains **22 interactive cards** organized in 3 sections:

#### Section I: Pricing Analysis (7 cards)
| # | Card | What It Shows |
|---|------|---------------|
| 1 | Pricing Overview | Total flights, avg/min/max fare, refundable vs non-refundable pie charts |
| 2 | Top 15 Airlines | Airlines ranked by volume with dual-axis fare comparison |
| 3 | Day of Week | Flight volume & pricing by Mon–Sun |
| 4 | Weekend vs Midweek | Direct price comparison with stat cards |
| 5 | Booking Window | Area chart: fare vs days-before-departure (0-120 days) |
| 6 | Economy Price Gap | Basic economy vs standard economy by route |
| 7 | Nonstop Premium | Nonstop vs connecting fare difference on top 20 routes |

#### Section II: Network & Route Analysis (11 cards)
| # | Card | What It Shows |
|---|------|---------------|
| 8 | Network Overview | Unique airports, total records, data quality metrics |
| 9 | Longest Flights | Top 10 by distance with fare and duration |
| 10 | Top 20 Routes | Busiest air corridors by flight count |
| 11 | Top Municipalities | Cities with most outbound flights |
| 12 | Top Regions | US states with most active airports |
| 13 | Expensive Destinations | Top 10 priciest airports (avg/min/max) |
| 14 | Nonstop Route Volume | Routes with highest direct flight volume |
| 15 | Hub vs Regional Pricing | Large hub vs medium vs small airport fares |
| 16 | Region Pricing | Most expensive outbound state/region |
| 17 | Monopoly vs Competition | 1 airline vs 2 vs 3+ airline route pricing |
| 18 | Hub Carrier Pricing | Airline pricing at top 5 busiest airports |

#### Section III: Aviation & Equipment (4 cards)
| # | Card | What It Shows |
|---|------|---------------|
| 19 | Aircraft Overview | Boeing vs Airbus market share, top 10 aircraft types |
| 20 | Seats vs Pricing | Scarcity pricing: fewer seats = higher fares |
| 21 | Runway Length vs Price | Short runway airports vs long runway pricing |
| 22 | Aircraft Category Pricing | Wide-body vs narrow-body vs regional jet fares |

### 4. 🗺 Visual Suggestions (Where & When to Fly)
- **Where to Fly** — Enter origin + budget → scatter plot (distance vs fare), interactive Leaflet map with color-coded markers, best value destination highlighted
- **When to Fly** — Enter route → monthly fare trend line chart, dual bar charts (Jan-Jun / Jul-Dec), heatmap calendar, cheapest month highlighted
- **HiveQL Query** toggle on both tabs

### 5. 🔀 Route Optimization
- **Flight splicing engine** — finds cheaper multi-leg alternatives
- Enter origin + destination → system searches for intermediate hub connections
- Side-by-side comparison: direct fare vs spliced fare with savings %
- Animated flight path visualization
- **HiveQL Query** panel showing the splice query logic

### 6. 📡 Data Enrichment
- Integrates **7 external datasets** with core flight data:
  - ACSI Customer Satisfaction Scores
  - FAA Airline Delay Causes
  - DOT Complaint Rates
  - Airport Runway Data
  - Amtrak NE Corridor Routes (alternative transport)
  - Reddit Airline Sentiment
  - Navigation Aids (Navaids)
- Each dataset has its own visualization card
- Shows HQL table creation scripts

### 7. 🤖 AI Chatbot
- Natural language → HiveQL query generation (powered by OpenAI GPT)
- Ask questions like "What are the cheapest flights from ATL to LAX?"
- Displays generated SQL, execution results, and formatted data table
- Schema-aware: knows all table columns and types
- Requires `OPENAI_API_KEY` environment variable

---

## 🔌 API Endpoints (50+)

### Core Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Check Spark/Hive connection status |
| `GET /api/tables` | List all database tables |
| `GET /api/search-flights` | Search flights with filters |
| `GET /api/where-to-fly` | Cheapest destinations from origin |
| `GET /api/where-to-fly-budget` | Budget-filtered destinations with distance |
| `GET /api/when-to-fly` | Monthly fare trends for a route |
| `GET /api/optimize-route` | Flight splicing optimization |
| `POST /api/chatbot` | AI text-to-SQL chatbot |

### Analytics Endpoints (22)
| Endpoint | Card |
|----------|------|
| `GET /api/analytics/overview` | Pricing Overview |
| `GET /api/analytics/top-airlines` | Top 15 Airlines |
| `GET /api/analytics/day-of-week` | Day of Week |
| `GET /api/analytics/weekend-midweek` | Weekend vs Midweek |
| `GET /api/analytics/booking-window` | Booking Window |
| `GET /api/analytics/economy-gap` | Economy Price Gap |
| `GET /api/analytics/nonstop-premium` | Nonstop Premium |
| `GET /api/analytics/network-overview` | Network Overview |
| `GET /api/analytics/longest-flights` | Longest Flights |
| `GET /api/analytics/top-routes` | Top 20 Routes |
| `GET /api/analytics/top-municipalities` | Top Municipalities |
| `GET /api/analytics/top-regions` | Top Regions |
| `GET /api/analytics/expensive-destinations` | Expensive Destinations |
| `GET /api/analytics/nonstop-routes` | Nonstop Routes |
| `GET /api/analytics/hub-vs-regional` | Hub vs Regional |
| `GET /api/analytics/region-pricing` | Region Pricing |
| `GET /api/analytics/monopoly-routes` | Monopoly Routes |
| `GET /api/analytics/hub-carriers` | Hub Carriers |
| `GET /api/analytics/aircraft-overview` | Aircraft Overview |
| `GET /api/analytics/seats-pricing` | Seats Pricing |
| `GET /api/analytics/runway-pricing` | Runway Pricing |
| `GET /api/analytics/aircraft-pricing` | Aircraft Pricing |

### Enrichment Endpoints
| Endpoint | Data Source |
|----------|------------|
| `GET /api/enrichment/acsi-scores` | ACSI Satisfaction Scores |
| `GET /api/enrichment/delay-causes` | FAA Delay Causes |
| `GET /api/enrichment/complaint-rates` | DOT Complaints |
| `GET /api/enrichment/runways` | Runway Data |
| `GET /api/enrichment/amtrak-routes` | Amtrak Alternatives |
| `GET /api/enrichment/reddit-sentiment` | Reddit Sentiment |
| `GET /api/enrichment/navaids` | Navigation Aids |

---

## 🗄 Database Schema

**Database:** `ticketmeta09` on Apache Hive

### Core Table: `itineraries_orc` (~82M rows, ORC format)

| Column | Type | Description |
|--------|------|-------------|
| `legId` | STRING | Unique flight identifier |
| `searchDate` | STRING | When the fare was scraped |
| `flightDate` | STRING | Departure date |
| `startingAirport` | STRING | Origin IATA code (e.g., ATL) |
| `destinationAirport` | STRING | Destination IATA code |
| `fareBasisCode` | STRING | Fare class code |
| `travelDuration` | STRING | Total travel time |
| `elapsedDays` | STRING | Days of travel |
| `isBasicEconomy` | STRING | True/False |
| `isRefundable` | STRING | True/False |
| `isNonStop` | STRING | True/False |
| `baseFare` | STRING | Base ticket price |
| `totalFare` | STRING | Total price with taxes |
| `seatsRemaining` | STRING | Available seats |
| `totalTravelDistance` | STRING | Distance in miles |
| `segmentsAirlineName` | STRING | Operating airline |
| `segmentsEquipmentDescription` | STRING | Aircraft type |
| `segmentsDepartureTimeRaw` | STRING | Departure time |
| `segmentsArrivalTimeRaw` | STRING | Arrival time |
| `segmentsDepartureAirportCode` | STRING | Departure airport per segment |
| `segmentsArrivalAirportCode` | STRING | Arrival airport per segment |

### External Tables
| Table | Rows | Source |
|-------|------|--------|
| `ext_airports` | ~70K | OurAirports |
| `ext_runways` | ~40K | OurAirports |
| `ext_navaids` | ~11K | OurAirports |
| `ext_regions` | ~3.9K | OurAirports |
| `ext_acsi_scores` | ~100 | ACSI Survey |
| `ext_delay_causes` | ~25K | FAA/BTS |
| `ext_dot_complaints` | ~50 | DOT Reports |
| `ext_amtrak_routes` | ~15 | Amtrak |
| `ext_reddit_posts` | ~100 | Reddit API |

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router 6, Recharts, Leaflet, Lucide Icons, Axios |
| **Backend** | Flask 2.x, Flask-CORS, PySpark, SparkSQL |
| **Database** | Apache Hive 3.x (ORC format), HiveQL |
| **Cluster** | Apache Hadoop 3.x (HDFS + YARN), 3-node cluster |
| **AI** | OpenAI GPT-3.5-turbo (chatbot text-to-SQL) |
| **UI Theme** | Custom dark theme with glassmorphism, 6000+ CSS lines |

---

## 🛠 Utilities

| Script | Purpose |
|--------|---------|
| `optimize_table.py` | Convert raw CSV table to optimized ORC format |
| `quick_optimize.py` | Quick table optimization for faster queries |
| `generate_report.py` | Auto-generate analytics PDF report |
| `fix_safemode.py` | Fix HDFS NameNode safe mode via SSH |

---

## ⚠ Important Notes

- **Query performance:** Hive queries on 82M rows take 2–8 minutes (full table scan). The `itineraries_orc` table uses ORC format for better performance.
- **All columns are STRING type** — the API uses `CAST(col AS DOUBLE)` for numeric operations.
- The **green/red dot** in the navbar shows real-time backend connection status.
- Every page has a **"Show HiveQL Query"** toggle to see the exact SQL being executed.
- The chatbot requires `OPENAI_API_KEY` environment variable on the VM.
- API timeout is set to **10 minutes** to accommodate slow Hive queries.
- If HDFS enters safe mode, run `python fix_safemode.py` to fix it.

---

## 👥 Team

**Ticket Meta** — Big Data Analytics Internship Project

---

<p align="center">
  Built with ❤ using React, Flask, Hive, Spark & Hadoop
</p>
