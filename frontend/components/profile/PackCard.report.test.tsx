import { render, screen } from "@testing-library/react";
import PackCard from "./PackCard";
jest.mock("@/components/sketch/BrowserPianoRoll", () => ({ __esModule: true, default: () => null }));

test("public profile upload card exposes Report", () => {
  render(<PackCard pack={{ id: 1, ownerId: 2, ownerUsername: "owner", title: "Public upload", midiUrl: "/midi", sampleUrl: null, uploadedAt: "2026-01-01", metadata: {}, downloadCount: 0, likeCount: 0, likedByViewer: false }} token={null} onAuthRequired={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
});
