export const metadata = {
  title: "Terms of Service | MetricOra",
  description: "Legal terms governing your use of MetricOra.",
};

export default function TermsPage() {
  return (
    <div className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-4 text-lg text-gray-600">
            Last updated: August 2026
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using MetricOra, you accept and agree to be bound
              by the terms and provision of this agreement. If you do not agree to
              abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              2. License & Use Restrictions
            </h2>
            <p>
              MetricOra grants you a limited, non-exclusive, non-transferable
              license to use the platform for calculating and tracking greenhouse
              gas (GHG) emissions in accordance with this agreement.
            </p>
            <p className="mt-4">You agree NOT to:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                Reverse engineer, decompile, or attempt to discover the source code
              </li>
              <li>
                Remove, obscure, or alter any proprietary notice or label
              </li>
              <li>
                Use the platform for any unlawful purpose or in violation of any
                applicable laws
              </li>
              <li>
                Access the service via automated means (bots, scrapers) without
                written consent
              </li>
              <li>
                Attempt to gain unauthorized access to accounts, systems, or data
              </li>
              <li>
                Transmit malware, viruses, or any code of destructive nature
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              3. Accuracy of Data
            </h2>
            <p>
              <strong>You are responsible</strong> for the accuracy, legality, and
              non-infringing nature of all data you upload or enter. MetricOra
              does not independently verify emissions calculations or the validity
              of underlying activity data. You represent that:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                All activity records, quantities, and supporting evidence are true
                and complete to the best of your knowledge
              </li>
              <li>
                You have the right to provide emissions data (no confidentiality or
                IP violations)
              </li>
              <li>
                You have obtained necessary consents from suppliers and field
                workers for data submission
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              4. Calculation Methodology & Disclaimers
            </h2>
            <p>
              MetricOra uses published emission factors (DEFRA 2025, EPA GHG Hub
              2025, SustainMetrics) and the GHG Protocol framework. However:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>No Warranty:</strong> Calculations are provided "as-is"
                without warranty of accuracy, completeness, or fitness for a
                particular purpose
              </li>
              <li>
                <strong>Methodology Changes:</strong> Emission factors and
                methodologies may change; we update the platform periodically
              </li>
              <li>
                <strong>Third-Party Data:</strong> We rely on external services
                (postcodes.io, OSRM, geocoding) which may have errors or
                limitations
              </li>
              <li>
                <strong>Professional Advice:</strong> MetricOra is not a
                substitute for professional environmental or accounting advice
              </li>
              <li>
                <strong>Regulatory Compliance:</strong> You are responsible for
                ensuring your GHG reporting complies with applicable regulations
                (CSRD, TCFD, CDP, etc.)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              5. Intellectual Property Rights
            </h2>
            <p>
              MetricOra retains all right, title, and interest in the platform,
              software, features, and functionality. Your data and uploaded evidence
              files remain your property; we use them only to provide the service.
            </p>
            <p className="mt-4">
              You grant us a limited license to store, process, and display your
              data within your organization and to authorized auditors/regulators
              as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              6. Limitation of Liability
            </h2>
            <p>
              <strong>
                TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL
                METRICORA, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE
                LIABLE FOR:
              </strong>
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                Indirect, incidental, special, consequential, or punitive damages
              </li>
              <li>
                Loss of profits, revenue, data, or business opportunity
              </li>
              <li>
                Errors, omissions, or inaccuracies in calculations
              </li>
              <li>
                Regulatory fines, penalties, or reputational harm arising from
                your use of the platform
              </li>
              <li>
                Third-party claims related to data you provided
              </li>
            </ul>
            <p className="mt-4">
              Our total liability for any claim arising under this agreement shall
              not exceed the fees paid by you in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              7. Indemnification
            </h2>
            <p>
              You agree to defend, indemnify, and hold harmless MetricOra from
              any claims, damages, or costs (including legal fees) arising from:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Your use or misuse of the platform</li>
              <li>Data you upload or activities you record</li>
              <li>Your violation of these terms or applicable laws</li>
              <li>
                Infringement of third-party rights by content you provide
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              8. Service Availability & Uptime
            </h2>
            <p>
              MetricOra operates on a best-effort basis. We do not guarantee
              uninterrupted service. Scheduled maintenance, unforeseeable outages,
              or third-party service interruptions may affect availability.
            </p>
            <p className="mt-4">
              In the event of an outage affecting data access for more than 24
              hours, we will use commercially reasonable efforts to restore service
              and provide a status update.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              9. Data Loss & Backup Responsibility
            </h2>
            <p>
              While we maintain backups, <strong>you remain responsible</strong>{" "}
              for maintaining independent copies of critical data. We are not liable
              for data loss due to:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Your deletion or modification of records</li>
              <li>Service outages or data center incidents</li>
              <li>Accidental or intentional misuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              10. Account Security & Passwords
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your login
              credentials. You agree to:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Use a strong, unique password</li>
              <li>Enable two-factor authentication when available</li>
              <li>
                Immediately notify us of any unauthorized access or security breach
              </li>
              <li>Not share credentials with unauthorized parties</li>
            </ul>
            <p className="mt-4">
              We are not liable for unauthorized access resulting from your failure
              to secure your credentials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              11. Termination
            </h2>
            <p>
              Either party may terminate this agreement at any time with 30 days
              written notice. Upon termination:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Your access to the platform is revoked</li>
              <li>
                Your data will be retained per our retention schedule (see Privacy
                Policy)
              </li>
              <li>You remain liable for fees accrued through termination date</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              12. Governing Law & Jurisdiction
            </h2>
            <p>
              These terms are governed by the laws of England and Wales. Both
              parties consent to the exclusive jurisdiction of the courts of
              England and Wales for any disputes arising from this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              13. Entire Agreement
            </h2>
            <p>
              These terms, together with our Privacy Policy and any other
              agreements you sign, constitute the entire agreement between you and
              MetricOra. No oral modifications or side agreements are valid unless
              in writing and signed by both parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              14. Severability
            </h2>
            <p>
              If any provision of these terms is found invalid or unenforceable, it
              will be reformed to the minimum extent necessary; all other provisions
              remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">15. Contact</h2>
            <p>
              Questions about these terms? Email{" "}
              <a
                href="mailto:legal@metricora.io"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                legal@metricora.io
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
