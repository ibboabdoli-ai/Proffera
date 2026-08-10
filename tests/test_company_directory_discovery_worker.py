import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "company-directory-discovery.py"
SPEC = importlib.util.spec_from_file_location("company_directory_discovery", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CompanyDirectoryDiscoveryWorkerTests(unittest.TestCase):
    def test_accepts_only_official_bolagsverket_https_sources(self):
        self.assertTrue(MODULE.is_allowed_source_url("https://bolagsverket.se/example.zip"))
        self.assertTrue(MODULE.is_allowed_source_url("https://files.bolagsverket.se/example.zip"))
        self.assertFalse(MODULE.is_allowed_source_url("http://bolagsverket.se/example.zip"))
        self.assertFalse(MODULE.is_allowed_source_url("https://bolagsverket.se.evil.example/example.zip"))
        self.assertFalse(MODULE.is_allowed_source_url("https://example.com/example.zip"))

    def test_supported_sni_scope_is_explicit(self):
        for code in ["81210", "81221", "96910", "49420", "43210", "43221", "43341", "43320", "81300"]:
            self.assertTrue(MODULE.supported_sni(code), code)
        for code in ["62010", "68204", "46699"]:
            self.assertFalse(MODULE.supported_sni(code), code)

    def test_mapping_extracts_official_identity_sni_and_pilot_location(self):
        record = {
            "organisationsidentitet": {"identitetsbeteckning": "556123-4567"},
            "naringsgrenOrganisation": {"sni": [{"kod": "81210", "klartext": "Lokalvård"}]},
            "postadressOrganisation": {"postadress": {"postort": "SÖDERTÄLJE"}},
        }
        orgs, supported, pilot = MODULE.facts_from_mapping(record)
        self.assertEqual(orgs, {"5561234567"})
        self.assertTrue(supported)
        self.assertTrue(pilot)

    def test_csv_bulk_files_merge_sni_and_location_by_org_number(self):
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "official.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr(
                    "sni.csv",
                    "identitetsbeteckning;sniKod\n5561234567;81210\n5567654321;62010\n",
                )
                archive.writestr(
                    "address.csv",
                    "identitetsbeteckning;postort\n5561234567;Stockholm\n5567654321;Stockholm\n",
                )
            candidates, records_seen = MODULE.collect_candidates(archive_path)

        self.assertEqual(records_seen, 4)
        self.assertEqual(candidates, ["5561234567"])


if __name__ == "__main__":
    unittest.main()
