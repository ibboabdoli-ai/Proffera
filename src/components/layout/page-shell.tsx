import { ButtonLink } from "@/components/ui/button-link";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  children?: React.ReactNode;
};

export function PageShell({ eyebrow, title, description, ctaLabel, ctaHref, children }: PageShellProps) {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#17452f]">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5b665f]">{description}</p>
        {ctaLabel && ctaHref ? (
          <div className="mt-8">
            <ButtonLink href={ctaHref}>{ctaLabel}</ButtonLink>
          </div>
        ) : null}
        {children ? <div className="mt-10">{children}</div> : null}
      </section>
    </div>
  );
}
