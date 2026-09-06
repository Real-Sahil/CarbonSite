export const metadata = {
  title: "Privacy Policy | MetricOra",
  description: "How MetricOra collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-4 text-lg text-gray-600">
            Last updated: August 2026
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Overview</h2>
            <p>
              MetricOra ("we," "us," "our," or "Company") respects your privacy
              and is committed to protecting your personal data. This Privacy
              Policy explains how we collect, use, disclose, and safeguard your
              data in compliance with the UK Data Protection Act 2018 (DPA 2018),
              UK GDPR, and Privacy and Electronic Communications Regulations (PECR).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              2. Data We Collect
            </h2>
            <h3 className="text-xl font-semibold text-gray-900">
              2.1 Information You Provide
            </h3>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>Account & Auth:</strong> Email address, password hash,
                name, two-factor authentication setup
              </li>
              <li>
                <strong>Organization Data:</strong> Company name, industry,
                HQ country, reporting currency, organizational structure
              </li>
              <li>
                <strong>Emissions Data:</strong> Activity records, quantities,
                units, dates, supplier names, facility locations
              </li>
              <li>
                <strong>Location Data:</strong> UK postcodes (pickups/deliveries),
                GPS coordinates for field submissions, facility addresses
              </li>
              <li>
                <strong>Evidence:</strong> Files you upload (utility bills, invoices,
                delivery notes, photographs)
              </li>
            </ul>
            <h3 className="mt-6 text-xl font-semibold text-gray-900">
              2.2 Information Collected Automatically
            </h3>
            <ul className="list-inside list-disc space-y-2">
              <li>IP address, user agent, session timestamps</li>
              <li>Audit log entries: actions, resource IDs, timestamps</li>
              <li>
                Device tokens for push notifications (Flutter mobile app)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">3. Legal Basis</h2>
            <p>We process your personal data under the following legal bases:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>Contract:</strong> Providing emissions tracking and
                reporting services
              </li>
              <li>
                <strong>Legal Obligation:</strong> Regulatory reporting, audit log
                retention, data subject request (DSAR) compliance
              </li>
              <li>
                <strong>Legitimate Interest:</strong> Security, fraud prevention,
                service improvement
              </li>
              <li>
                <strong>Consent:</strong> Marketing emails (PECR), optional analytics
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">4. Data Retention</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Data Category
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Retention Period
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    Activity Records (emissions data)
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    7 years (post-calculation)
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    Audit Logs
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    5 years (anonymized after Phase 5)
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    GPS / Postcode Data
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Stored encrypted; retained per calculation retention
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    User Sessions
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    7 days (web); JWT refresh per mobile app settings
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    Evidence Files
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Retained with linked activity record
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              5. Data Sharing & Sub-processors
            </h2>
            <p>
              We share your data with trusted partners to deliver the service:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>Neon (Postgres):</strong> Database hosting (EU/EEA region)
              </li>
              <li>
                <strong>Cloudflare R2:</strong> Object storage for evidence files
                (zero-egress CDN)
              </li>
              <li>
                <strong>Resend:</strong> Transactional email delivery
              </li>
              <li>
                <strong>Firebase Cloud Messaging (FCM):</strong> Push notifications
                (Flutter mobile app)
              </li>
              <li>
                <strong>Vercel:</strong> Hosting and deployment platform
              </li>
              <li>
                <strong>postcodes.io:</strong> UK postcode geocoding (publicly
                available data)
              </li>
              <li>
                <strong>OSRM:</strong> Route distance calculations (open-source
                mapping service)
              </li>
            </ul>
            <p className="mt-4">
              All sub-processors are confirmed DPA-compliant. We do not sell or
              rent your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              6. Encryption & Security
            </h2>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>In Transit:</strong> TLS 1.3+ for all data transmission
              </li>
              <li>
                <strong>At Rest:</strong> Database encryption via Neon; application-level
                AES-256-GCM encryption for sensitive PII (postcodes, GPS)
              </li>
              <li>
                <strong>Access Control:</strong> Role-based access control (RBAC);
                org-scoped queries enforced server-side
              </li>
              <li>
                <strong>Audit Trail:</strong> Tamper-evident audit log with
                SHA-256 hash chaining for integrity verification
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              7. Your Data Rights
            </h2>
            <p>Under UK GDPR and DPA 2018, you have the right to:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>Access (Art. 15):</strong> Request a copy of your
                personal data
              </li>
              <li>
                <strong>Rectification (Art. 16):</strong> Correct inaccurate data
              </li>
              <li>
                <strong>Erasure (Art. 17):</strong> Request deletion (subject to
                legal retention obligations)
              </li>
              <li>
                <strong>Portability (Art. 20):</strong> Receive data in a
                machine-readable format
              </li>
              <li>
                <strong>Object (Art. 21):</strong> Opt-out of processing where
                lawful
              </li>
              <li>
                <strong>Restrict Processing (Art. 18):</strong> Suspend processing
                during dispute
              </li>
            </ul>
            <p className="mt-4">
              To exercise these rights, email{" "}
              <a
                href="mailto:privacy@metricora.co.uk"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                privacy@metricora.co.uk
              </a>
              . We respond within 30 days (may extend to 60–90 days for complex
              requests per Art. 12). No fee is charged unless your request is
              manifestly unfounded.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              8. International Transfers
            </h2>
            <p>
              Your data is primarily stored in the UK/EEA (Neon Postgres). Where
              data is transferred outside the UK/EEA (e.g., to Vercel global CDN
              or Firebase in the US), we rely on Standard Contractual Clauses
              (SCCs) and Adequacy Decisions as permitted by UK GDPR Schedule 4.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              9. Data Breach Notification
            </h2>
            <p>
              If a personal data breach occurs, we will notify affected
              individuals and the UK Information Commissioner's Office (ICO)
              without undue delay and no later than 72 hours after becoming aware
              of the breach, as required by Article 33 GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              10. Contact & Complaints
            </h2>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>Data Protection Officer / Privacy Queries:</strong>{" "}
                <a
                  href="mailto:privacy@metricora.co.uk"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  privacy@metricora.co.uk
                </a>
              </li>
              <li>
                <strong>Complaints to ICO:</strong>{" "}
                <a
                  href="https://ico.org.uk"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ico.org.uk
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              11. Changes to Policy
            </h2>
            <p>
              We may update this policy to reflect legal, regulatory, or
              operational changes. Material changes will be communicated via email
              or in-app notification at least 30 days before taking effect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
