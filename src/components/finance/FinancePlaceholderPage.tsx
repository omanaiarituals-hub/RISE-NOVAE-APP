import Link from 'next/link'

export default function FinancePlaceholderPage({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
}: {
  eyebrow: string
  title: string
  description: string
  primaryHref?: string
  primaryLabel?: string
}) {
  return (
    <section className="rounded-[26px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-5 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">{eyebrow}</p>
      <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold sm:text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--novae-text-muted)]">{description}</p>
      {primaryHref && primaryLabel ? (
        <Link href={primaryHref} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--novae-primary)] px-5 font-extrabold text-white no-underline">
          {primaryLabel}
        </Link>
      ) : null}
    </section>
  )
}
