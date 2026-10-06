from copy import deepcopy
import importlib.util
import io
import json
from pathlib import Path
import zipfile

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("ci_validation", ROOT / "scripts/ci_validation.py")
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)
TARGET, BASE, HEAD, CHECKOUT, TREE = [c * 40 for c in "abcde"]


@pytest.fixture(autouse=True)
def known_runner_context(monkeypatch):
    for key, value in {"RUNNER_OS": "Linux", "RUNNER_ARCH": "X64", "ImageOS": "ubuntu24", "ImageVersion": "20261006.1"}.items():
        monkeypatch.setenv(key, value)


class API:
    def __init__(self):
        self.run = dict(id=42, head_sha=HEAD, event="pull_request", status="completed", conclusion="success",
                        path=ci.WORKFLOW, repository={"full_name": ci.REPOSITORY},
                        head_repository={"full_name": ci.REPOSITORY}, head_branch="main")
        self.job = dict(name="ci-required", conclusion="success")
        self.pr = dict(merged_at="2026-10-06", merge_commit_sha=TARGET,
                       base={"ref": "main"}, head={"sha": HEAD, "repo": {"full_name": ci.REPOSITORY}})
        self.proof = dict(schema=1, mode="full", run_id=42, repository=ci.REPOSITORY,
                          head=HEAD, base=BASE, tree=TREE, context=ci.validation_context(), runner=ci.runner_context(), suite_runners=[ci.runner_context()], checkout=CHECKOUT)
        self.checked = dict(tree={"sha": TREE}, parents=[{"sha": BASE}, {"sha": HEAD}])

    def pages(self, suffix, key=None):
        if suffix.startswith("commits/"): return iter([self.pr])
        if suffix.endswith("artifacts"): return iter([dict(id=9, name=ci.PROOF_NAME, expired=False, size_in_bytes=500)])
        if "/jobs?" in suffix: return iter([self.job])
        return iter([self.run])

    def request(self, path, *, binary=False):
        if binary:
            data = io.BytesIO()
            with zipfile.ZipFile(data, "w") as archive:
                archive.writestr("identity.json", json.dumps(self.proof))
            return data.getvalue()
        if path.endswith(TARGET): return dict(tree={"sha": TREE}, parents=[{"sha": BASE}])
        if path.endswith(CHECKOUT): return self.checked
        if path.endswith("heads/main"): return {"object": {"sha": TARGET}}
        if "actions/runs/" in path: return self.run
        raise AssertionError(path)


def test_equivalent_squash_reuses_full_pr_validation():
    assert ci.verify_reuse(API(), TARGET) == 42


def test_changed_or_unknown_runner_image_requires_full_suite(monkeypatch):
    api = API()
    monkeypatch.setenv("ImageVersion", "20261007.1")
    assert ci.verify_reuse(api, TARGET) is None
    monkeypatch.delenv("ImageVersion")
    assert ci.verify_reuse(api, TARGET) is None


def test_aggregate_host_cannot_substitute_for_actual_suite_hosts():
    api = API(); api.proof["suite_runners"][0] = {**ci.runner_context(), "ImageVersion": "previous-image"}
    assert ci.verify_reuse(api, TARGET) is None
    api.proof["suite_runners"] = []
    assert ci.verify_reuse(api, TARGET) is None


@pytest.mark.parametrize("field,value", [("tree", "f" * 40), ("base", "f" * 40),
    ("context", "obsolete"), ("head", "f" * 40), ("mode", "docs"), ("run_id", 43),
    ("repository", "attacker/repository")])
def test_reuse_rejects_different_source_context_or_identity(field, value):
    api = API(); api.proof[field] = value
    assert ci.verify_reuse(api, TARGET) is None


@pytest.mark.parametrize("field,value", [("conclusion", "failure"), ("status", "in_progress"),
    ("event", "workflow_dispatch"), ("path", ".github/workflows/other.yml"),
    ("head_sha", "f" * 40), ("head_repository", {"full_name": "attacker/fork"})])
