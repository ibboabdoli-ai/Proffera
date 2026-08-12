"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

type AddressSelection = {
  address: string;
  postcode: string;
};

type LookupAddress = AddressSelection & {
  uprn?: string;
};

type LookupResponse = {
  postcode?: string;
  addresses?: LookupAddress[];
  count?: number;
  error?: string;
  suggestions?: string[];
};

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function normalizePostcode(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return value.toUpperCase().trim();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function PrimeViewGoogleAddressAutocomplete({ onSelect }: { onSelect: (selection: AddressSelection) => void }) {
  const [postcode, setPostcode] = useState("");
  const [addresses, setAddresses] = useState<LookupAddress[]>([]);
  const [selectedIndex, setSelectedIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Enter your postcode above and we’ll show every matching address.");

  useEffect(() => {
    const postcodeInput = document.querySelector<HTMLInputElement>('input[name="postcode"]');
    if (!postcodeInput) return;

    const syncPostcode = () => {
      const nextPostcode = postcodeInput.value;
      setPostcode(nextPostcode);
      setSelectedIndex("");
      setAddresses([]);
      setLoading(false);
      if (!UK_POSTCODE.test(nextPostcode.trim())) {
        setMessage("Enter a complete UK postcode above. We’ll then show all matching addresses.");
      }
    };

    queueMicrotask(syncPostcode);
    postcodeInput.addEventListener("input", syncPostcode);
    return () => postcodeInput.removeEventListener("input", syncPostcode);
  }, []);

  useEffect(() => {
    const raw = postcode.trim();
    if (!UK_POSTCODE.test(raw)) return;

    const normalized = normalizePostcode(raw);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setMessage(`Finding addresses for ${normalized}…`);

      void fetch(`/api/primeview/address-lookup?postcode=${encodeURIComponent(normalized)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as LookupResponse;
          if (!response.ok) {
            if (response.status === 404 && data.suggestions?.length) {
              throw new Error(`Postcode not found. Did you mean ${data.suggestions.join(" or ")}?`);
            }
            throw new Error(data.error || "Address lookup is temporarily unavailable.");
          }

          const nextAddresses = Array.isArray(data.addresses) ? data.addresses : [];
          setAddresses(nextAddresses);
          setMessage(
            nextAddresses.length
              ? `${nextAddresses.length} address${nextAddresses.length === 1 ? "" : "es"} found for ${data.postcode ?? normalized}. Choose yours below.`
              : `No addresses were found for ${data.postcode ?? normalized}. You can enter the full address manually below.`,
          );
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setAddresses([]);
          setMessage(error instanceof Error ? error.message : "Address lookup is temporarily unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [postcode]);

  return (
    <div className="mt-3 min-w-0 max-w-full">
      {loading ? (
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-[#cbd8e6] bg-white px-4 py-3 text-sm font-semibold text-[#5f7690]">
          <Loader2 className="h-5 w-5 animate-spin text-[#1769c2]" />
          Looking up this postcode…
        </div>
      ) : addresses.length ? (
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#1769c2]" />
          <select
            aria-label={`Choose your address from ${addresses.length} results`}
            value={selectedIndex}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedIndex(value);
              if (!value) return;
              const selected = addresses[Number(value)];
              if (selected) onSelect(selected);
            }}
            className="min-h-12 w-full min-w-0 max-w-full appearance-none rounded-xl border border-[#cbd8e6] bg-white py-3 pl-12 pr-10 text-[16px] font-semibold text-[#0b2a4a] outline-none transition focus:border-[#2f80ed] focus:ring-4 focus:ring-[#2f80ed]/10"
          >
            <option value="">Choose your address</option>
            {addresses.map((item, index) => (
              <option key={`${item.uprn ?? item.address}-${index}`} value={String(index)}>
                {item.address}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <p className="mt-2 text-xs font-semibold leading-5 text-[#667b91]">{message}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#8a9aac]">Address data by Ideal Postcodes</p>
    </div>
  );
}
