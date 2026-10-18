import base64
import csv
import io
import sys
import unittest
import zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_gtfs import build, seconds

def table(cols, values):
    output=io.StringIO()
    writer=csv.writer(output)
    writer.writerow(cols.split(','))
    writer.writerows(values)
    return output.getvalue()

def example():
    files={
      'routes.txt':table('route_id,route_short_name,route_type',[['R','TGV',2],['B','BUS',3]]),
      'trips.txt':table('route_id,service_id,trip_id,trip_headsign,trip_short_name',[
          ['R','daily','A','Paris','123'],['R','special','S','Paris','456'],['B','daily','BUS','Paris','789']]),
      'stops.txt':table('stop_id,stop_name,location_type,parent_station',[
          ['stationL','Lorient',1,''],['L','Lorient',0,'stationL'],
          ['stationP','Paris',1,''],['P','Paris',0,'stationP']]),
      'stop_times.txt':table('trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type',[
          ['A','08:00:00','08:00:00','L',1,0,1],['A','11:00:00','11:00:00','P',2,1,0],
          ['S','09:00:00','09:00:00','L',1,0,1],['S','12:00:00','12:00:00','P',2,1,0],
          ['BUS','10:00:00','10:00:00','L',1,0,1],['BUS','13:00:00','13:00:00','P',2,1,0]]),
      'calendar.txt':table('service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',[
          ['daily',1,1,1,1,1,1,1,20261124,20261126]]),
      'calendar_dates.txt':table('service_id,date,exception_type',[
          ['daily',20261125,2],['special',20261125,1]]),
    }
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:
        for name, contents in files.items(): archive.writestr(name, contents)
    output.seek(0)
    return zipfile.ZipFile(output)

class BuilderTests(unittest.TestCase):
    def test_after_midnight(self):
        self.assertEqual(seconds('25:15:20'), 90920)
    def test_real_csv_shapes(self):
        with example() as archive: data=build(archive)
        self.assertEqual(len(data['trips']),2)
        self.assertEqual(len(data['stations']),2)
        self.assertEqual(data['meta']['first'],'2026-11-24')
        self.assertEqual(data['meta']['last'],'2026-11-26')
        masks={t[3]:int.from_bytes(base64.b64decode(data['services'][t[0]]),'little') for t in data['trips']}
        self.assertEqual(masks['123'],0b101)
        self.assertEqual(masks['456'],0b010)

if __name__=='__main__': unittest.main()
