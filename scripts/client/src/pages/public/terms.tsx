import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { publicInfo } from "@/lib/portal-api";
import { ArrowLeft, FileText } from "lucide-react";
import { PublicSiteFooter } from "@/pages/public/site-info";
import { TrackingTermsContent } from "@/pages/public/tracking-content";
import { getPublicLegalProfile } from "@/pages/public/legal-content";

interface Props { params: { websiteUid: string } }

export default function TermsPage({ params }: Props) {
  const { websiteUid } = params;

  const { data: site } = useQuery({
    queryKey: ["public-info", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });

  const siteName = site?.name ?? "Our Platform";
  const contactEmail = site?.companyEmail ?? site?.supportEmail ?? "legal@platform.com";
  const companyAddress = site?.companyAddress ?? "";
  const launchDate = site?.launchDate ?? new Date().getFullYear().toString();
  const primary = site?.primaryColor ?? "#2563eb";
  const isTrackingWebsite = site?.type === "tracking";
  const legalProfile = getPublicLegalProfile(site);

  return (
    <div className="min-h-screen bg-[#06090f] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.07] sticky top-0 z-50 backdrop-blur-md bg-[#06090f]/90">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link
            href={`/site/${websiteUid}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {siteName}
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        {/* Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: primary + "22" }}>
              <FileText className="w-5 h-5" style={{ color: primary }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Terms &amp; Conditions</h1>
              <p className="text-slate-400 text-sm mt-0.5">{siteName} — Effective as of {launchDate}</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mt-4">
            {isTrackingWebsite
              ? `Please read these Terms and Conditions carefully before using ${siteName} shipment tracking and related support features.`
              : `Please read these Terms and Conditions carefully before using ${siteName} ${legalProfile.serviceName}. By accessing or using our services, you agree to be bound by these terms. If you disagree with any part of these terms, you may not use our services.`}
          </p>
        </div>

        {isTrackingWebsite ? (
          <TrackingTermsContent
            siteName={siteName}
            contactEmail={contactEmail}
            companyAddress={companyAddress}
            primary={primary}
          />
        ) : (
          <div className="space-y-10 text-slate-300 text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By registering for an account, accessing, or using {siteName} (the "Platform"), you acknowledge that you have read,
              understood, and agree to be bound by these Terms and Conditions ("Terms") and our Privacy Policy. These Terms apply
              to all visitors, users, and others who access or use the Platform.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>{legalProfile.eligibility} By using our services, you represent that you meet these requirements. {siteName} reserves the right to refuse or limit service where permitted by law.</p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Registration</h2>
            <p className="mb-3">
              To access certain features of the Platform, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400 ml-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password confidential and not share it with third parties</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Permitted Use</h2>
            <p className="mb-3">
              You agree to use the Platform only for lawful purposes and in accordance with these Terms. You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400 ml-2">
              <li>Violate any applicable local, national, or international laws or regulations</li>
              <li>Transmit any unsolicited or unauthorized advertising or promotional material</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
              <li>Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Platform</li>
              <li>Attempt to gain unauthorized access to any portion of the Platform or its related systems</li>
              <li>Use the Platform for fraud, abuse, unauthorized access, or any unlawful purpose</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. {legalProfile.serviceTermsTitle}</h2>
            <p className="mb-3">{legalProfile.serviceTermsBody} You acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400 ml-2">
              {legalProfile.serviceTermsItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Identity &amp; Account Security</h2>
            <p>
              {legalProfile.hasKyc
                ? "We may require identity verification (Know Your Customer / KYC) for services where it is enabled or required by law. You agree to provide accurate information and documents when requested. Failure to complete verification may restrict access to the affected service."
                : "Keep your account credentials and any service information confidential. Do not attempt to access another person's account or information, and notify us promptly if you believe your account or service information has been used without authorization."}
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Fees &amp; Charges</h2>
            <p>
              Certain services on the Platform may be subject to fees. All applicable fees will be disclosed before you complete
              a transaction. We reserve the right to modify our fee structure at any time, with reasonable notice provided to users.
              You are responsible for any taxes applicable to transactions you make through the Platform.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>
              The Platform and its original content, features, and functionality are owned by {siteName} and are protected by
              applicable intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our services
              or included software without our express written permission.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided on an "AS IS" and "AS AVAILABLE" basis without any warranties of any kind, either express
              or implied. To the fullest extent permitted by law, {siteName} disclaims all warranties, including but not limited to
              implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that
              the Platform will be uninterrupted, error-free, or completely secure.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, {siteName} shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages — including but not limited to loss of profits, data, use, or goodwill —
              arising out of or in connection with your use of the Platform, even if we have been advised of the possibility of
              such damages.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Account Suspension &amp; Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account and access to the Platform at our sole discretion, without
              notice, for conduct that we believe violates these Terms or is harmful to other users, third parties, or the interests
              of {siteName}. Upon termination, your right to use the Platform will immediately cease.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Privacy</h2>
            <p>
              Your use of the Platform is also governed by our{" "}
              <Link href={`/site/${websiteUid}/privacy`} className="underline hover:text-white transition-colors" style={{ color: primary }}>
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. By using the Platform, you consent to our collection and use
              of your information as described in the Privacy Policy.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating
              the date at the top of this page. Your continued use of the Platform after changes are posted constitutes your
              acceptance of the revised Terms.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws and regulations. Any disputes
              arising under these Terms shall be resolved through appropriate legal channels, and you consent to the exclusive
              jurisdiction of the applicable courts.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">15. Contact Us</h2>
            <p className="mb-3">
              If you have any questions about these Terms and Conditions, please contact us:
            </p>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 space-y-1.5">
              <p className="font-semibold text-white">{siteName}</p>
              {contactEmail && <p className="text-slate-400">Email: <a href={`mailto:${contactEmail}`} className="underline hover:text-white" style={{ color: primary }}>{contactEmail}</a></p>}
              {companyAddress && <p className="text-slate-400">Address: {companyAddress}</p>}
            </div>
          </section>
          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-14 pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href={`/site/${websiteUid}`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {siteName}
          </Link>
          <Link
            href={`/site/${websiteUid}/privacy`}
            className="text-sm hover:text-white transition-colors"
            style={{ color: primary }}
          >
            Privacy Policy →
          </Link>
        </div>
      </main>

      <PublicSiteFooter
        siteName={siteName}
        websiteUid={websiteUid}
        primary={primary}
        websiteType={site?.type}
        description={`Legal information for ${siteName}.`}
      />
    </div>
  );
}
