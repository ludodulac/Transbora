#!/usr/bin/env python3
"""Validate SNCF PRR minimum transfer rules; conservatively use train-specific rules.

The 227k generic records have arrival/departure mode and RICS qualifiers that
are NOT equivalent to a GTFS route_type. We intentionally do not silently map
those qualifiers. A restrictive train-pair override may be applied only when
train numbers and both UIC station codes match exactly.
"""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import io
import json
from pathlib import Path
from urllib.request import urlopen, Request
import zipfile

URL="https://eu.ftp.opendatasoft.com/sncf/prr/temps_correspondance/INFOTRAINS_Export_IDH.zip"
REQUIRED={"ARRIVAL_TRAIN","DEPARTURE_TRAIN","ARRIVAL_STATION_UIC","DEPARTURE_STATION_UIC","MIN_DELAY","START_DATE","END_DATE"}

def parse(z, today=None):
    filename=next((n for n in z.namelist() if Path(n).name.upper()=="EXPORT_TRAIN_CONNECTION_TIMES.CSV"),None)
    if not filename:
        raise ValueError("Missing Export_TRAIN_CONNECTION_TIMES.csv")
    with z.open(filename) as raw,io.TextIOWrapper(raw,encoding="utf-8-sig",newline="") as fp:
        table=csv.DictReader(fp,delimiter=";")
        if not REQUIRED.issubset(table.fieldnames or []):
            raise ValueError("SNCF train-specific table schema changed")
        records=[];skipped=0
        for row in table:
            try:
                stationA=row["ARRIVAL_STATION_UIC"].strip()
                stationB=row["DEPARTURE_STATION_UIC"].strip()
                trainA=row["ARRIVAL_TRAIN"].strip()
                trainB=row["DEPARTURE_TRAIN"].strip()
                if not(all(v.isdigit() for v in (stationA,stationB,trainA,trainB)) and 6<=len(stationA)<=8 and 6<=len(stationB)<=8):
                    raise ValueError("not a specified train/station")
                limit=int(row["MIN_DELAY"])
                if limit<-1 or limit>720:raise ValueError("invalid delay")
                first=datetime.strptime(row["START_DATE"],"%d/%m/%Y").date()
                last=datetime.strptime(row["END_DATE"],"%d/%m/%Y").date()
                if last<first:raise ValueError("bad dates")
                # Official UIC codes in this file commonly have 7 digits;
                # match to the 7-digit UIC base only after both station IDs
                # come from SNCF StopArea:OCE<8 digits>, never by station names.
                a=stationA[:7] if len(stationA)>=7 else stationA
                b=stationB[:7] if len(stationB)>=7 else stationB
                if len(a)!=7 or len(b)!=7:raise ValueError("unusable UIC")
                records.append([a,b,trainA,trainB,limit,first.isoformat(),last.isoformat()])
            except (ValueError,TypeError,KeyError):
                skipped+=1
    if not records:
        raise ValueError("No usable official train pair rules")
    return {"meta":{"source":URL,"generated":datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "kind":"sncf_prr_train_specific","records":len(records),"skipped":skipped,
             "important":"Not a guarantee of protected through-ticket eligibility. Generic mode/RICS rules not mapped."},
             "trainRules":records}

def build(dest):
    with urlopen(Request(URL,headers={"User-Agent":"Transbora/0.4"}),timeout=90) as response:
        raw=response.read(25_000_001)
    if len(raw)>25_000_000:raise ValueError("Official PRR archive too large")
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        data=parse(z)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("Official SNCF train-specific rules:",len(data["trainRules"]),"; excluded:",data["meta"]["skipped"])

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--output",type=Path,default=Path("site/data/mct.json"))
    p.add_argument("--allow-unavailable",action="store_true")
    args=p.parse_args()
    try:
        build(args.output)
    except Exception as e:
        if not args.allow_unavailable:
            raise
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps({"meta":{"status":"unavailable","source":URL,
          "message":str(e)[:200]},"trainRules":[]},ensure_ascii=False),encoding="utf-8")
        print("SNCF official MCT source unavailable:",str(e)[:200])
