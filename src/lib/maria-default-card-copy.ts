/**
 * Effective booking-card descriptions before any manager-specific override.
 * Keep in sync with the public Design 02 language dictionary (tested below).
 * Only card descriptions use this mapping; other site content stays unchanged.
 */
export const mariaDefaultCardCopy = {
  trial: {
    sv: "En professionell och hållbar makeup som utförs på bröllopsdagen, inklusive en provsminkning cirka 1–3 månader innan bröllopet. Hembesök ingår.",
    en: "Professional, long-lasting wedding-day makeup, including a trial approximately 1–3 months before your wedding. Home visit included.",
    ar: "مكياج احترافي يدوم طوال يوم الزفاف، مع تجربة قبل الزفاف بحوالي ١–٣ أشهر. تشمل الخدمة الزيارة المنزلية.",
  },
  "without-trial": {
    sv: "En professionell och hållbar makeup som utförs direkt på bröllopsdagen. Hembesök ingår.",
    en: "Professional, long-lasting bridal makeup on your wedding day. Home visit included.",
    ar: "مكياج احترافي وثابت يوم الزفاف مباشرة، ويشمل الزيارة المنزلية.",
  },
} as const;
