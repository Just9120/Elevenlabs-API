import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionJob } from "./jobModel";
import { SpeakerIdentityPanel } from "./SpeakerIdentityPanel";

const profile = {
  id: "profile-1",
  display_name: "Анна",
  role: "Автор",
  active: true,
  created_at: "2026-08-24T18:00:00Z",
  updated_at: "2026-08-24T18:00:00Z",
};

const job: TranscriptionJob = {
  id: "job-1",
  project_id: "project-1",
  status: "completed",
  title: "Interview",
  provider: "elevenlabs",
  language_mode: "detect",
  diarization_enabled: true,
  source_count: 1,
  sources: [],
  speaker_identities: [
    {
      id: "speaker-1",
      label: "Speaker 1",
      sample_available: true,
      profile: null,
    },
  ],
  created_at: "2026-08-24T17:00:00Z",
  updated_at: "2026-08-24T18:00:00Z",
  cancelled_at: null,
  cancel_requested_at: null,
  attempt_count: 1,
  started_at: "2026-08-24T17:00:00Z",
  finished_at: "2026-08-24T18:00:00Z",
  error_code: null,
  error_message: null,
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:speaker-sample"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SpeakerIdentityPanel", () => {
  it("loads a bounded sample and explicitly applies a selected profile", async () => {
    const onJobUpdated = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/speaker-profiles") && !init?.method) {
        return json({ profiles: [profile] });
      }
      if (url.endsWith("/api/jobs/job-1/speakers/speaker-1/sample")) {
        return new Response(new Blob(["audio"]), {
          headers: { "content-type": "audio/mpeg" },
        });
      }
      if (
        url.endsWith("/api/jobs/job-1/speakers/speaker-1/assignment") &&
        init?.method === "PUT"
      ) {
        return json({
          speaker: {
            id: "speaker-1",
            label: "Speaker 1",
            sample_available: true,
            profile: { id: profile.id, display_name: profile.display_name, role: profile.role },
          },
          document_changed: true,
        });
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <SpeakerIdentityPanel
        job={job}
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        onJobUpdated={onJobUpdated}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Настроить имена спикеров" }),
    );
    await screen.findByRole("option", { name: "Анна — Автор" });

    await userEvent.click(
      screen.getByRole("button", { name: "Прослушать фрагмент" }),
    );
    await waitFor(() =>
      expect(container.querySelector("audio")).toHaveAttribute(
        "src",
        "blob:speaker-sample",
      ),
    );
    await userEvent.selectOptions(screen.getByLabelText("Профиль"), profile.id);
    await userEvent.click(
      screen.getByRole("button", { name: "Применить к документу" }),
    );

    await waitFor(() => expect(onJobUpdated).toHaveBeenCalledOnce());
    const assignmentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/assignment"),
    );
    expect(assignmentCall?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ profile_id: profile.id }),
      headers: expect.objectContaining({ "x-csrf-token": "csrf-safe" }),
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Имя и роль применены к Google Docs",
    );
  });

  it("creates, edits, and confirms deactivation of an owner profile", async () => {
    let profiles = [profile];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/speaker-profiles") && !init?.method) {
        return json({ profiles });
      }
      if (url.endsWith("/api/speaker-profiles") && init?.method === "POST") {
        const created = {
          ...profile,
          id: "profile-2",
          display_name: "Борис",
          role: "Редактор",
        };
        profiles = [...profiles, created];
        return json(created);
      }
      if (url.endsWith("/api/speaker-profiles/profile-2") && init?.method === "PATCH") {
        const updated = { ...profiles[1], role: "Главный редактор" };
        profiles = [profiles[0], updated];
        return json(updated);
      }
      if (url.endsWith("/api/speaker-profiles/profile-2") && init?.method === "DELETE") {
        profiles = [profiles[0]];
        return json({ ok: true });
      }
      throw new Error(`Unexpected request: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SpeakerIdentityPanel
        job={job}
        csrf="csrf-safe"
        onCsrf={vi.fn()}
        onJobUpdated={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Настроить имена спикеров" }),
    );
    await screen.findByText("Анна");

    const createForm = screen.getByLabelText("Новый профиль спикера");
    await userEvent.type(within(createForm).getByLabelText("Имя"), "Борис");
    await userEvent.type(within(createForm).getByLabelText("Роль"), "Редактор");
    await userEvent.click(
      within(createForm).getByRole("button", { name: "Добавить профиль" }),
    );
    const borisCard = (await screen.findByText("Борис")).closest("article")!;
    await userEvent.click(within(borisCard).getByRole("button", { name: "Изменить" }));
    const roleInput = within(borisCard).getByLabelText("Роль");
    await userEvent.clear(roleInput);
    await userEvent.type(roleInput, "Главный редактор");
    await userEvent.click(within(borisCard).getByRole("button", { name: "Сохранить" }));
    await within(borisCard).findByText("Главный редактор");

    await userEvent.click(within(borisCard).getByRole("button", { name: "Удалить" }));
    expect(within(borisCard).getByText("Удалить профиль?")).toBeInTheDocument();
    await userEvent.click(within(borisCard).getByRole("button", { name: "Да" }));
    await waitFor(() => expect(screen.queryByText("Борис")).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url).endsWith("/profile-2") && init?.method === "DELETE"
    )).toBe(true);
  });
});
