import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { ArrowRight, BadgeIndianRupee, BellRing, ChefHat, Gift, LayoutDashboard, MessageCircle, MonitorSmartphone, QrCode, ReceiptText, ScanLine, ShieldCheck, Star } from "lucide-react";
import { TryLivePanel } from "@/components/sales/try-live";

export const metadata: Metadata = {
  title: { absolute: "Astra Dine: table QR ordering, kitchen screen, billing and loyalty" },
  description: "Guests order and pay from the table on their own phone. The kitchen sees it at once, the cashier confirms every payment, and the owner sees the day live.",
};

const WHATSAPP = `https://wa.me/919251283730?text=${encodeURIComponent("Hi, I saw Astra Dine and would like a demo for my restaurant.")}`;

const problems = [
  {
    icon: BellRing,
    pain: "Saturday night, three tables waving for a waiter.",
    fix: "Guests open the menu with the table's QR code and order themselves. Water, cutlery or the bill reach the counter screen as a call, with how long the table has waited.",
  },
  {
    icon: ChefHat,
    pain: "Orders written wrong, KOTs lost between the floor and the kitchen.",
    fix: "The order goes from the guest's phone to the kitchen screen as a ticket, with notes like “less spicy” in red. Nobody copies it out again. The kitchen marks each dish cooking and ready.",
  },
  {
    icon: ReceiptText,
    pain: "Ten minutes to get the bill. Five more to split it.",
    fix: "The bill is on the guest's phone with GST already split into CGST and SGST. They can split it two to five ways and each pays their share from their own UPI app.",
  },
  {
    icon: ShieldCheck,
    pain: "A UPI screenshot that never turned into money.",
    fix: "“I've paid” only marks the payment as claimed. The bill closes when your cashier taps Received after checking the money arrived.",
  },
  {
    icon: QrCode,
    pain: "Reprinting menus every time a price changes or a dish runs out.",
    fix: "Change a price or switch a dish off in the dashboard and every table sees it straight away. The kitchen can mark a dish sold out from its own screen.",
  },
  {
    icon: Gift,
    pain: "You don't know who your regulars are.",
    fix: "A stamp card on the guest's phone number, no app and no paper. You see who comes back and how much they spend, and can export the guests who agreed to WhatsApp offers.",
  },
  {
    icon: Star,
    pain: "One bad night ends up on Google.",
    fix: "After paying, guests rate the food and service. Low ratings go to you privately so you can call them back. Happy guests are shown your Google review link, with no reward attached.",
  },
  {
    icon: LayoutDashboard,
    pain: "You're away and have no idea how today is going.",
    fix: "The owner's dashboard shows today's sales, what is selling, kitchen times and which tables are waiting, live on your phone. Reports show the busy hours of the week.",
  },
];

const screens = [
  {
    eyebrow: "On the guest's phone",
    title: "A menu people want to order from",
    img: "/showcase/phone-menu.webp",
    tall: true,
    points: ["Your photos, offers and serving hours", "Veg and non-veg marks, spice level, Telugu names", "Track each dish from kitchen to table", "Pay by UPI, split the bill, collect stamps"],
  },
  {
    eyebrow: "In the kitchen",
    title: "Tickets that arrive in under a second",
    img: "/showcase/kitchen.webp",
    points: ["One screen per station or all together", "Timers turn amber, then red, as tickets wait", "“To make now” adds up every open ticket", "Mark a dish sold out for every table"],
  },
  {
    eyebrow: "At the counter",
    title: "The whole floor at a glance",
    img: "/showcase/cashier.webp",
    points: ["Confirm a table's first QR order", "Calls for water, cutlery and the bill", "Cash, card, UPI and gift cards", "Staff can still take orders for walk-ins"],
  },
  {
    eyebrow: "For the owner",
    title: "Your restaurant, from anywhere",
    img: "/showcase/owner-today.webp",
    points: ["Sales, average bill and kitchen time today", "Menu, photos, tables, staff logins", "Loyalty members and WhatsApp offer lists", "Reports by day, hour and dish"],
  },
];

