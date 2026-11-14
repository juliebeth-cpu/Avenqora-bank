import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Globe2,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";

interface TrackingContentProps {
  websiteUid: string;
  siteName: string;
  primary: string;
}

const WHY_CHOOSE_US = [
  {
    icon: Globe2,
    title: "Worldwide visibility",
    body: "Follow shipments across air, sea, road, and last-mile networks from one clear tracking experience.",
  },
  {
    icon: Clock3,
    title: "Timely updates",
    body: "See the latest milestone, current location, and delivery estimate as your shipment moves.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted information",
    body: "Shipment events are presented from the logistics records maintained by the service team.",
  },
  {
    icon: Truck,
    title: "Built for every delivery",
    body: "From international freight to local courier handoff, the same simple search works end to end.",
  },
];

const TRACKING_FAQS = [
  {
    question: "Where can I find my tracking number?",
    answer: "Your tracking number is usually in the shipment confirmation, dispatch notice, receipt, or message from the sender. Enter it exactly as shown, including any letters or hyphens.",
  },
  {
    question: "Why has my shipment status not changed?",
    answer: "Some shipment milestones are recorded only when a parcel reaches its next facility or transport handoff. International shipments can also pause during customs review. Check again later or contact the sender if the delay continues.",
  },
  {
    question: "Are delivery dates guaranteed?",
    answer: "Displayed delivery dates are estimates based on the latest available shipment information. Weather, customs, carrier capacity, address checks, and other events can change the final delivery time.",
  },
  {
    question: "What should I do if my tracking number is not found?",
    answer: "Check for typing errors and try again without extra spaces. A newly created shipment may not appear until its first scan. If the number still cannot be found, contact the sender or the support team.",
  },
  {
    question: "Can I track a shipment without creating an account?",
    answer: "Yes. Use the tracking search on this page with a valid tracking number. An account is only needed for any additional customer features offered by the website.",
  },
];

const TRACKING_NEWS = [
  {
    category: "Service update",
    title: "Clearer shipment milestones",
    body: "Tracking now presents the most important handoffs in a simple timeline so you can understand what happened and what comes next.",
  },
  {
    category: "Operations",
    title: "More visibility across the delivery journey",
    body: "Our logistics experience is designed to keep origin, transit, destination, and final-mile updates together in one place.",
  },
  {
    category: "Customer guidance",
    title: "How to prepare a shipment for tracking",
    body: "Keep the tracking number from your dispatch confirmation and check that the recipient address is complete before handoff.",
  },
];

function AccentIcon({
  icon: Icon,
  primary,
}: {
  icon: typeof Globe2;
  primary: string;
}) {
  return (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ backgroundColor: `${primary}22` }}
    >
      <Icon className="h-5 w-5" style={{ color: primary }} />
    </div>
  );
}

