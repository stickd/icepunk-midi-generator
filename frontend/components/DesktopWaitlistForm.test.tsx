import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DesktopWaitlistForm from "./DesktopWaitlistForm";

describe("DesktopWaitlistForm", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("submits a consented email to the existing contact endpoint", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<DesktopWaitlistForm />);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "producer@example.com" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Join waitlist" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/contact", expect.objectContaining({ method: "POST" })));
    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({
      email: "producer@example.com",
      feedbackType: "Desktop Waitlist",
    }));
    expect(await screen.findByText(/you.?re on the list/i)).toBeInTheDocument();
  });
});
