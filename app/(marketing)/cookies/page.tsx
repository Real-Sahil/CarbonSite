export const metadata = {
  title: "Cookie Policy | MetricOra",
  description: "Information about how MetricOra uses cookies.",
};

export default function CookiesPage() {
  return (
    <div className="bg-white py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Cookie Policy</h1>
          <p className="mt-4 text-lg text-gray-600">
            Last updated: August 2026
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Overview</h2>
            <p>
              MetricOra uses cookies and similar technologies to provide, secure,
              and improve our platform. This policy explains what cookies we use,
              why we use them, and your options.
            </p>
            <p className="mt-4 bg-blue-50 p-4 rounded border-l-4 border-blue-600">
              <strong>Key Point (PECR):</strong> MetricOra does not use
              non-essential tracking or marketing cookies. The cookies below are
              strictly necessary for authentication and service delivery. No
              consent is required under PECR for these essential cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              2. Essential Cookies
            </h2>
            <p>
              These cookies are required for the platform to function and cannot
              be disabled:
            </p>
            <table className="w-full border-collapse border border-gray-300 mt-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Cookie Name
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Purpose
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      better-auth.session_token
                    </code>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Session authentication. Stores encrypted session token for
                    user identity and permissions.
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    7 days (or when logged out)
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      next-auth.csrf-token
                    </code>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Cross-Site Request Forgery (CSRF) protection. Prevents
                    unauthorized actions from external sites.
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Session
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              3. Non-Essential Cookies
            </h2>
            <p>
              MetricOra does <strong>not</strong> currently use:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Analytics cookies (Google Analytics, Mixpanel, etc.)</li>
              <li>Tracking pixels or third-party marketing tags</li>
              <li>Advertising or retargeting cookies</li>
              <li>Preference cookies for UI personalization</li>
            </ul>
            <p className="mt-4">
              If we introduce optional analytics in the future, we will:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Display an explicit consent banner</li>
              <li>Allow users to opt-out at any time</li>
              <li>Not use cookies for behavioral tracking across sites</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              4. Similar Technologies
            </h2>
            <p>
              In addition to cookies, we may use:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>Local Storage:</strong> Stores non-sensitive preferences
                (theme, sidebar state) on your browser
              </li>
              <li>
                <strong>Session Storage:</strong> Temporary session state (form
                drafts, active tabs)
              </li>
            </ul>
            <p className="mt-4">
              These technologies are not used for tracking or advertising.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              5. Your Options
            </h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-4">
              5.1 Browser Controls
            </h3>
            <p>
              You can control cookies at the browser level. Most modern browsers
              allow you to:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>View cookies set by a site</li>
              <li>Delete cookies</li>
              <li>
                Block cookies by default or per-site (though this may break
                authentication)
              </li>
            </ul>
            <p className="mt-4">
              <strong>Warning:</strong> Disabling essential session cookies will
              log you out and prevent you from using the platform.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mt-6">
              5.2 Do Not Track (DNT)
            </h3>
            <p>
              MetricOra respects the "Do Not Track" header. Since we do not
              perform tracking, DNT settings do not affect our operations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              6. Third-Party Services
            </h2>
            <p>
              Some MetricOra features integrate with third-party services that
              may set their own cookies:
            </p>
            <table className="w-full border-collapse border border-gray-300 mt-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Service
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Purpose
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Cookie Policy
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    Sentry (Error Tracking)
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Captures error logs for debugging (optional, server-side)
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <a
                      href="https://sentry.io/privacy/"
                      className="text-blue-600 hover:text-blue-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sentry Privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    Vercel (Hosting)
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    Analytics on platform performance (does not track users)
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <a
                      href="https://vercel.com/privacy"
                      className="text-blue-600 hover:text-blue-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Vercel Privacy
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">
              7. Changes to This Policy
            </h2>
            <p>
              We may update this policy if we introduce new cookie types. We will
              notify users of material changes and request consent where required
              by PECR.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Contact</h2>
            <p>
              Questions about cookies? Email{" "}
              <a
                href="mailto:privacy@metricora.io"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                privacy@metricora.io
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
