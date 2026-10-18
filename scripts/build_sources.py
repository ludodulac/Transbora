#!/usr/bin/env python3
"""Daily build of independently attributable SNCF, Trenitalia, Eurostar and coach feeds.

Optional providers may be unavailable; manifest always declares failures explicitly.
Run in GitHub Actions, never in browser. No API key or client secrets.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import urllib.parse
from urllib.request import Request, urlopen
import io
import zipfile

from build_gtfs import build, URL as SNCF_URL

# Public datasets verified on transport.data.gouv.fr, 2026-10-18.
SOURCES = (
    dict(id="sncf", label="SNCF Voyageurs", mode="rail", license="ODbL + conditions particulières",
         page="https://transport.data.gouv.fr/datasets/horaires-sncf", url=SNCF_URL, required=True),
    dict(id="trenitalia", label="Trenitalia France", mode="rail", license="Licence Ouverte 2.0",
         page="https://transport.data.gouv.fr/datasets/horaires-des-trains-trenitalia-france",
         slug="horaires-des-trains-trenitalia-france"),
    dict(id="eurostar", label="Eurostar", mode="rail", license="Licence Ouverte 2.0",
         page="https://transport.data.gouv.fr/datasets/eurostar-gtfs-plan-de-transport-et-temps-reel",
         slug="eurostar-gtfs-plan-de-transport-et-temps-reel"),
    dict(id="flixbus", label="FlixBus", mode="bus", license="ODbL + conditions particulières",
         page="https://transport.data.gouv.fr/datasets/flixbus-horaires-theoriques-du-reseau-europeen-1",
         slug="flixbus-horaires-theoriques-du-reseau-europeen-1"),
    dict(id="blablacar", label="BlaBlaCar Bus", mode="bus", license="ODbL + conditions particulières",
         page="https://transport.data.gouv.fr/datasets/blablacar-bus-horaires-theoriques-et-temps-reel-du-reseau-europeen",
         slug="blablacar-bus-horaires-theoriques-et-temps-reel-du-reseau-europeen"),
)
MAX_BYTES = 100_000_000

def fetch(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.hostname in {"localhost", "127.0.0.1"}:
        raise ValueError("Refusing non-public/non-HTTPS URL")
    with urlopen(Request(url, headers={"User-Agent":"Transbora/0.2 (public GTFS reuse)"}),timeout=90) as response:
        raw=response.read(MAX_BYTES+1)
    if len(raw)>MAX_BYTES:
        raise ValueError("GTFS download above safety limit")
    return raw

def resolve(source):
    if source.get("url"):
        return source["url"]
    slug=source["slug"]
    endpoint="https://www.data.gouv.fr/api/1/datasets/"+urllib.parse.quote(slug, safe="")+"/"
    payload=json.loads(fetch(endpoint))
    if not isinstance(payload,dict) or not isinstance(payload.get("resources"),list):
        raise ValueError("Dataset metadata invalid")
    choices=[r for r in payload["resources"]
             if str(r.get("format","")).strip().lower() in {"gtfs","zip"}
             and not any(word in (str(r.get("title",""))+" "+str(r.get("description",""))).lower()
                         for word in ("temps réel","temps reel","real-time","realtime","gtfs-rt","siri","protobuf"))
             and r.get("url") and r.get("type") not in {"api","documentation"}]
    if not choices:
        raise ValueError(f"No static GTFS resource for {slug}")
    # A dataset is expected to contain exactly one static GTFS.
    # Refuse ambiguity rather than silently choosing wrong train data.
    if len(choices)!=1:
        raise ValueError(f"Ambiguous static GTFS resources for {slug}: {len(choices)}")
    return choices[0].get("latest") or choices[0]["url"]

def build_all(destination, selected=None):
    destination.mkdir(parents=True,exist_ok=True)
    result={"generated":datetime.now(timezone.utc).isoformat(timespec="seconds"),"kind":"planned_only",
            "sources":[],"available":0}
    names=set()
    required_ok=False
    for source in SOURCES:
        if selected is not None and source["id"] not in selected:
            continue
        record={k:source[k] for k in ("id","label","mode","license","page")}
        try:
            url=resolve(source)
            raw=fetch(url)
            if not zipfile.is_zipfile(io.BytesIO(raw)):
                raise ValueError("Resource is not GTFS ZIP")
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                dataset=build(archive,mode=source["mode"],provider=source["label"])
            dataset["meta"]["source"]=url
            filename=source["id"]+".json"
            out=destination/filename
            out.write_text(json.dumps(dataset,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
            record.update(status="ok",file="data/"+filename,first=dataset["meta"]["first"],
                          last=dataset["meta"]["last"],trips=len(dataset["trips"]),
                          stations=len(dataset["stations"]))
            names.update(station[1] for station in dataset["stations"] if station[1])
            result["available"]+=1
            if source.get("required"):required_ok=True
            print(source["id"],"OK",record["trips"],"trips",out.stat().st_size,"bytes")
        except Exception as error:
            record.update(status="unavailable",message=str(error)[:180])
            print(source["id"],"UNAVAILABLE:",record["message"])
        result["sources"].append(record)
    if not required_ok and (selected is None or "sncf" in selected):
        raise RuntimeError("Required SNCF source unavailable; refusing to publish invalid timetable")
    (destination/"manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    (destination/"stations.json").write_text(json.dumps(sorted(names,key=str.casefold),ensure_ascii=False),encoding="utf-8")
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",type=Path,default=Path("site/data"))
    p.add_argument("--only",nargs="+",choices=[s["id"] for s in SOURCES])
    args=p.parse_args()
    result=build_all(args.output,set(args.only) if args.only else None)
    print(f"Ready: {result['available']}/{len(result['sources'])} sources; missing sources explicitly labelled.")

if __name__=="__main__":
    main()
