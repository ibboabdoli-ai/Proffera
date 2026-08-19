export type DirectoryDirectContact = {
  addressLine1: string;
  phone: string;
  email: string;
  website: string;
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