const faqs = [
  ["Do guests need to download an app?", "No. They scan the QR code on the table with their phone camera and the menu opens in the browser."],
  ["Does the money go through Astra?", "No. Guests pay your UPI ID directly from their own UPI app, and cash and card are taken at the counter as today. Astra Dine never holds your money."],
  ["Can my staff still take orders the usual way?", "Yes. The cashier can add orders for any table, so guests who prefer to order from a waiter still can."],
  ["What devices do we need?", "A tablet or old phone for the kitchen (or a TV with a browser), a laptop, tablet or phone at the counter, internet, and printed QR cards for the tables. Each screen signs in with its own login."],
  ["What if the internet drops?", "The screens need internet to receive orders. When the connection comes back they reconnect by themselves and catch up."],
  ["Can someone order to my table from outside?", "A table's first QR order waits until your staff confirm it, so a photo of the QR code can't be used to send fake orders."],
];

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3106";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
  const tryUrl = `${proto}://${host}/try`;
  const qr = await QRCode.toString(tryUrl, { type: "svg", margin: 1, color: { dark: "#1d1a17", light: "#ffffff" } });

  return (
    <div className="bg-ground text-ink">
      {/* Header */}
      <header className="bg-indigo-2/90 sticky top-0 z-40 border-b border-white/10 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <a href="#top" className="flex items-center gap-2 font-bold">
            <span className="bg-turmeric flex size-8 items-center justify-center rounded-lg text-[#241800]">
              <ScanLine className="size-4.5" aria-hidden="true" />
            </span>
            Astra Dine
          </a>
          <nav aria-label="Page" className="flex items-center gap-1 text-sm">
            <a href="#problems" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white md:block">
              What it fixes
            </a>
            <a href="#screens" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white md:block">
              The four screens
            </a>
            <a href="#try" className="rounded-lg px-3 py-2 text-white/80 hover:text-white">
              Try it
            </a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="bg-turmeric ml-1 flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 font-bold text-[#241800]">
              <MessageCircle className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Talk to us</span>
              <span className="sm:hidden">WhatsApp</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="bg-indigo-2 relative overflow-hidden text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_75%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-32 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgb(226_160_30/0.35),transparent_65%)] blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute top-1/2 -left-40 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgb(163_48_31/0.35),transparent_65%)] blur-2xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
            <div>
              <p className="text-turmeric text-xs font-bold tracking-[0.18em] uppercase">For dine-in restaurants</p>
              <h1 className="dish mt-4 text-[2.6rem] leading-[1.05] sm:text-6xl">Guests order from the table. The kitchen has it in a second.</h1>
              <p className="mt-6 max-w-xl text-lg text-white/80">
                Astra Dine joins up table QR ordering, a kitchen screen, billing, a loyalty card and your own dashboard. Guests need no app, and payments go straight to your UPI ID.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#try" className="bg-turmeric flex min-h-13 items-center gap-2 rounded-xl px-6 text-base font-bold text-[#241800] shadow-[0_12px_30px_-12px_rgb(226_160_30/0.8)]">
                  Try it on your phone
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="flex min-h-13 items-center gap-2 rounded-xl px-6 text-base font-bold text-white ring-1 ring-white/30 hover:bg-white/10">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Book a demo on WhatsApp
                </a>
              </div>
              <ul className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-3 text-sm text-white/75">
                {["No app for guests", "Separate kitchen, cashier and owner logins", "UPI straight to your account", "Works on phones, tablets and TVs"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="bg-turmeric mt-1.5 size-1.5 shrink-0 rounded-full" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative mx-auto mt-28 mb-8 w-full max-w-md sm:mt-16 lg:my-0 lg:max-w-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/showcase/kitchen.webp" alt="The kitchen screen with tickets from four tables" className="ml-auto w-[88%] rounded-xl shadow-2xl ring-1 ring-white/15" />
              <div className="absolute -bottom-10 left-0 w-[42%] overflow-hidden rounded-[1.8rem] border-[7px] border-[#0d0f1c] bg-[#0d0f1c] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/showcase/phone-menu.webp" alt="The guest's menu on a phone, with the restaurant's cover photo and offer" className="w-full rounded-[1.3rem]" />
              </div>
            </div>
          </div>
        </section>

        {/* Problems */}
        <section id="problems" aria-labelledby="problems-h" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20">
          <p className="text-madder text-xs font-bold tracking-[0.18em] uppercase">What it fixes</p>
          <h2 id="problems-h" className="dish mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">
            The everyday trouble on a busy floor
          </h2>
          <ul className="border-line mt-12 grid border-t sm:grid-cols-2">
            {problems.map(({ icon: Icon, pain, fix }, i) => (
              <li key={pain} className={`border-line border-b py-8 sm:px-8 ${i % 2 === 0 ? "sm:border-r sm:pl-0" : "sm:pr-0"}`}>
                <Icon className="text-indigo size-6" aria-hidden="true" />
                <p className="dish mt-4 text-xl leading-snug">{pain}</p>
                <p className="text-ink-2 mt-2 leading-relaxed">{fix}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Screens */}
        <section id="screens" aria-labelledby="screens-h" className="bg-card border-line scroll-mt-16 border-y">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <p className="text-madder text-xs font-bold tracking-[0.18em] uppercase">The four screens</p>
            <h2 id="screens-h" className="dish mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">
              One system, each person on their own device
            </h2>
            <p className="text-ink-2 mt-4 max-w-2xl text-lg">Every screen signs in separately. The kitchen login can&apos;t open the cashier, and only the owner sees the money. A change on one screen reaches the others at once.</p>
            <div className="mt-14 space-y-20">
              {screens.map((s, i) => (
                <article key={s.title} className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>figure]:order-2" : ""}`}>
                  <figure className={s.tall ? "mx-auto w-full max-w-[17rem]" : ""}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.img}
                      alt={`${s.title}: screenshot`}
                      loading="lazy"
                      className={s.tall ? "w-full rounded-[1.8rem] border-[7px] border-[#1d1a17] shadow-xl" : "border-line w-full rounded-xl border shadow-[0_24px_50px_-28px_rgb(29_26_23/0.5)]"}
                    />
                  </figure>
                  <div>
                    <p className="text-indigo text-xs font-bold tracking-[0.18em] uppercase">{s.eyebrow}</p>
                    <h3 className="dish mt-2 text-3xl">{s.title}</h3>
                    <ul className="mt-5 space-y-3">
                      {s.points.map((p) => (
                        <li key={p} className="text-ink-2 flex items-start gap-3 text-lg">
                          <span className="bg-turmeric mt-2.5 size-2 shrink-0 rounded-full" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Try it */}
        <section id="try" aria-labelledby="try-h" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20">
          <p className="text-madder text-xs font-bold tracking-[0.18em] uppercase">Try it now</p>
          <h2 id="try-h" className="dish mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">
            Sit at a demo table and order
          </h2>
          <p className="text-ink-2 mt-4 max-w-2xl text-lg">
            This is the real system, running for Kaaram Kitchen, a sample restaurant. Order from your phone and watch your ticket reach the kitchen on this page. A pretend crew confirms, cooks, serves and takes payment, so nothing is cooked or charged.
          </p>
          <div className="mt-10 grid gap-8 lg:grid-cols-[19rem_1fr]">
            <div className="bg-card border-line rounded-2xl border p-6">
              <div className="mx-auto hidden w-48 sm:block" role="img" aria-label="QR code that opens a demo table" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-4 hidden text-center font-bold sm:block">Scan with your phone camera</p>
              <a href="/try" target="_blank" rel="noopener" className="btn btn-primary mt-4 w-full !min-h-12">
                <MonitorSmartphone className="size-4" aria-hidden="true" />
                Open a demo table
              </a>
              <ol className="text-ink-2 mt-6 space-y-3 text-sm">
                {["Pick a dish or two and send them to the kitchen.", "Watch them go from confirmed to cooking, ready and served.", "Ask for the bill, then rate your meal."].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="bg-indigo-tint text-indigo flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <TryLivePanel />
          </div>
        </section>

        {/* Money */}
        <section aria-labelledby="money-h" className="bg-indigo-2 relative overflow-hidden text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-40 -bottom-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgb(226_160_30/0.25),transparent_65%)] blur-2xl" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2">
            <div>
              <p className="text-turmeric text-xs font-bold tracking-[0.18em] uppercase">Payments</p>
              <h2 id="money-h" className="dish mt-3 text-4xl leading-tight sm:text-5xl">
                Your money goes to you, not through us
              </h2>
              <p className="mt-5 text-lg text-white/80">Guests pay your own UPI ID from GPay, PhonePe, Paytm or their bank app, with the amount already filled in. Cash and card stay at the counter.</p>
            </div>
            <ol className="space-y-px overflow-hidden rounded-2xl ring-1 ring-white/15">
              {[
                [BadgeIndianRupee, "Guest taps Pay", "Their UPI app opens with your UPI ID and the exact amount."],
                [ScanLine, "Guest taps “I've paid”", "The payment shows at the counter as claimed, not paid."],
                [ShieldCheck, "Cashier taps Received", "Only after checking the money arrived. Then the bill closes and the stamp is added."],
              ].map(([Icon, t, d], i) => {
                const I = Icon as typeof ScanLine;
                return (
                  <li key={t as string} className="flex gap-4 bg-white/5 p-5">
                    <span className="bg-turmeric flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-[#241800]">
                      <I className="size-5" aria-hidden="true" />
                      <span className="sr-only">Step {i + 1}</span>
                    </span>
                    <span>
                      <span className="block font-bold">{t as string}</span>
                      <span className="text-white/75">{d as string}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-h" className="mx-auto max-w-3xl px-4 py-20">
          <p className="text-madder text-xs font-bold tracking-[0.18em] uppercase">Questions owners ask</p>
          <h2 id="faq-h" className="dish mt-3 text-4xl">
            Before you decide
          </h2>
          <div className="border-line mt-8 border-t">
            {faqs.map(([q, a]) => (
              <details key={q} className="border-line group border-b py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  {q}
                  <span aria-hidden="true" className="text-muted text-2xl leading-none transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-ink-2 mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Close */}
        <section aria-labelledby="cta-h" className="px-4 pb-20">
          <div className="bg-madder relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-14 text-center text-white sm:px-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(226_160_30/0.35),transparent_60%)]" />
            <div className="relative">
              <h2 id="cta-h" className="dish text-4xl leading-tight sm:text-5xl">
                See it running with your own menu
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Send us a message and we&apos;ll show you Astra Dine with your dishes, your tables and your prices.</p>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex min-h-13 items-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-[#1d1a17]">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp +91 92512 83730
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line text-muted border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:justify-between">
          <p>Astra Dine by Astra AI Solutions</p>
          <p className="max-w-xl sm:text-right">
            Kaaram Kitchen is a sample restaurant made for this demo. Its sales, guests and reviews are generated. Food photos from Unsplash.
          </p>
        </div>
      </footer>
    </div>
  );
}
