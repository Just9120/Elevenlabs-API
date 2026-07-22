import { render, screen } from "@testing-library/react";
import { isSafeDisplayUrl, ResourceExternalLink } from "./resourceLinks";

describe("resource links", () => {
  it.each([
    ["https://drive.google.com/file/d/safe-id/view", true],
    ["HTTP://example.test/resource", true],
    [null, false],
    ["", false],
    ["javascript:alert(1)", false],
    ["ftp://example.test/resource", false],
    ["https://example.test/file name", false],
    ["https://example.test/?token=raw", false],
    ["https://secret.example.test/resource", false],
    ["s3://private-bucket/object", false],
  ] as const)("evaluates display URL %j", (value, expected) => {
    expect(isSafeDisplayUrl(value)).toBe(expected);
  });

  it("renders an isolated new-tab link with an accessible label", () => {
    render(
      <ResourceExternalLink
        href="https://drive.google.com/file/d/safe-id/view"
        label="Открыть файл"
        ariaLabel="Открыть файл в новой вкладке"
      />,
    );

    const link = screen.getByRole("link", {
      name: "Открыть файл в новой вкладке",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/safe-id/view",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("button-like", "secondary", "resource-link");
    expect(link).toHaveTextContent("Открыть файл↗");
    expect(link.querySelector('[aria-hidden="true"]')).toHaveTextContent("↗");
  });
});
