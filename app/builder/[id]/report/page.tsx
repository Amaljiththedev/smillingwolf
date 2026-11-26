import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/builder/top-bar";
import { PrintButton } from "@/components/dashboard/print-button";
import { SiteNav } from "@/components/dashboard/site-nav";
import { WordPressNotice } from "@/components/dashboard/wordpress-notice";
import { getSession } from "@/lib/auth";
import { cleanRange, type DashboardData } from "@/lib/consultation";
import { getSite } from "@/lib/sites";
import { WordPressError, getDashboard } from "@/lib/wordpress";

export const instant = false;

/*
  A plain, printable summary of the results, for sharing with a council or a
  project team. Print or save as PDF from the browser.
*/

const fmt = new Intl.NumberFormat("en-GB");

function day(d?: string) {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/builder/${id}/report`);

  const site = getSite(id);
  if (!site?.wordpress) notFound();

  const range = cleanRange(await searchParams);
  let data: DashboardData | undefined;
  let error: string | null = null;
  try {
    data = await getDashboard(site.wordpress, range);
  } catch (e) {
    error = e instanceof WordPressError ? e.message : "Could not load the results.";
  }

  return (
    <>
      <div className="print:hidden">
        <TopBar session={session}>
          <SiteNav site={site} />
        </TopBar>
      </div>
      <main className="min-h-[calc(100svh-3.5rem)] bg-paper py-8 print:bg-white print:py-0">
        {data ? <Report data={data} range={range} /> : <WordPressNotice message={error ?? ""} />}
      </main>
    </>
  );
}

function Report({ data, range }: { data: DashboardData; range: { from?: string; to?: string } }) {
  const s = data.summary;
  const period =
    range.from || range.to
      ? `${range.from ? day(range.from) : "The start"} to ${range.to ? day(range.to) : "today"}`
      : "All responses so far";
  const tiles: [string, number | string][] = [
    ["Responses", s.responses],
    s.support_pct !== null ? ["Support the plans", `${s.support_pct}%`] : ["Written answers", s.written],
    ["Comments", s.comments],
    ["Quick reactions", s.reactions],
  ];
  if (s.signups !== null) tiles.push(["Signed up for updates", s.signups]);

  return (
    <article className="mx-auto max-w-[52rem] rounded-sw border border-ink/10 bg-white px-6 py-10 text-ink md:px-12 print:max-w-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/15 pb-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/55">Consultation report</p>
          <h1 className="mt-2 text-[2.2rem] font-medium leading-tight tracking-[-0.03em]">{data.site.name}</h1>
          <p className="mt-1 text-[0.9rem] text-ink/65">
            {period}. Prepared {day(new Date().toISOString().slice(0, 10))}.
          </p>
        </div>
        <PrintButton />
      </header>

      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sw border border-ink/10 bg-ink/10 md:auto-cols-fr md:grid-flow-col md:grid-cols-none print:auto-cols-fr print:grid-flow-col print:grid-cols-none">
        {tiles.map(([label, value]) => (
          <div key={label} className="bg-white p-4">
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/55">{label}</p>
            <p className="mt-2 text-[1.9rem] font-medium leading-none tracking-[-0.02em] tabular-nums">
              {typeof value === "number" ? fmt.format(value) : value}
            </p>
          </div>
        ))}
      </section>

      <Section title="The questionnaire">
        {data.questionnaire.map((q) => (
          <div key={q.key} className="break-inside-avoid border-b border-ink/10 py-5 last:border-0">
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/55">{q.code}</p>
            <h3 className="mt-1 text-[1rem] font-medium leading-snug">{q.text}</h3>
            {q.type === "text" ? (
              <>
                <p className="mt-2 text-[0.85rem] text-ink/65">{fmt.format(q.notes)} written answers. Recent examples:</p>
                <Quotes items={q.latest.map((l) => l.text)} />
              </>
            ) : (
              <table className="mt-3 w-full text-[0.85rem]">
                <tbody>
                  {q.choices.map((c) => (
                    <tr key={c.key} className="border-t border-ink/5">
                      <td className="py-1.5 pr-3">{c.label}</td>
                      <td className="w-[40%] py-1.5 pr-3">
                        <span className="block h-2 rounded-full bg-ink/5">
                          <span className="block h-full rounded-full bg-ink print:bg-ink" style={{ width: `${c.pct}%` }} />
                        </span>
                      </td>
                      <td className="w-20 py-1.5 text-right tabular-nums">
                        {c.pct}% <span className="text-ink/50">({fmt.format(c.count)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </Section>

      {data.quotes.length > 0 && (
        <Section title="Themes and what people said">
          {data.quotes
            .filter((t) => t.count > 0)
            .map((t) => (
              <div key={t.key} className="break-inside-avoid border-b border-ink/10 py-4 last:border-0">
                <h3 className="flex items-baseline justify-between gap-3 text-[1rem] font-medium">
                  {t.label}
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/55">
                    {fmt.format(t.count)} mentions
                  </span>
                </h3>
                <Quotes items={t.quotes.map((q) => (q.count > 1 ? `${q.text} (${q.count} people)` : q.text))} />
              </div>
            ))}
        </Section>
      )}

      {data.reactions.length > 0 && (
        <Section title="Quick reactions">
          <table className="w-full text-[0.85rem]">
            <thead>
              <tr className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/55">
                <th className="py-2 text-left font-normal">Idea</th>
                <th className="py-2 text-right font-normal">Like</th>
                <th className="py-2 text-right font-normal">Unsure</th>
                <th className="py-2 text-right font-normal">Dislike</th>
              </tr>
            </thead>
            <tbody>
              {data.reactions.map((r) => (
                <tr key={r.key} className="border-t border-ink/10">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-right tabular-nums">{fmt.format(r.like)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt.format(r.unsure)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt.format(r.dislike)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Who responded">
        <div className="grid gap-6 md:grid-cols-3">
          {(
            [
              ["Age", data.respondents.age_band],
              ["Connection to the area", data.respondents.connection],
              ["Postcode", data.respondents.postcode],
            ] as const
          ).map(([label, groups]) => (
            <div key={label} className="break-inside-avoid">
              <h3 className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/55">{label}</h3>
              {groups.some((g) => g.count > 0) ? (
                <ul className="mt-2 text-[0.85rem]">
                  {groups
                    .filter((g) => g.count > 0)
                    .map((g) => (
                      <li key={g.key ?? g.label} className="flex justify-between border-t border-ink/5 py-1">
                        <span>{g.label}</span>
                        <span className="tabular-nums">{fmt.format(g.count)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-[0.85rem] text-ink/55">No answers yet.</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <p className="mt-10 border-t border-ink/10 pt-4 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/45">
        Example data
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-ink pb-2 text-[1.3rem] font-medium tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function Quotes({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((text, i) => (
        <li key={i} className="border-l-2 border-peach pl-3 text-[0.88rem] leading-snug">
          &ldquo;{text}&rdquo;
        </li>
      ))}
    </ul>
  );
}
