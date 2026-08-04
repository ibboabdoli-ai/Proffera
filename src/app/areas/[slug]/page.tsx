import PrimeViewSeoPage, { generateMetadata } from "@/app/demo/primeview/seo/[slug]/page";
import { primeViewAreaPages } from "@/lib/primeview-seo-pages";

export { generateMetadata };
export function generateStaticParams() { return primeViewAreaPages.map(({ slug }) => ({ slug })); }
export default PrimeViewSeoPage;
