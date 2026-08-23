import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderImportDialog } from "./FolderImportDialog";
import type { LocalFolderPreview } from "./folderIntakeModel";

const preview: LocalFolderPreview = {
  folder_name: "Calls",
  total_count: 3,
  supported_count: 2,
  blocker: null,
  accepted: [
    {
      file: new File(["a"], "a.mp3", { type: "audio/mpeg" }),
      relative_path: "Calls/a.mp3",
    },
    {
      file: new File(["b"], "b.mp4", { type: "video/mp4" }),
      relative_path: "Calls/nested/b.mp4",
    },
  ],
  rejected: [
    {
      display_name: "Calls/readme.txt",
      reason: "unsupported",
    },
  ],
};

describe("FolderImportDialog", () => {
  it("shows bounded preview and requires explicit confirmation", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <FolderImportDialog
        preview={preview}
        targetFolderName="Расшифровки"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Импортировать папку «Calls»?" }),
    ).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Расшифровки")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмена" })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Импортировать 2" }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("closes on Escape and traps keyboard focus", async () => {
    const onCancel = vi.fn();
    render(
      <FolderImportDialog
        preview={preview}
        targetFolderName={null}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const cancel = screen.getByRole("button", { name: "Отмена" });
    const confirm = screen.getByRole("button", { name: "Импортировать 2" });
    expect(cancel).toHaveFocus();
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(cancel).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