def test_reuse_rejects_untrusted_or_unvalidated_run(field, value):
    api = API(); api.run[field] = value
    assert ci.verify_reuse(api, TARGET) is None


def test_proof_cannot_claim_arbitrary_checkout_tree_or_parent():
    api = API(); api.checked["tree"]["sha"] = "f" * 40
    assert ci.verify_reuse(api, TARGET) is None
    api = API(); api.checked["parents"] = [{"sha": HEAD}]
    assert ci.verify_reuse(api, TARGET) is None
    api = API(); api.job["conclusion"] = "skipped"
    assert ci.verify_reuse(api, TARGET) is None


@pytest.mark.parametrize("paths,expected", [(["docs/spec/studio.md", "README.md"], (False, False)),
    (["docs/exploit.py"], (True, False)), (["scripts/release.sh"], (True, True)),
    ([".github/workflows/ci.yml"], (True, True)), (["apps/studio/x.tsx"], (True, True)),
    (["tests/test_model.py"], (True, True)), (["colab.py"], (True, False)), ([], (True, False))])
def test_selection_exempts_only_known_prose(paths, expected):
    assert ci.select(paths) == expected


def test_deployment_requires_exact_current_main_push_validation(monkeypatch, tmp_path):
    monkeypatch.setenv("GITHUB_REPOSITORY", ci.REPOSITORY)
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_run")
    monkeypatch.setenv("GITHUB_OUTPUT", str(tmp_path / "output"))
    api = API(); api.run.update(head_sha=TARGET, event="push")
    ci.deploy_gate(api, {"workflow_run": {"id": 42}})
    assert (tmp_path / "output").read_text() == f"revision={TARGET}\n"
    for field, value in [("head_sha", HEAD), ("event", "pull_request"), ("head_branch", "feature"),
                          ("conclusion", "failure"), ("status", "queued")]:
        bad = deepcopy(api); bad.run[field] = value
        with pytest.raises(ValueError, match="deployment denied"):
            ci.deploy_gate(bad, {"workflow_run": {"id": 42}})


def test_manual_cd_rejects_non_main_and_outdated_dispatch(monkeypatch, tmp_path):
    monkeypatch.setenv("GITHUB_REPOSITORY", ci.REPOSITORY)
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("GITHUB_OUTPUT", str(tmp_path / "output"))
    monkeypatch.setenv("GITHUB_REF", "refs/heads/feature")
    monkeypatch.setenv("GITHUB_SHA", TARGET)
    with pytest.raises(ValueError, match="current main"):
        ci.deploy_gate(API(), {})
    monkeypatch.setenv("GITHUB_REF", "refs/heads/main")
    monkeypatch.setenv("GITHUB_SHA", HEAD)
    with pytest.raises(ValueError, match="current main"):
        ci.deploy_gate(API(), {})


def test_pagination_is_complete_or_rejected():
    api = ci.GitHub()
    calls = []
    api.request = lambda path: calls.append(path) or ([{}] * 100 if path.endswith("&page=1") else [])
    assert len(list(api.pages("commits/x/pulls"))) == 100
    assert len(calls) == 2
    api.request = lambda path: [{}] * 100
    with pytest.raises(ValueError, match="pagination"):
        list(api.pages("commits/x/pulls"))


def test_workflows_keep_required_aggregate_and_gate_before_secret_jobs():
    workflow = (ROOT / ci.WORKFLOW).read_text(encoding="utf-8")
    assert "name: ci-required" in workflow and "if: always()" in workflow
    assert 'test "$ROOT_RESULT" = success' in workflow
    assert 'test "$STUDIO_RESULT" = success' in workflow
    cd = (ROOT / ".github/workflows/studio-platform-cd.yml").read_text(encoding="utf-8")
    assert "workflow_run:" in cd and "workflows: [CI]" in cd and "  push:" not in cd
    assert cd.index("ci_validation.py deploy-gate") < cd.index("secrets.DEPLOY_HOST")
    assert cd.count("ref: ${{ needs.detect-components.outputs.revision }}") == 4
    assert "cancel-in-progress: false" in cd
