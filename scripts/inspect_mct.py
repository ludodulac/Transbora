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
