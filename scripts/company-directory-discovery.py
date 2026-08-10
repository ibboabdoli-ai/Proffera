#!/usr/bin/env python3
"""Discover Proffera service companies from official Bolagsverket/SCB HVD bulk data.

The worker is intentionally fail-closed:
- the final downloadable source must be the official SCB HVD ZIP on bolagsverket.se;
- discovery uses the official SCB bulk because SNI, JurForm and PostOrt are SCB fields;
- organisation numbers are only extracted from the official bulk payload;
- only Stockholm/Södertälje + supported primary service SNI + supported registered organisation forms are enqueued;
- common Swedish company forms are prioritised before foreign branches;
- raw bulk records are never posted to Proffera or persisted by this script;
- large ZIP downloads use verified HTTP Range segments to prevent silent truncation.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any, Iterator

DATASET_ID = "https-metadata-bolagsverket-se-store-2-resource-76"
DATASET_API = f"https://data.europa.eu/api/hub/search/datasets/{DATASET_ID}"
DEFAULT_PROVIDER = "scb_hvd_bulk"
ALLOWED_HOST = "bolagsverket.se"
MAX_DOWNLOAD_BYTES = 6 * 1024 * 1024 * 1024
RANGE_SEGMENT_BYTES = 8 * 1024 * 1024
RANGE_RETRIES = 4
POST_BATCH_SIZE = 400

ORG_KEYS = {
    "identitetsbeteckning",
    "organisationsnummer",
    "organizationnumber",
    "organisationnumber",
    "orgnumber",
}
SCB_ORG_KEYS = {"peorgnr"}
# SCB documents Ng1 as huvudnäringsgren; Ng2-Ng5 are secondary activities.
# Automatic directory discovery deliberately keys only on the primary activity.
SCB_SNI_KEYS = {"ng1"}
SCB_LEGAL_FORM_KEYS = {"jurform"}
SNI_KEY_MARKERS = ("sni", "naringsgren", "näringsgren")
LOCATION_KEY_MARKERS = (
    "postort",
    "city",
    "municipality",
    "kommun",
    "ort",
    "addresslocality",
)
PILOT_LOCATIONS = {"stockholm", "sodertalje", "södertälje"}

# Official SCB JurForm values used by the first directory rollout.
# 49: Övriga aktiebolag, 31: Handelsbolag/kommanditbolag,
# 51: Ekonomiska föreningar, 61: Ideella föreningar,
# 96: Utländska juridiska personer (including registered branches).
LEGAL_FORM_PRIORITY = {
    "49": 0,
    "31": 1,
    "51": 2,
    "61": 3,
    "96": 4,
}
UNKNOWN_LEGAL_FORM_PRIORITY = 99


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9åäö]", "", value.strip().lower())


def normalize_org(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits if len(digits) == 10 else ""


def normalize_scb_org(value: Any) -> str:
    """SCB PeOrgNr is represented as country prefix 16 + 10-digit Swedish org number."""
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) != 12 or not digits.startswith("16"):
        return ""
    organization_number = digits[2:]
    return organization_number if len(organization_number) == 10 else ""


def normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def normalize_sni(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[:5] if len(digits) >= 4 else ""


def normalize_legal_form_code(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[:2] if len(digits) >= 2 else ""


def supported_sni(value: Any) -> bool:
    digits = normalize_sni(value)
    return (
        digits == "81210"
        or digits == "81221"
        or digits == "96910"
        or digits == "49420"
        or digits == "43210"
        or digits.startswith("4322")
        or digits == "43341"
        or digits == "43320"
        or digits == "81300"
    )


def pilot_location(value: Any) -> bool:
    normalized = normalize_text(value)
    folded = normalized.replace("ö", "o")
    return normalized in PILOT_LOCATIONS or folded in PILOT_LOCATIONS


def is_allowed_source_url(raw: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(raw)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (host == ALLOWED_HOST or host.endswith(f".{ALLOWED_HOST}"))


def is_allowed_scb_bulk_url(raw: str) -> bool:
    if not is_allowed_source_url(raw):
        return False
    try:
        path = urllib.parse.urlparse(raw).path.lower()
    except ValueError:
        return False
    return path.endswith("/scb/scb_bulkfil.zip")


def request_json(url: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "proffera-company-directory-discovery/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def find_urls(value: Any, key_hint: str = "") -> Iterator[str]:
    if isinstance(value, dict):
        for key, nested in value.items():
            yield from find_urls(nested, str(key))
    elif isinstance(value, list):
        for nested in value:
            yield from find_urls(nested, key_hint)
    elif isinstance(value, str) and ("url" in key_hint.lower() or value.startswith("https://")):
        if value.startswith("https://"):
            yield value


def resolve_bulk_url(override: str = "") -> str:
    if override:
        if not is_allowed_scb_bulk_url(override):
            raise RuntimeError("BOLAGSVERKET_BULK_URL must be the official Bolagsverket SCB HVD ZIP URL")
        return override

    payload = request_json(DATASET_API)
    result = payload.get("result", payload) if isinstance(payload, dict) else payload
    urls = list(dict.fromkeys(find_urls(result)))
    candidates = [url for url in urls if is_allowed_scb_bulk_url(url)]

    if candidates:
        return candidates[0]

    raise RuntimeError("No official SCB HVD ZIP URL was found in current data.europa.eu metadata")


def _official_head(url: str) -> tuple[str, int]:
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": "proffera-company-directory-discovery/1.0"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        final_url = response.geturl()
        if not is_allowed_scb_bulk_url(final_url):
            raise RuntimeError("Official bulk HEAD redirected away from the official SCB HVD ZIP")
        content_length = int(response.headers.get("Content-Length") or "0")
        content_type = (response.headers.get("Content-Type") or "").lower()
        if content_length <= 0 or content_length > MAX_DOWNLOAD_BYTES:
            raise RuntimeError(f"Official bulk file has unsafe Content-Length: {content_length}")
        if "zip" not in content_type:
            raise RuntimeError("Official bulk source is not advertised as a ZIP archive")
        return final_url, content_length


def _download_range(url: str, start: int, end: int) -> bytes:
    expected = end - start + 1
    last_error: Exception | None = None
    for _attempt in range(1, RANGE_RETRIES + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "proffera-company-directory-discovery/1.0",
                    "Range": f"bytes={start}-{end}",
                },
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                if response.status != 206:
                    raise RuntimeError(f"Official bulk range request returned HTTP {response.status}, expected 206")
                final_url = response.geturl()
                if not is_allowed_scb_bulk_url(final_url):
                    raise RuntimeError("Official bulk range request redirected away from the official SCB HVD ZIP")
                payload = response.read()
            if len(payload) != expected:
                raise RuntimeError(
                    f"Official bulk range {start}-{end} was truncated: {len(payload)} of {expected} bytes"
                )
            return payload
        except Exception as error:  # noqa: BLE001 - bounded retry then fail closed
            last_error = error
    raise RuntimeError(f"Official bulk range {start}-{end} failed after retries: {last_error}")


def download_to_temp(url: str) -> tuple[Path, str]:
    if not is_allowed_scb_bulk_url(url):
        raise RuntimeError("Refusing to download anything except the official SCB HVD ZIP")

    final_url, total_size = _official_head(url)
    fd, path_string = tempfile.mkstemp(prefix="proffera-official-hvd-", suffix=".zip")
    os.close(fd)
    path = Path(path_string)
    digest = hashlib.sha256()

    try:
        with path.open("wb") as output:
            for start in range(0, total_size, RANGE_SEGMENT_BYTES):
                end = min(total_size - 1, start + RANGE_SEGMENT_BYTES - 1)
                chunk = _download_range(final_url, start, end)
                output.write(chunk)
                digest.update(chunk)

        if path.stat().st_size != total_size:
            raise RuntimeError("Official bulk segmented download size did not match Content-Length")
        if not zipfile.is_zipfile(path):
            raise RuntimeError("Official bulk distribution was not a valid ZIP archive")
        return path, digest.hexdigest()
    except Exception:
        path.unlink(missing_ok=True)
        raise


def scalar_values(value: Any) -> Iterator[str]:
    if value is None:
        return
    if isinstance(value, (str, int, float, bool)):
        yield str(value)
    elif isinstance(value, dict):
        for nested in value.values():
            yield from scalar_values(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from scalar_values(nested)


def facts_from_mapping(record: dict[str, Any]) -> tuple[set[str], bool, bool, int]:
    orgs: set[str] = set()
    has_supported_sni = False
    has_pilot_location = False
    legal_form_priority = UNKNOWN_LEGAL_FORM_PRIORITY

    def walk(value: Any, parent_key: str = "", depth: int = 0) -> None:
        nonlocal has_supported_sni, has_pilot_location, legal_form_priority
        if depth > 10:
            return
        if isinstance(value, dict):
            for key, nested in value.items():
                normalized_key = normalize_key(str(key))
                if normalized_key in ORG_KEYS:
                    for scalar in scalar_values(nested):
                        org = normalize_org(scalar)
                        if org:
                            orgs.add(org)
                elif normalized_key in SCB_ORG_KEYS:
                    for scalar in scalar_values(nested):
                        org = normalize_scb_org(scalar)
                        if org:
                            orgs.add(org)

                if normalized_key in SCB_SNI_KEYS or any(marker in normalized_key for marker in SNI_KEY_MARKERS):
                    if any(supported_sni(scalar) for scalar in scalar_values(nested)):
                        has_supported_sni = True
                if normalized_key in SCB_LEGAL_FORM_KEYS:
                    for scalar in scalar_values(nested):
                        code = normalize_legal_form_code(scalar)
                        legal_form_priority = min(
                            legal_form_priority,
                            LEGAL_FORM_PRIORITY.get(code, UNKNOWN_LEGAL_FORM_PRIORITY),
                        )
                if any(marker in normalized_key for marker in LOCATION_KEY_MARKERS):
                    if any(pilot_location(scalar) for scalar in scalar_values(nested)):
                        has_pilot_location = True
                walk(nested, normalized_key, depth + 1)
        elif isinstance(value, list):
            for nested in value:
                walk(nested, parent_key, depth + 1)

    walk(record)
    return orgs, has_supported_sni, has_pilot_location, legal_form_priority


def iter_json_records(stream: io.BufferedReader, name: str) -> Iterator[dict[str, Any]]:
    lower = name.lower()
    if lower.endswith((".jsonl", ".ndjson")):
        for raw in io.TextIOWrapper(stream, encoding="utf-8-sig", errors="replace"):
            raw = raw.strip()
            if not raw:
                continue
            value = json.loads(raw)
            if isinstance(value, dict):
                yield value
        return

    try:
        import ijson  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Plain JSON bulk files require the ijson package") from exc

    for prefix in ("item", "items.item", "data.item", "organisationer.item", "organizations.item"):
        stream.seek(0)
        found = False
        for value in ijson.items(stream, prefix):
            if isinstance(value, dict):
                found = True
                yield value
        if found:
            return

    raise RuntimeError("Unsupported plain JSON structure in official bulk file")


def sniff_csv_dialect(sample: str) -> csv.Dialect:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        return csv.excel


def iter_csv_records(stream: io.BufferedReader) -> Iterator[dict[str, Any]]:
    text = io.TextIOWrapper(stream, encoding="utf-8-sig", errors="replace", newline="")
    sample = text.read(8192)
    text.seek(0)
    reader = csv.DictReader(text, dialect=sniff_csv_dialect(sample))
    for row in reader:
        yield {str(key): value for key, value in row.items() if key is not None}


def element_to_mapping(element: ET.Element) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for child in list(element):
        key = child.tag.rsplit("}", 1)[-1]
        value: Any = element_to_mapping(child) if list(child) else (child.text or "")
        if key in result:
            current = result[key]
            result[key] = current + [value] if isinstance(current, list) else [current, value]
        else:
            result[key] = value
    return result


def iter_xml_records(stream: io.BufferedReader) -> Iterator[dict[str, Any]]:
    for _event, element in ET.iterparse(stream, events=("end",)):
        mapping = element_to_mapping(element)
        orgs, _sni, _location, _legal_form_priority = facts_from_mapping(mapping)
        if orgs:
            yield mapping
            element.clear()


def iter_zip_members(path: Path) -> Iterator[tuple[str, bytes | zipfile.ZipExtFile]]:
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = info.filename.lower()
            if name.endswith(".zip"):
                nested_bytes = archive.read(info)
                with zipfile.ZipFile(io.BytesIO(nested_bytes)) as nested:
                    for nested_info in nested.infolist():
                        if not nested_info.is_dir():
                            yield nested_info.filename, nested.read(nested_info)
            else:
                yield info.filename, archive.open(info)


def iter_member_records(name: str, source: bytes | zipfile.ZipExtFile) -> Iterator[dict[str, Any]]:
    stream: io.BufferedReader
    if isinstance(source, bytes):
        stream = io.BufferedReader(io.BytesIO(source))
    else:
        stream = io.BufferedReader(source)

    lower = name.lower()
    if lower.endswith((".json", ".jsonl", ".ndjson")):
        yield from iter_json_records(stream, name)
    elif lower.endswith((".csv", ".tsv", ".txt")):
        yield from iter_csv_records(stream)
    elif lower.endswith(".xml"):
        yield from iter_xml_records(stream)


def open_state_db() -> tuple[sqlite3.Connection, Path]:
    fd, path_string = tempfile.mkstemp(prefix="proffera-discovery-", suffix=".sqlite3")
    os.close(fd)
    path = Path(path_string)
    connection = sqlite3.connect(path)
    connection.execute(
        """
        create table candidate_facts (
          organization_number text primary key,
          supported_sni integer not null default 0,
          pilot_location integer not null default 0,
          legal_form_priority integer not null default 99
        )
        """
    )
    return connection, path


def collect_candidates(path: Path) -> tuple[list[str], int]:
    database, database_path = open_state_db()
    records_seen = 0
    recognized_members = 0
    try:
        for name, source in iter_zip_members(path):
            lower = name.lower()
            if not lower.endswith((".json", ".jsonl", ".ndjson", ".csv", ".tsv", ".txt", ".xml")):
                continue
            recognized_members += 1
            for record in iter_member_records(name, source):
                records_seen += 1
                orgs, has_sni, has_location, legal_form_priority = facts_from_mapping(record)
                if not orgs:
                    continue
                for org in orgs:
                    database.execute(
                        """
                        insert into candidate_facts (organization_number, supported_sni, pilot_location, legal_form_priority)
                        values (?, ?, ?, ?)
                        on conflict(organization_number) do update set
                          supported_sni = max(candidate_facts.supported_sni, excluded.supported_sni),
                          pilot_location = max(candidate_facts.pilot_location, excluded.pilot_location),
                          legal_form_priority = min(candidate_facts.legal_form_priority, excluded.legal_form_priority)
                        """,
                        (org, int(has_sni), int(has_location), legal_form_priority),
                    )
                if records_seen % 5000 == 0:
                    database.commit()
        database.commit()
        if recognized_members == 0:
            raise RuntimeError("The official ZIP contained no supported machine-readable files")
        rows = database.execute(
            """
            select organization_number
            from candidate_facts
            where supported_sni = 1
              and pilot_location = 1
              and legal_form_priority < ?
            order by legal_form_priority asc, organization_number asc
            """,
            (UNKNOWN_LEGAL_FORM_PRIORITY,),
        ).fetchall()
        return [str(row[0]) for row in rows], records_seen
    finally:
        database.close()
        database_path.unlink(missing_ok=True)


def api_request(url: str, secret: str, method: str = "GET", payload: Any = None) -> Any:
    data = None
    headers = {
        "Authorization": f"Bearer {secret}",
        "Accept": "application/json",
        "User-Agent": "proffera-company-directory-discovery/1.0",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def post_candidates(
    ingest_url: str,
    secret: str,
    source_url: str,
    fingerprint: str,
    candidates: list[str],
    discovered_count: int,
) -> None:
    chunks = [candidates[index:index + POST_BATCH_SIZE] for index in range(0, len(candidates), POST_BATCH_SIZE)]
    if not chunks:
        chunks = [[]]
    for index, chunk in enumerate(chunks):
        payload = {
            "provider": DEFAULT_PROVIDER,
            "sourceUrl": source_url,
            "fingerprint": fingerprint,
            "organizationNumbers": chunk,
            "discoveredCount": discovered_count,
            "acceptedCount": len(candidates),
            "final": index == len(chunks) - 1,
        }
        result = api_request(ingest_url, secret, "POST", payload)
        if not result.get("ok"):
            raise RuntimeError(f"Discovery ingest rejected batch {index + 1}: {result}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ingest-url", required=True)
    parser.add_argument("--secret", required=True)
    parser.add_argument("--bulk-url", default=os.environ.get("BOLAGSVERKET_BULK_URL", ""))
    args = parser.parse_args()

    probe = api_request(args.ingest_url, args.secret)
    if not probe.get("enabled"):
        print("Automatic company discovery is disabled; exiting before bulk download.")
        return 0

    source_url = resolve_bulk_url(args.bulk_url)
    archive_path, fingerprint = download_to_temp(source_url)
    try:
        candidates, records_seen = collect_candidates(archive_path)
    finally:
        archive_path.unlink(missing_ok=True)

    print(f"Official SCB records scanned: {records_seen}")
    print(f"Pilot + primary-supported-SNI + supported-form candidates: {len(candidates)}")
    post_candidates(args.ingest_url, args.secret, source_url, fingerprint, candidates, records_seen)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")[:1000]
        print(f"HTTP {error.code}: {body}", file=sys.stderr)
        raise