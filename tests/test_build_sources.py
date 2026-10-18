import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from test_build import example
from build_sources import build_all, resolve

class MultiFeedTests(unittest.TestCase):
    def setUp(self):
        with example() as archive:
            self.payload = archive.fp.getvalue() if hasattr(archive.fp,"getvalue") else None
        # zipfile.ZipFile.close closes the underlying BytesIO: reconstruct from example per test below.

    def makezip(self):
        with example() as archive:
            return archive.fp.getvalue()

    def test_catalog_discovers_only_static_gtfs(self):
        source={"slug":"test-source"}
        metadata={"resources":[
            {"format":"gtfs-rt","title":"live","url":"https://example.org/live"},
            {"format":"gtfs","title":"Horaires théoriques","type":"main","url":"https://example.org/static.zip"}
        ]}
        with patch('build_sources.fetch',return_value=json.dumps(metadata).encode()):
            self.assertEqual(resolve(source),'https://example.org/static.zip')

    def test_aggregates_two_operators_independently(self):
        sources=(
            dict(id="rail",label="Train Test",mode="rail",license="test",page="https://example.org/rail",
                 url="https://example.org/rail.zip",required=True),
            dict(id="coach",label="Autocar Test",mode="bus",license="test",page="https://example.org/bus",
                 url="https://example.org/bus.zip")
        )
        with tempfile.TemporaryDirectory() as tmp:
            with patch('build_sources.SOURCES', sources),patch('build_sources.fetch',return_value=self.makezip()):
                result=build_all(Path(tmp))
            self.assertEqual(result['available'],2)
            self.assertEqual([s['mode'] for s in result['sources']],['rail','bus'])
            self.assertEqual(len(json.loads((Path(tmp)/'rail.json').read_text())['trips']),2)
            self.assertEqual(len(json.loads((Path(tmp)/'coach.json').read_text())['trips']),1)

    def test_failures_are_explicit(self):
        sources=(
            dict(id="rail",label="Train Test",mode="rail",license="test",page="https://example.org/rail",
                 url="https://example.org/rail.zip",required=True),
            dict(id="missing",label="Autocar absent",mode="bus",license="test",page="https://example.org/bus",
                 url="https://example.org/bus.zip")
        )
        def fake(url):
            if "bus.zip" in url:
                raise RuntimeError("offline")
            return self.makezip()
        with tempfile.TemporaryDirectory() as tmp:
            with patch('build_sources.SOURCES',sources),patch('build_sources.fetch',side_effect=fake):
                result=build_all(Path(tmp))
            self.assertEqual(result['available'],1)
            self.assertEqual(result['sources'][1]['status'],'unavailable')
            self.assertFalse((Path(tmp)/'missing.json').exists())

if __name__=='__main__':
    unittest.main()
