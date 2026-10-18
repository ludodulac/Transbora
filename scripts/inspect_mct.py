"""Read and report only schema of SNCF PRR connection time files (no production use)."""
import zipfile, io, urllib.request
URL="https://eu.ftp.opendatasoft.com/sncf/prr/temps_correspondance/INFOTRAINS_Export_IDH.zip"
with urllib.request.urlopen(urllib.request.Request(URL,headers={'User-Agent':'Transbora/1.0'}),timeout=60) as r:
    payload=r.read(25_000_001)
if len(payload)>25_000_000:
    raise ValueError("Data above inspection limit")
with zipfile.ZipFile(io.BytesIO(payload)) as z:
    for entry in z.infolist():
        if entry.is_dir():continue
        print("FILE",repr(entry.filename),"BYTES",entry.file_size)
        if entry.filename.lower().endswith(('.csv','.txt')):
            data=z.read(entry)[:4000].decode('utf-8-sig',errors='replace').splitlines()
            for i,line in enumerate(data[:3]):print(" SAMPLE",i,repr(line[:1200]))

from collections import Counter
import csv,re
with zipfile.ZipFile(io.BytesIO(payload)) as z:
    for name in z.namelist():
        if not name.endswith('.csv'):continue
        with z.open(name) as fp:
            records=list(csv.DictReader(io.TextIOWrapper(fp,encoding='utf-8-sig'),delimiter=';'))
        print('ROWCOUNT',name,len(records))
        for column in records[0] if records else []:
            if column in ('ARRIVAL_MODE','DEPARTURE_MODE','ARRIVAL_CONNECTION_TYPE','DEPARTURE_CONNECTION_TYPE','TYPE'):
                print('VALUES',column,Counter(r[column] for r in records).most_common(12))
        print('FULLSAMPLES',name,records[:3])
sncf_url="https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip"
with urllib.request.urlopen(sncf_url,timeout=60) as r:
    blob=r.read(60_000_001)
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    sample=z.read(next(n for n in z.namelist() if n.endswith('stops.txt'))).decode('utf-8-sig').splitlines()[:12]
    print('SNCF STOPS SAMPLES',sample)
