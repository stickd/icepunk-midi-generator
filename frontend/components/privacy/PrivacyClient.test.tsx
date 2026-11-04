import { fireEvent, render, screen } from "@testing-library/react";
import { ConsentProvider } from "./ConsentProvider";
import CookieConsent from "./CookieConsent";
import { GoogleAnalytics } from "./PrivacyClient";

jest.mock("next/script", () => ({ __esModule: true, default: (props: { id: string }) => <script data-testid={props.id} /> }));
jest.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

function renderConsent() {
  return render(<ConsentProvider><GoogleAnalytics /><CookieConsent /></ConsentProvider>);
}

describe("analytics consent", () => {
  beforeEach(() => { window.localStorage.clear(); process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST"; });

  it("does not inject Google Analytics before a choice or after reject", () => {
    renderConsent();
    expect(screen.queryByTestId("icepunk-ga")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reject optional" }));
    expect(screen.queryByTestId("icepunk-ga")).not.toBeInTheDocument();
  });

  it("loads analytics only after explicit acceptance", () => {
    renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Accept analytics" }));
    expect(screen.getByTestId("icepunk-ga")).toBeInTheDocument();
  });
});
