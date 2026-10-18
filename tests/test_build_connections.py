import io
import zipfile
import unittest
from test_build import example
from build_gtfs import build


class GTFSConnectionMetadataTests(unittest.TestCase):
    def test_coordinates_timezone_and_forbidden_transfer_survive(self):
        with example() as original:
            content={name:original.read(name) for name in original.namelist()}
        content['agency.txt']=b'agency_id,agency_name,agency_url,agency_timezone\nA,Example,https://example.org,Europe/Paris\n'
        content['stops.txt']=(b'stop_id,stop_name,location_type,parent_station,stop_lat,stop_lon\n'
            b'stationL,Lorient,1,,47.755,-3.365\n'
            b'L,Lorient,0,stationL,47.754,-3.364\n'
            b'stationP,Paris,1,,48.84,2.32\n'
            b'P,Paris,0,stationP,48.841,2.321\n')
        content['transfers.txt']=(b'from_stop_id,to_stop_id,transfer_type,min_transfer_time\n'
            b'L,P,3,\n'
            b'P,L,2,3600\n')
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,'w') as archive:
            for name,payload in content.items():archive.writestr(name,payload)
        buffer.seek(0)
        with zipfile.ZipFile(buffer) as archive:data=build(archive)
        self.assertEqual(data['meta']['timezone'],'Europe/Paris')
        self.assertEqual(len(data['stations']),2)
        self.assertEqual(data['stations'][0][2:], [47.755,-3.365])
        self.assertEqual({(a,b,kind,sec) for a,b,kind,sec in data['transfers']},
            {(0,1,3,0),(1,0,2,3600)})

if __name__=='__main__': unittest.main()
