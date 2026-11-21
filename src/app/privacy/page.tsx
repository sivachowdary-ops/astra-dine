import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Astra Dine collects when you order at a restaurant, why, and how to have it deleted.",
};

const UPDATED = "21 November 2026";

/**
 * Privacy notice for guests and staff of restaurants that use Astra Dine. Every statement here
 * matches what the code does; change both together.
 */
export default function PrivacyPage() {
  return (
    <main className="bg-ground text-ink min-h-dvh">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <Link href="/" className="text-indigo text-sm font-bold underline">
          Astra Dine
        </Link>
        <h1 className="dish mt-4 text-4xl">Privacy</h1>
        <p className="text-muted mt-2 text-sm">Last updated {UPDATED}</p>

        <p className="text-ink-2 mt-6 text-lg">
          When you scan a table&apos;s QR code, you order through Astra Dine. You don&apos;t need an app or an account. This page explains what is kept, why, and how to have it deleted.
        </p>

        <Section title="Who is responsible">
          <p>
            <strong>The restaurant you ordered from</strong> decides why your details are used, and is responsible for them. <strong>Astra AI Solutions</strong> makes Astra Dine and runs it for the restaurant, and uses your details only to provide it.
          </p>
        </Section>

        <Section title="What is kept, and why">
          <dl className="space-y-4">
            <Item term="Your order">The dishes, notes for the kitchen (such as &ldquo;less spicy&rdquo;), table number and times, so the kitchen can cook it and the bill is right.</Item>
            <Item term="Your bill and payment">
              The amount, how it was paid (UPI, cash, card or gift card) and whether the cashier confirmed it. UPI payments go from your UPI app straight to the restaurant&apos;s account. Astra Dine never sees your UPI PIN, card or bank details.
            </Item>
            <Item term="Rewards, only if you join">
              Your mobile number and, if you give it, your first name, with your visits, spending, stamps and rewards. This lets the restaurant keep your stamp card. Joining is your choice; you can order without it.
            </Item>
            <Item term="Offers on WhatsApp, only if you tick the box">
              If you agree, the restaurant may send you offers on WhatsApp. If you don&apos;t tick it, your number is used only for your stamp card.
            </Item>
            <Item term="Your feedback">Your star ratings and any comment, so the manager can follow up. If you are a rewards member, your first name is shown with it.</Item>
            <Item term="Restaurant staff">Name, username and role for each staff login, the owner&apos;s email address, and which staff member confirmed an order or a payment.</Item>
          </dl>
        </Section>

        <Section title="On your phone">
          <p>
            While you order, your basket is kept in your browser for that tab only and is cleared when you close it. There are no advertising or tracking cookies. Staff screens keep a sign-in cookie and remember the restaurant code on that device.
          </p>
        </Section>

        <Section title="Who else handles it">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Supabase</strong> stores the data (database, sign-ins and dish photos). The servers are in Sydney, Australia.
            </li>
            <li>The hosting provider that serves the Astra Dine pages.</li>
            <li>Your UPI app and bank, when you pay by UPI. They work under their own privacy policies.</li>
          </ul>
          <p className="mt-3">Your details are not sold, and not shared for advertising.</p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Stop offers:</strong> ask the restaurant. They can switch your offers off from their dashboard at once.
            </li>
            <li>
              <strong>Delete your details:</strong> ask the restaurant. They can delete your rewards card from their dashboard. That removes your number, name, stamps and rewards. Past bills stay in their accounts, without your details.
            </li>
            <li>
              <strong>See or correct your details:</strong> ask the restaurant.
            </li>
          </ul>
          <p className="mt-3">
            If the restaurant can&apos;t help, message Astra AI Solutions on{" "}
            <a href="https://wa.me/919251283730" className="text-indigo font-bold underline">
              WhatsApp, +91 92512 83730
            </a>
            .
          </p>
        </Section>

        <Section title="The demo">
          <p>
            Kaaram Kitchen is a sample restaurant made to show Astra Dine. Its guests, bills and reviews are generated. On the demo table, please use a sample number starting with 5: any other number is deleted within the hour. A private copy made with &ldquo;Try every screen yourself&rdquo; is deleted after 24 hours.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line mt-8 border-t pt-6">
      <h2 className="dish text-2xl">{title}</h2>
      <div className="text-ink-2 mt-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink font-bold">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
