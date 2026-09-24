import type { Metadata } from "next";
import { withSocial } from "@/lib/seo/page-meta";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = withSocial({
  title: "Cookie Policy",
  alternates: { canonical: "/cookies" },
  description: "Information about how MetricOra uses cookies.",
});

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Policy" updated="Last updated: August 2026">
          <section>
            <h2>1. Overview</h2>
            <p>
              MetricOra uses cookies and similar technologies to provide, secure,
              and improve our platform. This policy explains what cookies we use,
              why we use them, and your options.
            </p>
            <p>
              <strong>Key Point (PECR):</strong> MetricOra does not use
              non-essential tracking or marketing cookies. The cookies below are
              strictly necessary for authentication and service delivery. No
              consent is required under PECR for these essential cookies.
            </p>
          </section>

          <section>
            <h2>
              2. Essential Cookies
            </h2>
            <p>
              These cookies are required for the platform to function and cannot
              be disabled:
            </p>
            <table>
              <thead>
                <tr>
                  <th>
                    Cookie Name
                  </th>
                  <th>
                    Purpose
                  </th>
                  <th>
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>
                      better-auth.session_token
                    </code>
                  </td>
                  <td>
                    Session authentication. Stores encrypted session token for
                    user identity and permissions.
                  </td>
                  <td>
                    7 days (or when logged out)
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>
                      next-auth.csrf-token
                    </code>
                  </td>
                  <td>
                    Cross-Site Request Forgery (CSRF) protection. Prevents
                    unauthorized actions from external sites.
                  </td>
                  <td>
                    Session
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>
              3. Non-Essential Cookies
            </h2>
            <p>
              MetricOra does <strong>not</strong> currently use:
            </p>
            <ul>
              <li>Analytics cookies (Google Analytics, Mixpanel, etc.)</li>
              <li>Tracking pixels or third-party marketing tags</li>
              <li>Advertising or retargeting cookies</li>
              <li>Preference cookies for UI personalization</li>
            </ul>
            <p>
              If we introduce optional analytics in the future, we will:
            </p>
            <ul>
              <li>Display an explicit consent banner</li>
              <li>Allow users to opt-out at any time</li>
              <li>Not use cookies for behavioral tracking across sites</li>
            </ul>
          </section>

          <section>
            <h2>
              4. Similar Technologies
            </h2>
            <p>
              In addition to cookies, we may use:
            </p>
            <ul>
              <li>
                <strong>Local Storage:</strong> Stores non-sensitive preferences
                (theme, sidebar state) on your browser
              </li>
              <li>
                <strong>Session Storage:</strong> Temporary session state (form
                drafts, active tabs)
              </li>
            </ul>
            <p>
              These technologies are not used for tracking or advertising.
            </p>
          </section>

          <section>
            <h2>
              5. Your Options
            </h2>
            <h3>
              5.1 Browser Controls
            </h3>
            <p>
              You can control cookies at the browser level. Most modern browsers
              allow you to:
            </p>
            <ul>
              <li>View cookies set by a site</li>
              <li>Delete cookies</li>
              <li>
                Block cookies by default or per-site (though this may break
                authentication)
              </li>
            </ul>
            <p>
              <strong>Warning:</strong> Disabling essential session cookies will
              log you out and prevent you from using the platform.
            </p>
            <h3>
              5.2 Do Not Track (DNT)
            </h3>
            <p>
              MetricOra respects the "Do Not Track" header. Since we do not
              perform tracking, DNT settings do not affect our operations.
            </p>
          </section>

          <section>
            <h2>
              6. Third-Party Services
            </h2>
            <p>
              Some MetricOra features integrate with third-party services that
              may set their own cookies:
            </p>
            <table>
              <thead>
                <tr>
                  <th>
                    Service
                  </th>
                  <th>
                    Purpose
                  </th>
                  <th>
                    Cookie Policy
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Sentry (Error Tracking)
                  </td>
                  <td>
                    Captures error logs for debugging (optional, server-side)
                  </td>
                  <td>
                    <a
                      href="https://sentry.io/privacy/"
                     
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Sentry Privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    Vercel (Hosting)
                  </td>
                  <td>
                    Analytics on platform performance (does not track users)
                  </td>
                  <td>
                    <a
                      href="https://vercel.com/privacy"
                     
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
            <h2>
              7. Changes to This Policy
            </h2>
            <p>
              We may update this policy if we introduce new cookie types. We will
              notify users of material changes and request consent where required
              by PECR.
            </p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>
              Questions about cookies? Email{" "}
              <a
                href="mailto:privacy@metricora.co.uk"
               
              >
                privacy@metricora.co.uk
              </a>
            </p>
          </section>
    </LegalShell>
  );
}