export function TrackingLandingSections({
  websiteUid,
  siteName,
  primary,
}: TrackingContentProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <section
        id="why-choose-us"
        className="border-t border-white/[0.06] bg-[#0a1020] px-6 py-16 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
              Why choose us
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Logistics visibility you can rely on
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
              {siteName} keeps the shipment journey understandable from the first scan to final delivery.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE_US.map(({ icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition-colors hover:border-white/20"
              >
                <AccentIcon icon={icon} primary={primary} />
                <h3 className="mt-5 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="px-6 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
              Frequently asked questions
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Get more from your tracking number
            </h2>
          </div>
          <div className="space-y-3">
            {TRACKING_FAQS.map(({ question, answer }, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={question} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-100"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </button>
                  {isOpen && <p className="px-5 pb-5 text-sm leading-6 text-slate-400">{answer}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="news" className="border-y border-white/[0.06] bg-white/[0.02] px-6 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
                News
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Updates from {siteName}
              </h2>
            </div>
            <Link
              href={`/site/${websiteUid}/blog`}
              className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: primary }}
            >
              Visit the Blog <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TRACKING_NEWS.map(({ category, title, body }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-[#080c18] p-6">
                <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: primary }}>
                  <PackageCheck className="h-4 w-4" />
                  {category}
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}

export function TrackingBlogContent({
  siteName,
  primary,
}: Pick<TrackingContentProps, "siteName" | "primary">) {
  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
          Logistics &amp; tracking blog
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Practical updates for every shipment
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Guidance, service updates, and logistics insights to help {siteName} customers plan with confidence.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          ["Tracking guide", "What each shipment milestone means", "Learn how origin scans, transit events, customs checks, and final-mile updates fit together."],
          ["Customer guidance", "What to do when a delivery is delayed", "A practical checklist for checking the latest event, confirming the address, and contacting the sender."],
          ["Operations", "Building a more visible delivery journey", "How clearer shipment records help customers and logistics teams make better decisions."],
        ].map(([category, title, body]) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: primary }}>{category}</p>
            <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TrackingTermsContent({
  siteName,
  contactEmail,
  companyAddress,
  primary,
}: {
  siteName: string;
  contactEmail: string;
  companyAddress: string;
  primary: string;
}) {
  return (
    <div className="space-y-10 text-sm leading-relaxed text-slate-300">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">1. Using the tracking service</h2>
        <p>
          These Terms and Conditions govern your use of {siteName} shipment tracking and related support features.
          By using the website, you agree to use the service lawfully and to provide accurate information when contacting us.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">2. Tracking information</h2>
        <p>
          Tracking events are supplied from available logistics records and may take time to appear after a scan or handoff.
          Dates, locations, and delivery estimates are informational and are not a guarantee of delivery by a particular time.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">3. Acceptable use</h2>
        <ul className="ml-2 list-disc space-y-1.5 text-slate-400">
          <li>Use tracking numbers only when you are authorized to view shipment information.</li>
          <li>Do not attempt to access, probe, disrupt, or overload the tracking service.</li>
          <li>Do not submit misleading, abusive, or unlawful content through support channels.</li>
          <li>Do not copy or redistribute private shipment information without permission.</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">4. Delivery responsibility</h2>
        <p>
          {siteName} provides visibility into shipment activity. The sender, carrier, customs authority, and delivery
          partners remain responsible for the physical handling, clearance, and delivery of a shipment.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">5. Availability and changes</h2>
        <p>
          We work to keep the service available and accurate, but maintenance, carrier systems, network conditions,
          or events outside our control may affect availability or update timing. We may improve or change features
          while preserving the core tracking service.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">6. Contact</h2>
        <p className="mb-3">Questions about these terms or a shipment can be directed to:</p>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-5">
          <p className="font-semibold text-white">{siteName}</p>
          <p className="text-slate-400">
            Email:{" "}
            <a href={`mailto:${contactEmail}`} className="underline" style={{ color: primary }}>{contactEmail}</a>
          </p>
          {companyAddress && <p className="text-slate-400">Address: {companyAddress}</p>}
        </div>
      </section>
    </div>
  );
}

export function TrackingPrivacyContent({
  siteName,
  contactEmail,
  companyAddress,
  primary,
}: {
  siteName: string;
  contactEmail: string;
  companyAddress: string;
  primary: string;
}) {
  return (
    <div className="space-y-10 text-sm leading-relaxed text-slate-300">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">1. Information we receive</h2>
        <p className="mb-3">
          When you use {siteName}, we may receive information needed to provide shipment visibility, including:
        </p>
        <ul className="ml-2 list-disc space-y-1.5 text-slate-400">
          <li>Tracking numbers and related shipment events.</li>
          <li>Contact details you choose to provide when requesting support.</li>
          <li>Basic device, browser, IP address, and security log information.</li>
          <li>Account information if you use customer or administrative features.</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">2. How we use information</h2>
        <p>
          We use information to display tracking results, maintain shipment timelines, respond to support requests,
          secure the service, diagnose errors, improve the customer experience, and comply with applicable obligations.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">3. Shipment information sharing</h2>
        <p>
          We do not sell tracking information. Information may be shared with authorized senders, carriers, logistics
          partners, service providers, or authorities when needed to provide the requested service, protect users,
          investigate misuse, or comply with law.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">4. Retention and security</h2>
        <p>
          We retain shipment and support information for as long as it is needed for delivery visibility, customer
          service, operational records, security, and legal requirements. Access controls, encrypted connections,
          and monitored systems help protect the information we hold, but no online service can guarantee absolute security.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">5. Cookies and your choices</h2>
        <p>
          Essential cookies or local storage may be used to keep the website working and remember temporary session
          state. You can control non-essential browser storage through your browser settings, although some features
          may not work correctly afterward.
        </p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">6. Contact us</h2>
        <p className="mb-3">
          To ask a privacy question or request access, correction, or deletion where applicable, contact {siteName}:
        </p>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-5">
          <p className="font-semibold text-white">{siteName} — Privacy</p>
          <p className="text-slate-400">
            Email:{" "}
            <a href={`mailto:${contactEmail}`} className="underline" style={{ color: primary }}>{contactEmail}</a>
          </p>
          {companyAddress && <p className="text-slate-400">Address: {companyAddress}</p>}
        </div>
      </section>
    </div>
  );
}