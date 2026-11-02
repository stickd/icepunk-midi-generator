import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportAction from "./ReportAction";
import { submitContentReport, TOKEN_KEY } from "@/lib/api";
jest.mock("@/lib/api", () => ({ submitContentReport: jest.fn(), TOKEN_KEY: "icepunk_token" }));
const submit = jest.mocked(submitContentReport);
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); localStorage.setItem(TOKEN_KEY, "test-token"); });

test.each(["GENERATED_PACK", "UPLOAD"] as const)("public %s can be reported with optional description", async targetType => {
  submit.mockResolvedValue({ status: 202 } as Response);
  render(<ReportAction targetType={targetType} targetId="42" isPublic />);
  fireEvent.click(screen.getByRole("button", { name: "Report" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText("Reason")).toBeRequired();
  expect(screen.getByLabelText("Description (optional)")).toHaveAttribute("maxlength", "2000");
  fireEvent.submit(screen.getByRole("button", { name: "Submit report" }).closest("form")!);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "COPYRIGHT" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
  await screen.findByText("Report submitted.");
  expect(submit).toHaveBeenCalledWith({ targetType, targetId: "42", category: "COPYRIGHT", description: undefined }, "test-token");
});

test("private content has no report action", () => {
  render(<ReportAction targetType="GENERATED_PACK" targetId="42" isPublic={false} />);
  expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
});

test.each([[401, "Please log in"], [429, "Too many reports"], [500, "Unable to submit"]])("handles HTTP %s", async (status, message) => {
  submit.mockResolvedValue({ status } as Response);
  render(<ReportAction targetType="UPLOAD" targetId={2} isPublic />);
  fireEvent.click(screen.getByText("Report"));
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "OTHER" } });
  fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "Details" } });
  fireEvent.click(screen.getByText("Submit report"));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(String(message)));
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ description: "Details" }), "test-token");
});

test("anonymous reporting asks for login without sending", () => {
  localStorage.clear();
  render(<ReportAction targetType="UPLOAD" targetId={2} isPublic />);
  fireEvent.click(screen.getByText("Report"));
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "OTHER" } });
  fireEvent.click(screen.getByText("Submit report"));
  expect(screen.getByRole("alert")).toHaveTextContent("Please log in");
  expect(submit).not.toHaveBeenCalled();
});
