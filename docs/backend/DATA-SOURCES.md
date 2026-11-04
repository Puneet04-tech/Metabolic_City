# Data sources

Every number this system shows comes from somewhere. This is where each one
comes from, what it costs, and what the system does when it is not there.

## The rule

The system never invents a measurement. When a source is missing, the cells
that depend on it are marked `NO_MOBILITY_DATA`, `NO_CLIMATE_DATA` or
`NO_VULNERABILITY_DATA`, the confidence score drops, and the console says so
in the cell detail. A cell with no readings is not a cell with a low score.

## What is real today

| Signal | Source | Cost | Freshness |
| --- | --- | --- | --- |
| **Climate** (Sc) | [Open-Meteo](https://open-meteo.com) forecast: temperature, humidity, precipitation, wind gusts, visibility | Free, no key | 5 real observations per city per cycle, interpolated to every cell |
| **Terrain** (Sv) | [Open-Meteo elevation](https://open-meteo.com/en/docs/elevation-api) (a real digital elevation model) plus [OpenStreetMap](https://www.openstreetmap.org) watercourses | Free, no key | Cached 30 days; the ground does not change |
| **Street network** | [OpenStreetMap API 0.6](https://wiki.openstreetmap.org/wiki/API_v0.6) — real roads, real names, real rivers | Free, no key, no key registration | Cached 30 days |
| **Road speed** (Sm) | [TomTom Traffic Flow](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/traffic-flow/flow-segment-data): `currentSpeed` against `freeFlowSpeed`, and `currentTravelTime` against `freeFlowTravelTime` | Free tier: 2,500 non-tile requests a day, no credit card, commercial use allowed. India is covered. | One reading per probed road every 30 minutes |
| **Road incidents** | [TomTom Traffic Incidents](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/traffic-incidents/incident-details) — accidents, roadworks, closures, jams and flooding, each with a delay against free-flow | Shares the same free allowance | Every 30 minutes |
| **Citizen reports** | The public report form and the field crew app | Free | Live |
| **Crew road speed** | The field crew app posting its own GPS (`POST /api/v1/field/position`) | Free | Live, wherever a crew is |

The cell set follows from the street network: **a cell exists because there is
a real street in it.** In Bhopal that is 55 cells over the areas the network
covers; in Indore it is a similar number over the Saraswati and Khan river
corridors.

## What is not real, and why it is off

| Source | Status | How to turn it on |
| --- | --- | --- |
| Modelled transit | **Off by default.** A modelled bus delay is not a measurement. | `TRANSIT_SIMULATION_ENABLED=true` |
| Survey calibration data | **Refused unless asked for.** The workbooks say so themselves: "populated synthetic calibration/template responses". | `ALLOW_SYNTHETIC_SEED=true npm run data:seed-calibration` |
| Synthetic weather | **Off.** `WEATHER_SYNTHETIC_FALLBACK_ENABLED=false` is the default. | `WEATHER_SYNTHETIC_FALLBACK_ENABLED=true` |

`npm run data:purge-simulated` removes anything left over from the old
simulation: modelled transit events, synthetic weather, synthetic survey
events, and the cells that only existed because of them.

## The city's live bus feed

`GTFS_RT_URL` reads a GTFS-Realtime feed and attributes each vehicle to the
stop it is serving, with the speed measured against the expected speed for
that stretch of road. It needs the city's permission, so it is not on the
critical path — the system is fully operational on road traffic alone.

## Turning on real traffic

1. Create a TomTom account at [my.tomtom.com](https://my.tomtom.com) and go
   to **API & SDK Keys**. TomTom's key is called "My first API key" and is
   created for you. Make sure **Traffic API** is in the key's product list.
2. Put it in `backend/.env`:
   ```
   TOMTOM_API_KEY=your-key
   ```
   The portal key works. If you also have a service key (`sk.…`), put it in
   `TOMTOM_SERVICE_KEY` and it is tried first.
3. Restart the server.

Nothing else changes. No API contract changes, no scoring changes, no
frontend changes.

### The two endpoints

| | |
| --- | --- |
| Flow (speed and delay) | `GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/16/json?point=<lat>,<lon>&unit=kmph` — one request per road. It answers with `currentSpeed`, `freeFlowSpeed`, `currentTravelTime`, `freeFlowTravelTime` and a `confidence` between 0 and 1. The delay is the difference between the two travel times, so it is measured against free flow rather than against a guess. The response also carries the real geometry of the road it matched, so the reading is placed on the road and not on the point that was asked about. |
| Incidents | `GET https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=<minLon,minLat,maxLon,maxLat>` — one request for a whole area. It answers with accidents, roadworks, lane closures, road closures, flooding and jams, each with its own delay against free flow. |

### The free tier, as TomTom publishes it

Counted **per month, per API, per project**. Not per key.

| API | Free per month |
| --- | --- |
| Traffic Flow API Segment Data | 20,000 |
| Traffic Incidents API Details | 2,500 |
| **Traffic Flow & Incidents API Raster Tiles** | **200,000** |
| **Traffic Flow & Incidents API Vector Tiles** | **200,000** |
| Routing API | 20,000 |
| Geocoding / Reverse Geocoding | 20,000 |

When the allowance is exceeded, requests return **429**.

**Key rotation is a security feature, not a way to get more quota.** It
regenerates a key that may have leaked, and the old key keeps working for up
to 48 hours so the code can be changed over. The allowance is counted
against the project, so a second key in the same project draws on the same
monthly allowance. The free tier is also a single-user tier, so it cannot
be shared with a team.

The two keys the system holds are tried in order, the service key first and
the portal key second. That is for key *validity* — some endpoints refuse a
portal key when the call comes from a server — not for quota.

**The traffic tiles have ten times the allowance of the flow segment data**,
which is the way to cover every cell on every poll for free.

### How many probes, and how the month's allowance is protected

**The free tier is counted per month**, and the two endpoints have separate
allowances:

| Endpoint | Monthly allowance |
| --- | --- |
| Traffic Flow Segment Data | 20,000 |
| Traffic Incident Details | 2,500 |
| Weather (Open-Meteo) | 10,000 |

The incident feed is the scarcer of the two, so it is what sets the pace of
the poll.

Left alone, three cities at twenty roads an hour would be **43,200 flow
readings a month — 23,200 over the allowance** — and the provider would
start refusing requests partway through the first week.

So the system counts what it has spent, works out how many polls are still
to come this month, and sizes each poll to fit what is left:

```
polls the incidents can afford = incident calls left ÷ cities
roads per city per poll        = flow allowance left ÷ (polls × cities)
```

Over a full month that settles at **8 roads per city per poll** and
**19,992 of the 20,000 flow allowance and 2,499 of the 2,500 incident
allowance used** — the whole month, every cycle, with the tier intact. If
the allowance is generous the ceiling of 20 applies instead, and if it is
tight the system asks for fewer rather than being refused.

| Setting | Default | Effect |
| --- | --- | --- |
| `TRAFFIC_POLL_MINUTES` | `60` | How often the traffic is re-read. The score uses a 60-minute window, so this is the shortest interval that keeps a reading inside it. |
| `TRAFFIC_PROBES_PER_CITY` | `20` | The ceiling on how many roads are measured per city per poll. |
| `TOMTOM_FLOW_MONTHLY_LIMIT` | `20000` | The monthly allowance for speed readings. |
| `TOMTOM_INCIDENT_MONTHLY_LIMIT` | `2500` | The monthly allowance for incident look-ups. |
| `OPENMETEO_MONTHLY_LIMIT` | `8000` | The same for the weather API. |

The count lives in the database, so a restart does not hand the month a
fresh allowance, and a second instance sees the same number. The month rolls
over at midnight UTC on the first, when the provider resets.

### When the provider says no

A `429` is honoured rather than retried blindly: the wait the provider asks
for is taken, and traffic pauses for that long. The last readings stay in
the window, so the cells keep their mobility score until the next poll.

### How many cells have a current reading

A road-speed reading is valid for sixty minutes, and the flow allowance is
20,000 a month, which works out at 720 polls a month at one an hour. A poll
measures a fixed number of roads, so:

```
flow calls a month = 720 × (cells with a current reading)
```

So the free allowance caps the number of cells that can have a current
reading at **20,000 ÷ 720 = 27 cells**, whichever way the poll is set up.
At the current settings, 24 of the 100 cells across the three cities have a
road-speed reading at any moment; the other 76 say so rather than showing a
score they have no reading for.

**Resolution is the lever that does not cost anything.** The cells come from
the real street network, so the number of them follows from the H3
resolution:

| Resolution | Bhopal | Indore | Sehore | Total | Cells covered by the free tier |
| --- | --- | --- | --- | --- | --- |
| 7 (~1.2 km) | 10 | 10 | 12 | 32 | 24 of 32 — **75%** |
| 8 (~460 m) | 43 | 32 | 25 | 100 | 24 of 100 — **24%** |
| 9 (~170 m) | 301 | 224 | 175 | 700 | 24 of 700 — **3%** |

Resolution 7 would give three quarters of the cells a current reading for
the same money, with no change to the data and nothing modelled. What it
costs is geographic detail: a cell becomes a neighbourhood rather than a
street block. The cells still name the real streets inside them, so the
console still shows the operator where to send a crew.

**The traffic tiles are the other lever, and they are the only one that
keeps the fine resolution.** They have an allowance of 200,000 a month,
ten times the flow segment data. What they do not have is travel times: a
tile carries a speed *band* for each road, so the delay would have to be
derived from that band and the real length of the road rather than measured
directly. That would mean a cell's delay is sometimes a measurement and
sometimes a derivation, and the system would no longer be able to say that
every number in it is a measurement. That is why the tiles are not in use.

Both are recorded here so the choice is a deliberate one rather than an
accident of the free tier.

## The field crew as a sensor

The crew app is already on a phone in a vehicle on a real road. Reporting the
position turns it into a traffic sensor: the speed the crew is doing is a
real measurement of that road, and it needs nobody's permission.

```
POST /api/v1/field/position
{ "latitude": 23.26, "longitude": 77.41, "speedMps": 4.2, "freeFlowSpeedMps": 11.1 }
```

The free-flow speed may come from the OSM `maxspeed` tag on that road, or
from TomTom. The reading lands in the cell that holds the crew, with the
same `delayMins` and `speedReductionPct` the traffic provider produces, so
it is scored the same way.

## Sources that were considered

- **Google Roads Management Insights.** Purpose-built for municipal road
  operators, about two minutes fresh, and the `duration_in_seconds` against
  `static_duration_in_seconds` pair is exactly the delay signal. Access is by
  request, and in India it is sold through an authorised reseller. The data
  is Google's own movement data, so it does not need the city's bus feed.
- **Mappls (MapmyIndia).** An Indian vendor with a government and smart
  city vertical, traffic flow and events in TMC and OpenLR, and data held in
  India.
- **Waze for Cities.** Free, and the feed refreshes every two minutes, but
  it is a two-way partnership with a municipal government.
- **Navitia.io and the MobilityDatabase catalog.** Worth searching for an
  existing feed for Indore or Bhopal; the cost of checking is a key.
