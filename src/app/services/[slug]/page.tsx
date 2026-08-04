import PrimeViewSeoPage, { generateMetadata } from "@/app/demo/primeview/seo/[slug]/page";
import { primeViewServicePages } from "@/lib/primeview-seo-pages";

export { generateMetadata };
export function generateStaticParams() { return primeViewServicePages.map(({ slug }) => ({ slug })); }
export default PrimeViewSeoPage;
