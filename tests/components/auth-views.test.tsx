import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuthFrame } from "@/components/shell/auth-frame";
import { LocationBlocked } from "@/components/views/auth/location-blocked";
import { SetPasswordForm } from "@/components/views/auth/set-password-form";
import { SignInForm } from "@/components/views/auth/sign-in-form";
import { WelcomeCamera } from "@/components/views/auth/welcome-camera";
import { WelcomeLocation } from "@/components/views/auth/welcome-location";
import { getSetupLink } from "@/lib/ui/queries/auth";

describe("SignInForm", () => {
  const html = renderToStaticMarkup(<SignInForm mock />);

  it("labels both fields and sets phone-friendly input attributes", () => {
    expect(html).toContain('for="signin-email"');
    expect(html).toContain('for="signin-password"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('inputMode="email"');
    expect(html).toContain('autoCapitalize="none"');
    expect(html).toContain('spellCheck="false"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html.match(/phone-field/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("offers show password and keep-signed-in, and no public sign-up", () => {
    expect(html).toContain('aria-label="Show password"');
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toContain("Sign in");
    expect(html).not.toMatch(/sign up|create account/i);
    expect(html).toContain("new setup link");
  });
});

describe("SetPasswordForm", () => {
  it("welcomes an intern and continues to first run", async () => {
    const link = await getSetupLink("demo-intern");
    const html = renderToStaticMarkup(<SetPasswordForm link={link} token="demo-intern" mock />);
    expect(html).toContain("Welcome, Rina");
    expect(html).toContain('value="rina.mendoza@school.edu.ph"');
    expect(html).toContain("readOnly");
    expect(html).toContain('autoComplete="new-password"');
    expect(html.match(/data-rule=/g)).toHaveLength(3);
    expect(html).toContain("Save and continue");
  });

  it("sends HR straight to the panel", async () => {
    const link = await getSetupLink("demo-hr");
    const html = renderToStaticMarkup(<SetPasswordForm link={link} token="demo-hr" mock />);
    expect(html).toContain("Save password and sign in");
  });

  it("explains an expired or broken link", async () => {
    expect(await getSetupLink("expired")).toBeNull();
    const html = renderToStaticMarkup(<SetPasswordForm link={null} token="expired" mock />);
    expect(html).toContain("This link has expired");
    expect(html).toContain("Ask HR");
  });
});

describe("AuthFrame", () => {
  it("shows the first-run step as a progress bar", () => {
    const html = renderToStaticMarkup(
      <AuthFrame variant="steps" step={2}>
        <p>x</p>
      </AuthFrame>,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain("Step 2 of 3");
  });
});

describe("first-run screens", () => {
  it("explains the camera before asking", () => {
    const html = renderToStaticMarkup(<WelcomeCamera />);
    expect(html).toContain("Allow the camera");
    expect(html.match(/data-promise/g)).toHaveLength(3);
    expect(html).toContain("Allow camera");
    expect(html).toContain('href="/welcome/location"');
  });

  it("explains location before asking, including precise location", () => {
    const html = renderToStaticMarkup(<WelcomeLocation />);
    expect(html).toContain("Allow location");
    expect(html.match(/data-promise/g)).toHaveLength(3);
    expect(html).toMatch(/precise location/i);
    expect(html).toContain('href="/dashboard"');
  });

  it("gives steps for both phones before the platform is known", () => {
    const html = renderToStaticMarkup(<LocationBlocked />);
    expect(html).toContain("Location is off");
    expect(html).toContain("Safari on iPhone");
    expect(html).toContain("Chrome on Android");
    expect(html).toContain("check again");
    expect(html).toContain('href="/dashboard"');
  });
});

describe("AuthFrame brand (desktop)", () => {
  it("adds the navy brand panel for wide screens", () => {
    const html = renderToStaticMarkup(
      <AuthFrame variant="brand">
        <p>x</p>
      </AuthFrame>,
    );
    expect(html).toContain("Scans, hours and corrections in one place");
    expect(html).toContain("Top Realty office · Asia/Manila");
  });

  it("takes page-specific panel copy", () => {
    const html = renderToStaticMarkup(
      <AuthFrame variant="brand" panel={{ title: "One step to finish your account", body: "Choose a password." }}>
        <p>x</p>
      </AuthFrame>,
    );
    expect(html).toContain("One step to finish your account");
  });
});
