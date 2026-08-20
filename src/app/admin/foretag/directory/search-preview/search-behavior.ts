type PositionLike = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type MutableLocationField = {
  value: string;
};

export function applyAdminCurrentPosition(
  position: PositionLike,
  manualLocationField: MutableLocationField | null,
) {
  if (manualLocationField) {
    manualLocationField.value = "";
  }

  return {
    latitude: position.coords.latitude.toFixed(6),
    longitude: position.coords.longitude.toFixed(6),
    status: "Position hämtad. Platsfältet är rensat. Tryck Sök.",
  };
}

export function resolveAdminDirectorySearchMode({
  location,
  latitude,
  longitude,
}: {
  location?: string;
  latitude?: string;
  longitude?: string;
}) {
  const locationWasProvided = location !== undefined;
  const locationValue = location ?? "";

  if (locationValue.trim().length > 0) {
    return {
      location: locationValue,
      latitude: undefined,
      longitude: undefined,
    };
  }

  if (latitude || longitude) {
    return {
      location: "",
      latitude,
      longitude,
    };
  }

  return {
    location: locationWasProvided ? locationValue : "Stockholm",
    latitude: undefined,
    longitude: undefined,
  };
}
