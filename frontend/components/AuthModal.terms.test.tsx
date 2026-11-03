import { fireEvent, render, screen } from "@testing-library/react";
import AuthModal from "./AuthModal";

test("registration requires Terms and links Privacy as information", () => {
  const submit = jest.fn();
  render(<AuthModal mode="register" email="a@test.invalid" username="user" password="SafePassword123!" authStatus="" setEmail={jest.fn()} setUsername={jest.fn()} setPassword={jest.fn()} onSubmit={submit} onClose={jest.fn()} />);
  expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/datenschutz");
  const button = screen.getByRole("button", { name: "Register" });
  expect(button).toBeDisabled();
  fireEvent.submit(button.closest("form")!);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/consent to.*Privacy/i)).not.toBeInTheDocument();
});
