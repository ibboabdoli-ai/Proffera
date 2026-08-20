export type DirectoryDirectContact = {
  addressLine1: string;
  phone: string;
  email: string;
  website: string;
};

export type DirectoryDirectContactDisclosure = DirectoryDirectContact & {
  entitled: boolean;
  available: Record<keyof DirectoryDirectContact, boolean>;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function gateDirectoryDirectContact(
  input: Partial<Record<keyof DirectoryDirectContact, unknown>>,
  entitled: boolean,
): DirectoryDirectContact {
  if (!entitled) {
    return {
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
    };
  }

  return {
    addressLine1: clean(input.addressLine1),
    phone: clean(input.phone),
    email: clean(input.email),
    website: clean(input.website),
  };
}

export function discloseDirectoryDirectContact(
  input: Partial<Record<keyof DirectoryDirectContact, unknown>>,
  entitled: boolean,
): DirectoryDirectContactDisclosure {
  const normalized: DirectoryDirectContact = {
    addressLine1: clean(input.addressLine1),
    phone: clean(input.phone),
    email: clean(input.email),
    website: clean(input.website),
  };
  const gated = gateDirectoryDirectContact(normalized, entitled);

  return {
    ...gated,
    entitled,
    available: {
      addressLine1: Boolean(normalized.addressLine1),
      phone: Boolean(normalized.phone),
      email: Boolean(normalized.email),
      website: Boolean(normalized.website),
    },
  };
}
