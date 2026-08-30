import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "company-directory-discovery.py"
SPEC = importlib.util.spec_from_file_location("company_directory_discovery", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CompanyDirectoryDiscoveryWorkerTests(unittest.TestCase):
    def test_accepts_only_official_bolagsverket_https_sources(self):
        self.assertTrue(MODULE.is_allowed_source_url("https://bolagsverket.se/example.zip"))
        self.assertTrue(MODULE.is_allowed_source_url("https://files.bolagsverket.se/example.zip"))
        scb_url = "https://vardefulla-datamangder.bolagsverket.se/scb/scb_bulkfil.zip"
        self.assertTrue(MODULE.is_allowed_source_url(scb_url))
        self.assertTrue(MODULE.is_allowed_scb_bulk_url(scb_url))
        self.assertFalse(MODULE.is_allowed_scb_bulk_url(
            "https://vardefulla-datamangder.bolagsverket.se/bolagsverket/bolagsverket_bulkfil.zip"
        ))
        self.assertFalse(MODULE.is_allowed_scb_bulk_url("https://bolagsverket.se/example.zip"))
        self.assertFalse(MODULE.is_allowed_source_url("http://bolagsverket.se/example.zip"))
        self.assertFalse(MODULE.is_allowed_source_url("https://bolagsverket.se.evil.example/example.zip"))
        self.assertFalse(MODULE.is_allowed_source_url("https://example.com/example.zip"))

    def test_current_official_bulk_source_is_used(self):
        expected = "https://vardefulla-datamangder.bolagsverket.se/scb/scb_bulkfil.zip"
        padded_override = f"  {expected}  "
        self.assertEqual(MODULE.DEFAULT_BULK_URL, expected)
        self.assertEqual(MODULE.resolve_bulk_url(), expected)
        self.assertEqual(MODULE.resolve_bulk_url(padded_override), expected)
        self.assertEqual(MODULE.DEFAULT_PROVIDER, "scb_hvd_bulk")
        with self.assertRaises(RuntimeError):
            MODULE.resolve_bulk_url("https://example.com/scb/scb_bulkfil.zip")

    def test_supported_sni_scope_is_explicit(self):
        for code in ["81210", "81221", "96910", "96210", "49420", "43210", "43221", "43341", "43320", "81300"]:
            self.assertTrue(MODULE.supported_sni(code), code)
        for code in ["81222", "62010", "68204", "46699"]:
            self.assertFalse(MODULE.supported_sni(code), code)
        self.assertEqual(MODULE.SCB_SNI_KEYS, {"ng1"})

    def test_nationwide_rollout_bucket_is_bounded(self):
        self.assertEqual(MODULE.resolve_nationwide_rollout(20, 17), (17, 20))
        with self.assertRaises(ValueError):
            MODULE.resolve_nationwide_rollout(0, 0)
        with self.assertRaises(ValueError):
            MODULE.resolve_nationwide_rollout(20, 20)

    def test_scb_legal_form_priority_is_explicit(self):
        self.assertEqual(MODULE.LEGAL_FORM_PRIORITY["49"], 0)
        self.assertEqual(MODULE.LEGAL_FORM_PRIORITY["31"], 1)
        self.assertEqual(MODULE.LEGAL_FORM_PRIORITY["51"], 2)
        self.assertEqual(MODULE.LEGAL_FORM_PRIORITY["61"], 3)
        self.assertEqual(MODULE.LEGAL_FORM_PRIORITY["96"], 4)
        self.assertEqual(MODULE.normalize_legal_form_code("49"), "49")
        self.assertEqual(MODULE.normalize_legal_form_code(" 096 "), "09")
        self.assertEqual(MODULE.normalize_legal_form_code(""), "")

    def test_scb_peorgnr_requires_country_prefix_and_returns_ten_digits(self):
        self.assertEqual(MODULE.normalize_scb_org("165561234567"), "5561234567")
        self.assertEqual(MODULE.normalize_scb_org("16-5561234567"), "5561234567")
        self.assertEqual(MODULE.normalize_scb_org("5561234567"), "")
        self.assertEqual(MODULE.normalize_scb_org("175561234567"), "")

    def test_mapping_extracts_official_identity_sni_pilot_location_and_form(self):
        record = {
            "organisationsidentitet": {"identitetsbeteckning": "556123-4567"},
            "naringsgrenOrganisation": {"sni": [{"kod": "81210", "klartext": "Lokalvård"}]},
            "postadressOrganisation": {"postadress": {"postort": "SÖDERTÄLJE"}},
            "JurForm": "49",
        }
        orgs, primary_sni_codes, pilot, legal_form_priority = MODULE.facts_from_mapping(record)
        self.assertEqual(orgs, {"5561234567"})
        self.assertEqual(primary_sni_codes, {"81210"})
        self.assertTrue(pilot)
        self.assertEqual(legal_form_priority, 0)

    def test_mapping_extracts_real_scb_bulk_fields(self):
        record = {
            "PeOrgNr": "165561234567",
            "Ng1": "81210",
            "Ng2": "",
            "Ng3": "",
            "Ng4": "",
            "Ng5": "",
            "PostOrt": "STOCKHOLM",
            "JurForm": "49",
        }
        orgs, primary_sni_codes, pilot, legal_form_priority = MODULE.facts_from_mapping(record)
        self.assertEqual(orgs, {"5561234567"})
        self.assertEqual(primary_sni_codes, {"81210"})
        self.assertTrue(pilot)
        self.assertEqual(legal_form_priority, 0)

    def test_real_scb_latin1_tsv_keeps_sodertalje_location(self):
        header = "PeOrgNr\tNg1\tNg2\tNg3\tNg4\tNg5\tPostOrt\tJurForm\n"
        row = "165569672982\t43210\t\t\t\t\tSÖDERTÄLJE\t49\n"
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "scb.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("scb_bulkfil.txt", (header + row).encode("iso-8859-1"))
            candidates, records_seen = MODULE.collect_candidates(archive_path)

        self.assertEqual(records_seen, 1)
        self.assertEqual(candidates, [
            {"organizationNumber": "5569672982", "primarySniCode": "43210"},
        ])

    def test_hairdresser_sni_is_discoverable_in_always_on_pilot(self):
        header = "PeOrgNr\tNg1\tPostOrt\tJurForm\n"
        row = "165561234567\t96210\tSÖDERTÄLJE\t49\n"
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "scb.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("scb_bulkfil.txt", (header + row).encode("iso-8859-1"))
            candidates, records_seen = MODULE.collect_candidates(archive_path)

        self.assertEqual(records_seen, 1)
        self.assertEqual(candidates, [
            {"organizationNumber": "5561234567", "primarySniCode": "96210"},
        ])

    def test_scb_secondary_sni_does_not_make_company_discoverable(self):
        record = {
            "PeOrgNr": "165561234567",
            "Ng1": "52219",
            "Ng2": "81210",
            "Ng3": "",
            "Ng4": "",
            "Ng5": "",
            "PostOrt": "STOCKHOLM",
            "JurForm": "49",
        }
        orgs, primary_sni_codes, pilot, legal_form_priority = MODULE.facts_from_mapping(record)
        self.assertEqual(orgs, {"5561234567"})
        self.assertEqual(primary_sni_codes, {"52219"})
        self.assertTrue(pilot)
        self.assertEqual(legal_form_priority, 0)

    def test_real_scb_tsv_bulk_filters_and_prioritizes_supported_company_forms(self):
        header = "PeOrgNr\tNg1\tNg2\tNg3\tNg4\tNg5\tPostOrt\tJurForm\n"
        rows = (
            "165169999999\t81210\t\t\t\t\tStockholm\t96\n"
            "165569999998\t81210\t\t\t\t\tStockholm\t49\n"
            "165561222222\t52219\t81210\t\t\t\tStockholm\t49\n"
            "165561333333\t81222\t\t\t\t\tStockholm\t49\n"
            "165561111111\t81210\t\t\t\t\tStockholm\t99\n"
            "165567654321\t62010\t\t\t\t\tStockholm\t49\n"
            "165569999997\t81210\t\t\t\t\tUppsala\t49\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "scb.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("scb_bulkfil.txt", header + rows)
            candidates, records_seen = MODULE.collect_candidates(archive_path)

        self.assertEqual(records_seen, 7)
        self.assertEqual(candidates, [
            {"organizationNumber": "5569999998", "primarySniCode": "81210"},
            {"organizationNumber": "5169999999", "primarySniCode": "81210"},
        ])

    def test_nationwide_rollout_adds_only_the_selected_outside_pilot_bucket(self):
        header = "PeOrgNr\tNg1\tPostOrt\tJurForm\n"
        rows = (
            "165569999997\t81210\tUppsala\t49\n"
            "165561234567\t96210\tGöteborg\t49\n"
            "165569999998\t81210\tStockholm\t49\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "scb.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("scb_bulkfil.txt", header + rows)
            candidates, records_seen = MODULE.collect_candidates(
                archive_path,
                nationwide_bucket=17,
                nationwide_bucket_count=20,
            )

        self.assertEqual(records_seen, 3)
        self.assertEqual(candidates, [
            {"organizationNumber": "5569999997", "primarySniCode": "81210"},
            {"organizationNumber": "5569999998", "primarySniCode": "81210"},
        ])

    def test_csv_bulk_files_merge_sni_location_and_legal_form_by_org_number(self):
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
                archive.writestr(
                    "legal.csv",
                    "identitetsbeteckning;JurForm\n5561234567;49\n5567654321;49\n",
                )
            candidates, records_seen = MODULE.collect_candidates(archive_path)

        self.assertEqual(records_seen, 6)
        self.assertEqual(candidates, [
            {"organizationNumber": "5561234567", "primarySniCode": "81210"},
        ])

    def test_conflicting_primary_sni_rows_are_not_enqueued(self):
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "official.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr(
                    "scb_bulkfil.txt",
                    "PeOrgNr\tNg1\tPostOrt\tJurForm\n"
                    "165561234567\t81210\tStockholm\t49\n"
                    "165561234567\t43210\tStockholm\t49\n",
                )
            candidates, records_seen = MODULE.collect_candidates(archive_path)

        self.assertEqual(records_seen, 2)
        self.assertEqual(candidates, [])

    def test_ingest_payload_carries_structured_primary_sni_and_rolling_compatibility_ids(self):
        candidates = [{"organizationNumber": "5561234567", "primarySniCode": "81210"}]
        with patch.object(MODULE, "api_request", return_value={"ok": True}) as request:
            MODULE.post_candidates(
                "https://example.invalid/ingest",
                "secret",
                "https://vardefulla-datamangder.bolagsverket.se/scb/scb_bulkfil.zip",
                "a" * 64,
                candidates,
                1,
            )

        payload = request.call_args.args[3]
        self.assertEqual(payload["candidates"], candidates)
        self.assertEqual(payload["organizationNumbers"], ["5561234567"])


if __name__ == "__main__":
    unittest.main()
