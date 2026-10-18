import io,zipfile,unittest
from build_mct import parse

class OfficialMCTTests(unittest.TestCase):
    def test_validates_train_pair_rules_without_guessing_generic_mode_codes(self):
        header='ARRIVAL_TRAIN;DEPARTURE_TRAIN;MIN_DELAY;ARRIVAL_STATION_UIC;DEPARTURE_STATION_UIC;START_DATE;END_DATE\n'
        rows=('101;202;-1;2222222;2222222;01/01/2026;31/12/2026\n'
              '101;303;60;22222220;22222220;01/01/2026;31/12/2026\n'
              'not-a-train;303;6;2222222;2222222;01/01/2026;31/12/2026\n')
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:
            z.writestr('Export_TRAIN_CONNECTION_TIMES.csv',header+rows)
        output.seek(0)
        with zipfile.ZipFile(output) as z: doc=parse(z)
        self.assertEqual(len(doc['trainRules']),2)
        self.assertEqual(doc['trainRules'][0][:5],['2222222','2222222','101','202',-1])
        self.assertEqual(doc['trainRules'][1][:5],['2222222','2222222','101','303',60])
        self.assertEqual(doc['meta']['skipped'],1)
    def test_fails_closed_on_changed_schema(self):
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:
            z.writestr('Export_TRAIN_CONNECTION_TIMES.csv','what;changed\n1;2\n')
        output.seek(0)
        with zipfile.ZipFile(output) as z, self.assertRaises(ValueError):parse(z)

if __name__=='__main__':unittest.main()
