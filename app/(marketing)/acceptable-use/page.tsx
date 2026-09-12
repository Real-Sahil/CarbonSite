export const metadata = {
  title: "Acceptable Use Policy | MetricOra",
  description: "MetricOra Acceptable Use Policy governing permitted and prohibited uses of the platform.",
};

export default function AcceptableUsePage() {
  return (
    <div className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Acceptable Use Policy</h1>
          <p className="mt-4 text-lg text-gray-600">Last updated: September 2026</p>
          <p className="mt-2 text-sm text-gray-500">
            This Acceptable Use Policy ("AUP") applies to all users of the MetricOra platform and
            services, including web and mobile applications. Use of the platform constitutes
            acceptance of this policy.
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Permitted Uses</h2>
            <p>MetricOra is designed for:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Recording and calculating greenhouse gas emissions in accordance with recognised standards (GHG Protocol, DEFRA, ISO 14064).</li>
              <li>Generating sustainability disclosures and reports for internal and external stakeholders.</li>
              <li>Managing supply chain and field-worker emissions data.</li>
              <li>Conducting biodiversity net gain assessments and ecology surveys.</li>
              <li>Monitoring environmental compliance obligations.</li>
              <li>Assurance and audit workflows in connection with sustainability disclosures.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">2. Prohibited Uses</h2>
            <p>You must not use MetricOra to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Falsify, misrepresent, or fraudulently manipulate emissions data or calculations.</li>
              <li>Upload or process data you do not have the right to use.</li>
              <li>Attempt to gain unauthorised access to another organisation's data or accounts.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the platform.</li>
              <li>Use the platform to transmit malicious code, viruses, or disruptive data.</li>
              <li>Engage in automated scraping, crawling, or data harvesting not expressly permitted by the API terms.</li>
              <li>Attempt to circumvent any security or access controls.</li>
              <li>Use the platform for any unlawful purpose, including violations of environmental reporting regulations.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any organisation.</li>
              <li>Interfere with the integrity or performance of the platform or its underlying infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">3. Data Accuracy and Integrity</h2>
            <p>
              Users are responsible for the accuracy of data they upload or enter into the platform.
              MetricOra calculates emissions figures based on data provided by users and the emission
              factor libraries configured in the platform. MetricOra does not independently verify
              the accuracy of source data submitted by users.
            </p>
            <p className="mt-4">
              Knowingly uploading false or manipulated data for the purpose of creating misleading
              emissions disclosures is a serious breach of this policy and may constitute a breach of
              applicable financial reporting or environmental regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">4. Account Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials.
              You must notify MetricOra immediately at{" "}
              <a href="mailto:security@metricora.com" className="text-orange-600 hover:underline">
                security@metricora.com
              </a>{" "}
              if you become aware of any unauthorised use of your account.
            </p>
            <p className="mt-4">
              Organisation administrators are responsible for managing user access within their
              organisation and must promptly revoke access for any user who no longer requires it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">5. Field Worker and Mobile App Use</h2>
            <p>
              Field workers using the MetricOra mobile application must only submit data for
              projects and organisations they are authorised to work with. Invitation links are
              personal and must not be shared with unauthorised parties. Device PINs protect access
              to the application and must be kept confidential.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. API Use</h2>
            <p>
              Access to MetricOra APIs is subject to rate limits documented in the developer portal.
              API keys are credentials and must be treated with the same care as passwords. Automated
              processes using the API must respect rate limits and must not attempt to bypass
              platform controls.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">7. Consequences of Violation</h2>
            <p>
              MetricOra reserves the right to investigate suspected violations of this policy and
              may, without prior notice: suspend or terminate access to the platform; remove content
              that violates this policy; report violations to relevant authorities where required by
              law. MetricOra's decisions regarding enforcement of this policy are final.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Reporting Violations</h2>
            <p>
              If you become aware of any use of MetricOra that violates this policy, please report
              it to{" "}
              <a href="mailto:security@metricora.com" className="text-orange-600 hover:underline">
                security@metricora.com
              </a>
              . We take all reports seriously and will investigate promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">9. Updates to This Policy</h2>
            <p>
              MetricOra may update this AUP from time to time. We will notify account administrators
              of material changes by email. Continued use of the platform following notification
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">10. Governing Law</h2>
            <p>
              This AUP is governed by the laws of England and Wales. This policy should be read
              alongside our{" "}
              <a href="/terms" className="text-orange-600 hover:underline">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" className="text-orange-600 hover:underline">Privacy Policy</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
