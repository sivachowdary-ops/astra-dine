import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { MessageCircle } from "lucide-react";
import { TryLivePanel } from "@/components/sales/try-live";
import { TryRestaurant } from "@/components/sales/try-restaurant";

export const metadata: Metadata = {
  title: { absolute: "Astra Dine: QR ordering, kitchen screen, billing and loyalty for restaurants" },
  description: "Guests order and pay from the table on their own phone. The kitchen sees it at once, the cashier confirms every payment, and you see the whole night from your phone.",
};

const WHATSAPP = `https://wa.me/919251283730?text=${encodeURIComponent("Hi, I saw Astra Dine and would like a demo for my restaurant.")}`;

type Shot = { src: string; w: number; h: number; alt: string; phone?: boolean };
type Moment = { time: string; title: string; text: string; shots: Shot[] };

// One real table's evening at the sample restaurant. Every image is the product, captured live.
const evening: Moment[] = [
  {
    time: "8:02 pm",
    title: "Four friends sit at table 12 and scan the code on the table.",
    text: "The menu opens on their phones with photos, prices, veg marks and how spicy each dish is. Nobody waits for a menu card or for a waiter to come back.",
    shots: [{ src: "/showcase/phone-loved.webp", w: 780, h: 1688, alt: "The guest's menu on a phone, with dish photos and Add buttons", phone: true }],
  },
  {
    time: "8:03 pm",
    title: "Their order is already on the kitchen screen.",
    text: "Nobody writes out a KOT. “Less spicy” shows in red on the ticket, a chime sounds for every new order, and the ticket turns red if it waits too long.",
    shots: [{ src: "/showcase/kitchen-ticket.webp", w: 1600, h: 560, alt: "Kitchen screen with tickets for tables 7 and 11, one marked less spicy" }],
  },
  {
    time: "8:20 pm",
    title: "At the counter, the whole floor on one screen.",
    text: "Which tables are eating, which want water or the bill, and how long each has waited. A table's first QR order waits for one tap here, so nobody can order from outside the restaurant.",
    shots: [{ src: "/showcase/cashier.webp", w: 1600, h: 1007, alt: "The cashier's floor plan with tables cooking, calling and asking for the bill" }],
  },
  {
    time: "8:47 pm",
    title: "The bill comes to their phone, with GST already split.",
    text: "They can split it among themselves and pay by UPI, straight to your account. Astra never holds your money.",
    shots: [{ src: "/showcase/phone-bill.webp", w: 780, h: 1688, alt: "The bill on the guest's phone: dishes, CGST, SGST and a Pay button", phone: true }],
  },
  {
    time: "8:48 pm",
    title: "Your cashier checks the money arrived.",
    text: "A screenshot or an “I've paid” is never enough. The bill only closes when your cashier sees the payment and taps Received.",
    shots: [{ src: "/showcase/cashier-check.webp", w: 1600, h: 1007, alt: "The cashier asked to check a UPI payment before the bill closes" }],
  },
  {
    time: "8:49 pm",
    title: "A stamp on their card, and a quick rating.",
    text: "Six visits and the next dessert is free. Happy guests are asked, with no reward, to post a Google review. Unhappy ones reach you privately first.",
    shots: [
      { src: "/showcase/phone-paid.webp", w: 780, h: 1688, alt: "Paid screen with a loyalty stamp card", phone: true },
      { src: "/showcase/phone-review.webp", w: 780, h: 1688, alt: "A happy guest is invited to write a Google review", phone: true },
    ],
  },
  {
    time: "Next morning",
    title: "You read the night from your phone.",
    text: "Sales, average bill, what sold and what didn't, the busy hours and how fast the kitchen was. All from your own bills.",
    shots: [{ src: "/showcase/owner-reports.webp", w: 1440, h: 900, alt: "Owner's reports: sales by day, busy hours, best and slowest dishes" }],
  },
];

