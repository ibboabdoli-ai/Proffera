import { BookingLinkCardClient } from "./booking-link-card-client";

type BookingLinkCardProps = {
  url: string;
};

export function BookingLinkCard({ url }: BookingLinkCardProps) {
  return <BookingLinkCardClient url={url} isPreview={process.env.VERCEL_ENV === "preview"} />;
}
