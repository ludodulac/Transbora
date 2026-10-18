#!/usr/bin/env python3
"""Prepare a searchable planned SNCF GTFS timetable for static GitHub Pages."""
import argparse
import base64
import csv
from datetime import datetime, date, timedelta, timezone
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen
import zipfile

URL = "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip"
WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")

def rows(z, name):
    matching = [path for path in z.namelist() if Path(path).name.lower() == name.lower()]
    if not matching:
        return
    with z.open(matching[0]) as file, io.TextIOWrapper(file, encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)

def day(text):
    return datetime.strptime(text, "%Y%m%d").date()

def seconds(text):
    h, m, s = map(int, text.split(":"))
    if h < 0 or not (0 <= m < 60 and 0 <= s < 60):
        raise ValueError(f"Invalid GTFS time: {text}")
    return h*3600+m*60+s

def build(z, mode='rail', provider='SNCF'):
    for info in z.infolist():
        if info.file_size > 600_000_000 or ".." in Path(info.filename).parts:
            raise ValueError("Invalid ZIP member")
    pairs = []
    info = list(rows(z, "feed_info.txt"))
    if info and info[0].get("feed_start_date") and info[0].get("feed_end_date"):
        pairs = [(day(info[0]["feed_start_date"]), day(info[0]["feed_end_date"]))]
    else:
        for item in rows(z, "calendar.txt"):
            pairs.append((day(item["start_date"]), day(item["end_date"])))
        dates = [day(item["date"]) for item in rows(z, "calendar_dates.txt")]
        if dates:
            pairs.append((min(dates), max(dates)))
    if not pairs:
        raise ValueError("GTFS has no calendar")
    first, last = min(x[0] for x in pairs), max(x[1] for x in pairs)
    span = (last-first).days+1
    if not 1 <= span <= 370:
        raise ValueError("Unexpected calendar coverage")

    routes = {}
    for item in rows(z, "routes.txt"):
        category = int(item.get("route_type") or -1)
        if ((mode == 'rail' and (category == 2 or 100 <= category <= 199))
                or (mode == 'bus' and (category == 3 or 700 <= category <= 799))):
            routes[item["route_id"]] = (item.get("route_short_name") or item.get("route_long_name") or "Train").strip()
    trips = {}
    for item in rows(z, "trips.txt"):
        if item["route_id"] in routes:
            trips[item["trip_id"]] = [item["service_id"], routes[item["route_id"]],
                item.get("trip_headsign", ""), item.get("trip_short_name", "")]
    if not trips:
        raise ValueError(f"No {mode} services found")
    def coords(item):
        try:
            lat = float(item.get("stop_lat", ""))
            lon = float(item.get("stop_lon", ""))
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return [round(lat, 6), round(lon, 6)]
        except (ValueError, TypeError):
            pass
        return [None, None]

    agency_zones = {r.get("agency_timezone", "").strip() for r in rows(z, "agency.txt")}
    agency_zones.discard("")
    agency_timezone = next(iter(agency_zones)) if len(agency_zones) == 1 else None

    stops = {}
    for item in rows(z, "stops.txt"):
        stops[item["stop_id"]] = [item.get("stop_name", "").strip(),
                                  item.get("parent_station", "").strip(), *coords(item)]

    masks = {value[0]: 0 for value in trips.values()}
    for item in rows(z, "calendar.txt"):
        sid = item["service_id"]
        if sid not in masks:
            continue
        current = max(first, day(item["start_date"]))
        end = min(last, day(item["end_date"]))
        while current <= end:
            if item.get(WEEKDAYS[current.weekday()]) == "1":
                masks[sid] |= 1 << (current-first).days
            current += timedelta(days=1)
    for item in rows(z, "calendar_dates.txt"):
        sid = item["service_id"]
        if sid not in masks:
            continue
        current = day(item["date"])
        if not first <= current <= last:
            continue
        flag = 1 << (current-first).days
        if item["exception_type"] == "1":
            masks[sid] |= flag
        elif item["exception_type"] == "2":
            masks[sid] &= ~flag

    events = {}
    for item in rows(z, "stop_times.txt"):
        tid = item["trip_id"]
        if tid not in trips or not item.get("arrival_time") or not item.get("departure_time"):
            continue
        sid = item["stop_id"]
        if sid not in stops:
            continue
        station = stops[sid][1] if stops[sid][1] in stops else sid
        events.setdefault(tid, []).append([
            int(item["stop_sequence"]), station, seconds(item["arrival_time"]),
            seconds(item["departure_time"]),
            int((item.get("pickup_type") or "0") == "0"),
            int((item.get("drop_off_type") or "0") == "0")
        ])
    active = []
    station_ids = set()
    for tid, items in events.items():
        if len(items) < 2 or not masks[trips[tid][0]]:
            continue
        items.sort(key=lambda x: x[0])
        if not any(x[4] for x in items[:-1]) or not any(x[5] for x in items[1:]):
            continue
        active.append((tid, items))
        station_ids.update(x[1] for x in items)
    if not active:
        raise ValueError(f"No active {mode} journeys")
    ordered = sorted(station_ids, key=lambda x: (stops.get(x, [x])[0].casefold(), x))
    station_index = {sid:i for i,sid in enumerate(ordered)}
    masks_used = sorted({masks[trips[tid][0]] for tid, _ in active})
    mask_index = {v:i for i,v in enumerate(masks_used)}
    encoded = [base64.b64encode(v.to_bytes((span+7)//8, "little")).decode("ascii") for v in masks_used]
    # Generic station-level GTFS transfer requirements. Do not apply trip/route-specific
    # conditions to all services. A prohibited transfer always takes precedence.
    transfer_rules = {}
    for item in rows(z, "transfers.txt"):
        if any(item.get(field) for field in ("from_trip_id", "to_trip_id", "from_route_id", "to_route_id")):
            continue
        raw_from, raw_to = item.get("from_stop_id", ""), item.get("to_stop_id", "")
        if raw_from not in stops or raw_to not in stops:
            continue
        from_station = stops[raw_from][1] if stops[raw_from][1] in stops else raw_from
        to_station = stops[raw_to][1] if stops[raw_to][1] in stops else raw_to
        if from_station not in station_index or to_station not in station_index:
            continue
        kind = str(item.get("transfer_type", "0"))
        if kind not in ("2", "3"):
            continue
        try:
            required = max(0, int(item.get("min_transfer_time") or "0")) if kind == "2" else 0
        except ValueError:
            continue
        pair = (station_index[from_station], station_index[to_station])
        previous = transfer_rules.get(pair, (0, 0))
        if kind == "3" or previous[0] == 3:
            transfer_rules[pair] = (3, 0)
        else:
            transfer_rules[pair] = (2, max(required, previous[1]))

    output = []
    for tid, items in active:
        sid, line, headsign, train_number = trips[tid]
        output.append([mask_index[masks[sid]], line, headsign, train_number,
            [[station_index[i[1]], *i[2:]] for i in items]])
    return {"meta": {"first":first.isoformat(), "last":last.isoformat(),
            "generated":datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": URL, "provider":provider, "mode":mode, "kind":"planned_only",
            "timezone": agency_timezone, "trains":len(output), "stations":len(ordered)},
            "stations":[[sid, stops.get(sid, [sid])[0] or sid, *stops.get(sid, ["", "", None, None])[2:4]] for sid in ordered],
            "services":encoded, "trips":output,
            "transfers":[[a,b,*rules] for (a,b),rules in transfer_rules.items()]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--url", default=URL)
    parser.add_argument("--mode", choices=["rail", "bus"], default="rail")
    parser.add_argument("--provider", default="SNCF")
    parser.add_argument("--output", type=Path, default=Path("site/data/trains.json"))
    args = parser.parse_args()
    if args.input:
        raw = args.input.read_bytes()
    else:
        request = Request(args.url, headers={"User-Agent":"Transbora/0.2"})
        with urlopen(request, timeout=75) as response:
            raw = response.read(60_000_001)
    if len(raw) > 60_000_000:
        raise ValueError("Source ZIP too large")
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        data = build(z, mode=args.mode, provider=args.provider)
    data['meta']['source'] = str(args.input) if args.input else args.url
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(data["meta"], "output_bytes", args.output.stat().st_size)

if __name__ == "__main__":
    main()
