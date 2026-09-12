export const metadata = {
  title: "Data Processing Agreement | MetricOra",
  description: "MetricOra Data Processing Agreement under UK GDPR Article 28.",
};

export default function DpaPage() {
  return (
    <div className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Data Processing Agreement</h1>
          <p className="mt-4 text-lg text-gray-600">Last updated: September 2026</p>
          <p className="mt-2 text-sm text-gray-500">
            This Data Processing Agreement ("DPA") forms part of the Terms of Service between you
            ("Controller") and MetricOra Ltd ("Processor") and is incorporated by reference into those
            Terms. It satisfies the requirements of UK GDPR Article 28.
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Definitions</h2>
            <p>
              "Personal Data", "Processing", "Controller", "Processor", "Data Subject",
              "Supervisory Authority", and "Special Category Data" have the meanings given in UK GDPR.
              "Services" means the MetricOra platform and related services described in the Terms of
              Service. "Sub-processor" means any third party engaged by MetricOra to process Personal
              Data on the Controller's behalf.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">2. Scope and Role of the Parties</h2>
            <p>
              The Controller determines the purposes and means of Processing Personal Data. MetricOra
              acts as Processor and Processes Personal Data solely on the Controller's documented
              instructions, including those set out in this DPA and the Terms of Service, except where
              required to do so by UK law, in which case MetricOra will inform the Controller before
              Processing unless prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">3. Details of Processing</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Subject matter:</strong> Provision of the MetricOra GHG emissions tracking platform.</li>
              <li><strong>Duration:</strong> For the term of the subscription and as required for legal compliance thereafter.</li>
              <li><strong>Nature and purpose:</strong> Hosting, storing, and processing environmental and business data submitted by the Controller to generate calculations, reports, and analytics.</li>
              <li><strong>Types of Personal Data:</strong> Names, email addresses, job titles, device identifiers, IP addresses, and any Personal Data contained in documents uploaded by the Controller.</li>
              <li><strong>Categories of Data Subjects:</strong> The Controller's employees, contractors, field workers, and authorised users of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">4. Processor Obligations</h2>
            <p>MetricOra will:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Process Personal Data only on the Controller's documented instructions.</li>
              <li>Ensure that persons authorised to process Personal Data are bound by confidentiality obligations.</li>
              <li>Implement appropriate technical and organisational measures as described in clause 5.</li>
              <li>Assist the Controller in fulfilling its obligations to respond to Data Subject requests.</li>
              <li>Assist the Controller with Data Protection Impact Assessments where required.</li>
              <li>Delete or return all Personal Data to the Controller upon termination of the Services, at the Controller's choice, unless retention is required by applicable law.</li>
              <li>Make available all information necessary to demonstrate compliance with this DPA and allow for audits by the Controller or a mandated auditor, subject to reasonable notice and confidentiality obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">5. Security Measures</h2>
            <p>
              MetricOra implements and maintains appropriate technical and organisational measures to
              protect Personal Data against accidental or unlawful destruction, loss, alteration,
              unauthorised disclosure or access. These measures include, at minimum:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Encryption of Personal Data in transit (TLS 1.2+) and at rest (AES-256).</li>
              <li>Pseudonymisation where appropriate.</li>
              <li>Regular testing and evaluation of the effectiveness of security measures.</li>
              <li>Role-based access controls limiting access to Personal Data to authorised personnel only.</li>
              <li>Audit logging of access to and modifications of Personal Data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. Sub-processors</h2>
            <p>
              The Controller grants MetricOra general written authorisation to engage Sub-processors.
              MetricOra will: (a) impose equivalent data protection obligations on each Sub-processor;
              (b) notify the Controller of any intended changes to Sub-processors, giving the Controller
              an opportunity to object. Current Sub-processors include:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Supabase Inc.</strong> (PostgreSQL database hosting) - USA/EU</li>
              <li><strong>Cloudflare, Inc.</strong> (object storage via R2) - USA</li>
              <li><strong>Resend, Inc.</strong> (transactional email delivery) - USA</li>
              <li><strong>Google LLC</strong> (Firebase Cloud Messaging for push notifications) - USA</li>
              <li><strong>Vercel, Inc.</strong> (application hosting) - USA</li>
            </ul>
            <p>
              Where Sub-processors are located outside the UK, MetricOra ensures appropriate safeguards
              are in place, including reliance on the UK International Data Transfer Agreement (IDTA)
              or UK Addendum to the EU Standard Contractual Clauses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">7. Data Subject Rights</h2>
            <p>
              MetricOra will, to the extent legally permitted, promptly notify the Controller of any
              Data Subject request received directly and will not respond to such requests without the
              Controller's prior written consent, except to confirm that such request relates to the
              Controller. MetricOra will provide reasonable assistance to the Controller to fulfil its
              obligations in relation to Data Subject rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Personal Data Breach</h2>
            <p>
              MetricOra will notify the Controller without undue delay, and no later than 72 hours,
              after becoming aware of a Personal Data Breach affecting the Controller's data. The
              notification will include, where possible, the categories and approximate number of
              Data Subjects concerned, a description of the likely consequences, and measures taken
              or proposed to address the breach.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">9. Deletion and Return of Data</h2>
            <p>
              Upon termination or expiry of the Services, MetricOra will, at the Controller's choice,
              delete or return all Personal Data and delete existing copies, unless UK law requires
              storage. The Controller may request deletion at any time during the subscription term
              via the account settings or by contacting privacy@metricora.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">10. Governing Law</h2>
            <p>
              This DPA is governed by the laws of England and Wales. Any disputes arising out of or in
              connection with this DPA shall be subject to the exclusive jurisdiction of the courts of
              England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">11. Contact</h2>
            <p>
              MetricOra Ltd is the data controller for its own business operations and data processor
              for Customer data. For data protection enquiries, contact our Data Protection Officer at{" "}
              <a href="mailto:privacy@metricora.com" className="text-orange-600 hover:underline">
                privacy@metricora.com
              </a>
              . Registered office: England and Wales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