const faqs = [
  ["Do guests need an app?", "No. They scan the QR code on the table with the phone camera and the menu opens in the browser."],
  ["Does the money go through you?", "No. Guests pay your UPI ID from their own UPI app. Cash and card are taken at the counter as today."],
  ["Can waiters still take orders?", "Yes. The cashier can add orders to any table, for guests who would rather tell a waiter."],
  ["What do we need in the restaurant?", "A tablet, an old phone or a TV with a browser for the kitchen, a laptop or tablet at the counter, internet, and the printed QR cards. Each screen has its own login."],
  ["What if the internet goes down?", "The screens need internet to receive orders. When it comes back, they reconnect on their own and catch up."],
  ["Can we change prices or switch a dish off?", "Yes, from your phone. Every table sees the change at once, and the kitchen can mark a dish sold out."],
];

function Picture({ s, className = "" }: { s: Shot; className?: string }) {
  if (s.phone) {
    return (
      <div className={`w-[13.5rem] shrink-0 overflow-hidden rounded-[1.9rem] border-[7px] border-[#0f1430] bg-[#0f1430] shadow-[0_28px_50px_-24px_rgb(0_0_0/0.7)] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy" className="w-full rounded-[1.35rem]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy" className={`w-full rounded-lg shadow-[0_28px_50px_-24px_rgb(0_0_0/0.75)] ring-1 ring-white/10 ${className}`} />
  );
}

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3106";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
  const qr = await QRCode.toString(`${proto}://${host}/try`, { type: "svg", margin: 1, color: { dark: "#1d1a17", light: "#ffffff" } });

  return (
    <div className="text-ink bg-white">
      <header className="border-line border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="#top" className="dish text-xl">
            Astra Dine
          </a>
          <nav aria-label="Page" className="flex items-center gap-1 text-[0.95rem]">
            <a href="#evening" className="text-ink-2 hover:text-ink hidden rounded-lg px-3 py-2 md:block">
              How it works
            </a>
            <a href="#try" className="text-ink-2 hover:text-ink rounded-lg px-3 py-2">
              Try it
            </a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="bg-ink ml-1 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 font-bold text-white">
              <MessageCircle className="size-4" aria-hidden="true" />
              Talk to us
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* The opening: real food, the real menu, and what happens at 8:02 pm. */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pt-16 lg:pb-24">
          <div>
            <h1 className="dish text-[clamp(2.4rem,1.4rem+4vw,4.3rem)] leading-[1.02] tracking-[-0.01em]">Table 12 orders at 8:02. The kitchen has it at 8:02.</h1>
            <p className="text-ink-2 mt-6 max-w-[34rem] text-lg leading-relaxed">
              Astra Dine runs the floor for dine-in restaurants: guests order and pay from the table on their own phones, the kitchen and the counter each get their own screen, and you see the whole night from your phone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href="#try" className="bg-turmeric inline-flex min-h-14 items-center rounded-xl px-7 text-lg font-bold text-[#1d1a17] hover:bg-[#d0901a]">
                Try every screen yourself
              </a>
              <a href="#evening" className="text-indigo font-bold underline decoration-2 underline-offset-4">
                See one table&apos;s evening
              </a>
            </div>
            <p className="text-muted mt-8 max-w-[34rem] text-sm">No app for your guests. Payments go straight to your UPI ID. Each screen has its own login.</p>
          </div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/showcase/food-cover.webp" alt="Andhra dishes on the table at Kaaram Kitchen, the sample restaurant" className="aspect-[4/5] w-full rounded-2xl object-cover sm:aspect-[5/4] lg:aspect-[4/5]" />
            <div className="absolute -bottom-6 -left-3 w-[42%] max-w-[13rem] overflow-hidden rounded-[1.7rem] border-[6px] border-white bg-white shadow-[0_24px_44px_-18px_rgb(29_26_23/0.55)] sm:-left-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/showcase/phone-menu.webp" width={780} height={1688} alt="The same restaurant's menu on a guest's phone" className="w-full rounded-[1.2rem]" />
            </div>
          </div>
        </section>

        {/* The memorable part: a real evening, minute by minute, with the screen that handles each moment. */}
        <section id="evening" aria-labelledby="evening-h" className="bg-indigo-2 scroll-mt-4 text-white">
          <div className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
            <h2 id="evening-h" className="dish max-w-3xl text-[clamp(2.1rem,1.4rem+3vw,3.6rem)] leading-[1.05]">
              One table, one evening
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-white/75">Table 12 at Kaaram Kitchen, a sample restaurant, on a Friday night. Every picture is the real product.</p>
            <ol className="mt-14 space-y-20 lg:space-y-28">
              {evening.map((m) => (
                <li key={m.time + m.title} className="grid gap-6 lg:grid-cols-[11rem_1fr_1.15fr] lg:gap-10">
                  <p className="dish text-turmeric text-[2.2rem] leading-none lg:text-right lg:text-[2.6rem]">{m.time}</p>
                  <div className="lg:border-l lg:border-white/15 lg:pl-10">
                    <h3 className="dish text-[1.65rem] leading-tight">{m.title}</h3>
                    <p className="mt-3 max-w-md text-lg leading-relaxed text-white/75">{m.text}</p>
                  </div>
                  <div className={m.shots.some((s) => s.phone) ? "flex flex-wrap gap-5 lg:justify-start" : ""}>
                    {m.shots.map((s) => (
                      <Picture key={s.src} s={s} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Try it: the whole restaurant as their own copy, or just a table. */}
        <section id="try" aria-labelledby="try-h" className="scroll-mt-4">
          <div className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
              <div>
                <h2 id="try-h" className="dish text-[clamp(2.1rem,1.4rem+3vw,3.4rem)] leading-[1.05]">
                  Try every screen yourself
                </h2>
                <p className="text-ink-2 mt-5 max-w-xl text-lg leading-relaxed">
                  Get your own copy of Kaaram Kitchen for a day, with its menu, tables and three weeks of bills. The owner&apos;s dashboard opens here. The kitchen screen, the cashier and a guest&apos;s table open on any other phone or tablet with a QR code. Pretend guests keep ordering, so there is always something to cook.
                </p>
                <div className="mt-8">
                  <TryRestaurant />
                </div>
                <p className="text-muted mt-3 text-sm">No sign-up and no password. Nobody else sees your copy, and it is deleted after 24 hours.</p>
                <figure className="mt-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/showcase/owner-today.webp" width={1440} height={900} alt="The owner's Today screen: money collected, average bill, the floor and what is selling" loading="lazy" className="border-line w-full rounded-lg border" />
                  <figcaption className="text-muted mt-2 text-sm">Your dashboard in the copy: today&apos;s takings, the floor and what is selling.</figcaption>
                </figure>
              </div>
              <div className="bg-ground rounded-2xl p-6 sm:p-8">
                <h3 className="dish text-2xl">Or just sit at a table</h3>
                <p className="text-ink-2 mt-2">Order from your phone at a demo table and watch your dishes go through a kitchen run by a pretend crew, right here.</p>
                <div className="mt-5 flex flex-wrap items-center gap-5">
                  <div className="hidden w-32 rounded-lg bg-white p-2 sm:block" role="img" aria-label="QR code for a demo table" dangerouslySetInnerHTML={{ __html: qr }} />
                  <a href="/try" target="_blank" rel="noopener" className="btn btn-primary !min-h-12">
                    Open a demo table
                  </a>
                </div>
                <div className="mt-6">
                  <TryLivePanel />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-h" className="border-line border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1fr_2fr]">
            <h2 id="faq-h" className="dish text-3xl leading-tight">
              What owners ask us
            </h2>
            <dl className="divide-line divide-y">
              {faqs.map(([q, a]) => (
                <div key={q} className="grid gap-1 py-5 sm:grid-cols-[1fr_1.4fr] sm:gap-8">
                  <dt className="font-bold">{q}</dt>
                  <dd className="text-ink-2">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="talk-h" className="bg-ground">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-14">
            <div>
              <h2 id="talk-h" className="dish text-3xl">
                See it with your own menu
              </h2>
              <p className="text-ink-2 mt-1">Message us and we&apos;ll set it up with your dishes, tables and prices to show you.</p>
            </div>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="bg-ink inline-flex min-h-13 items-center gap-2 rounded-xl px-6 text-base font-bold text-white">
              <MessageCircle className="size-5" aria-hidden="true" />
              WhatsApp +91 92512 83730
            </a>
          </div>
        </section>
      </main>

      <footer className="text-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:justify-between">
          <p>Astra Dine by Astra AI Solutions</p>
          <p className="max-w-xl sm:text-right">Kaaram Kitchen is a sample restaurant made for this demo; its guests, bills and reviews are generated. Food photos from Unsplash.</p>
        </div>
      </footer>
    </div>
  );
}
