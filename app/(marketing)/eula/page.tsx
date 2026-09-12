export const metadata = {
  title: "End-User Licence Agreement | MetricOra",
  description: "MetricOra mobile application End-User Licence Agreement for iOS and Android.",
};

export default function EulaPage() {
  return (
    <div className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">End-User Licence Agreement</h1>
          <p className="mt-4 text-lg text-gray-600">Last updated: September 2026</p>
          <p className="mt-2 text-sm text-gray-500">
            This End-User Licence Agreement ("EULA") is a legal agreement between you ("End User")
            and MetricOra Ltd ("MetricOra", "we", "us") for use of the MetricOra mobile application
            ("App") available on Apple App Store and Google Play Store. Please read this EULA carefully
            before downloading or using the App.
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Grant of Licence</h2>
            <p>
              MetricOra grants you a limited, non-exclusive, non-transferable, revocable licence to
              install and use the App on any Apple- or Google-branded device that you own or control,
              solely for the purpose of accessing MetricOra's GHG emissions tracking and field data
              capture services, subject to the terms of this EULA and MetricOra's{" "}
              <a href="/terms" className="text-orange-600 hover:underline">Terms of Service</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">2. Restrictions</h2>
            <p>You may not:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Copy, modify, or distribute the App or any part of it.</li>
              <li>Reverse-engineer, decompile, or disassemble the App, except to the extent permitted by applicable law.</li>
              <li>Rent, lease, lend, sell, redistribute, or sublicence the App.</li>
              <li>Remove or alter any proprietary notices or labels on the App.</li>
              <li>Use the App to create a competing product or service.</li>
              <li>Use the App in any way that violates applicable law or MetricOra's{" "}
                <a href="/acceptable-use" className="text-orange-600 hover:underline">Acceptable Use Policy</a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">3. App Functionality</h2>
            <p>The MetricOra App enables field workers to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Photograph and capture waste tickets, delivery notes, and fuel receipts using the device camera.</li>
              <li>Use on-device OCR to extract data from captured documents.</li>
              <li>Submit environmental activity data to their assigned organisation's MetricOra account.</li>
              <li>Review the status of submitted records.</li>
            </ul>
            <p className="mt-4">
              Certain features require an active internet connection. The App stores data locally when
              offline and synchronises when a connection is available.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">4. Device Permissions</h2>
            <p>The App requires the following device permissions to function:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Camera:</strong> Required to photograph documents for OCR and data capture.</li>
              <li><strong>Location (optional):</strong> Used to geo-tag submissions, with your consent.</li>
              <li><strong>Storage/Files:</strong> Required to save captured images before submission.</li>
              <li><strong>Notifications:</strong> Used to inform you of submission status updates, with your consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">5. User Content</h2>
            <p>
              You retain ownership of any content you submit through the App ("User Content"). By
              submitting User Content, you grant MetricOra a limited licence to process, store, and
              display that content as necessary to provide the services to your organisation. Your
              organisation's MetricOra account administrator controls access to and retention of
              User Content submitted on behalf of their organisation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. Privacy</h2>
            <p>
              Use of the App is subject to MetricOra's{" "}
              <a href="/privacy" className="text-orange-600 hover:underline">Privacy Policy</a>,
              which explains how we collect, use, and protect your personal data. By using the App,
              you agree to the collection and use of data as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">7. Updates</h2>
            <p>
              MetricOra may from time to time develop updates, bug fixes, patches, or other
              enhancements to the App. These updates may be automatically installed without providing
              notice to you. You consent to such automatic updating. Continued use of the App
              following an update constitutes your acceptance of any changes to this EULA.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Termination</h2>
            <p>
              This licence is effective until terminated. Your rights under this EULA will terminate
              automatically if you fail to comply with any of its terms. Upon termination, you must
              cease all use of the App and delete all copies from your devices. MetricOra may also
              terminate this licence at any time by providing notice to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">9. Disclaimer of Warranties</h2>
            <p>
              The App is provided "as is" and "as available" without warranty of any kind. MetricOra
              does not warrant that the App will be uninterrupted, error-free, or free of viruses or
              other harmful components. To the maximum extent permitted by applicable law, MetricOra
              disclaims all warranties, express or implied, including warranties of merchantability,
              fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, MetricOra will not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from your use
              of the App, even if MetricOra has been advised of the possibility of such damages.
              MetricOra's total liability to you for any claim arising out of or relating to this EULA
              will not exceed the greater of (a) the amount you paid for the App, or (b) one hundred
              pounds sterling (£100).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">11. Third-Party Stores</h2>
            <p>
              This EULA is an agreement between you and MetricOra, not with Apple Inc. or Google LLC.
              Apple and Google are not responsible for the App or its content. In the event of any
              conflict between this EULA and the terms of the relevant app store, this EULA prevails
              to the extent permissible by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">12. Governing Law</h2>
            <p>
              This EULA is governed by the laws of England and Wales. Any disputes arising out of or
              in connection with this EULA shall be subject to the exclusive jurisdiction of the courts
              of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">13. Contact</h2>
            <p>
              For questions about this EULA, please contact{" "}
              <a href="mailto:legal@metricora.com" className="text-orange-600 hover:underline">
                legal@metricora.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
