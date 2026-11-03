import { render, screen } from "@testing-library/react";
import DesktopPage from "./page";

test("shows the desktop waitlist and returns to the studio", () => {
  render(<DesktopPage />);
  expect(screen.getByRole("heading", { name: /colder, closer way to make MIDI/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /ideas, without the web limit/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /ICEPUNK desktop MIDI generator/i })).toHaveAttribute("src", expect.stringContaining("icepunk-desktop-preview.png"));
  expect(screen.getByRole("link", { name: /open web studio/i })).toHaveAttribute("href", "/#workspace");
  expect(screen.getByRole("heading", { name: /get desktop first/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /join waitlist/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /use the web midi generator/i })).toHaveAttribute("href", "/#workspace");
});
