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

### How many probes

The free allowance is 2,500 non-tile requests a day, and each flow probe is
one request, so the budget is the design constraint.

| Setting | Default | Effect |
| --- | --- | --- |
| `TRAFFIC_POLL_MINUTES` | `30` | How often the traffic is re-read. The roads change far more slowly than the weather, and the score uses a 60-minute window with a 30-minute half-life, so half an hour is the natural cadence. |
| `TRAFFIC_PROBES_PER_CITY` | `20` | How many roads are measured per city per poll. The selection rotates, so every cell is covered over successive polls rather than the same handful every time. |

At the defaults, two cities use about 2,000 requests a day, which sits inside
the free allowance. Raising the probes goes onto the paid tier.

To cover every cell on every poll instead, use the **raster flow tiles**,
which put a whole area of congestion on one tile and come from a separate
allowance of 50,000 tiles a day.

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
