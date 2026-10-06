import os

from scripts.test_shell_environment import configure_test_shell


def test_windows_prefers_verified_git_bash_before_wsl_and_preserves_path(tmp_path, monkeypatch):
    root = tmp_path / "Git installation"
    for directory in ("cmd", "bin", "usr/bin"):
        (root / directory).mkdir(parents=True)
    (root / "cmd/git.exe").touch()
    (root / "bin/bash.exe").touch()
    (root / "usr/bin/bash.exe").touch()
    monkeypatch.setattr("scripts.test_shell_environment.shutil.which", lambda *_args, **_kwargs: str(root / "cmd/git.exe"))
    environment = {"PATH": "WSL-original-PATH", "KEEP": "unchanged"}
    assert configure_test_shell(environment, windows=True)
    assert environment["PATH"].split(os.pathsep)[:2] == [str(root / "bin"), str(root / "usr/bin")]
    assert environment["PATH"].endswith("WSL-original-PATH") and environment["KEEP"] == "unchanged"


def test_unknown_or_incomplete_installation_is_not_guessed(tmp_path, monkeypatch):
    monkeypatch.setattr("scripts.test_shell_environment.shutil.which", lambda *_args, **_kwargs: str(tmp_path / "cmd/git.exe"))
    (tmp_path / "bin").mkdir()
    (tmp_path / "bin/bash.exe").touch()
    environment = {"PATH": "original"}
    assert not configure_test_shell(environment, windows=True)
    assert environment == {"PATH": "original"}


def test_linux_path_is_untouched(monkeypatch):
    def unexpected(*_args, **_kwargs):
        raise AssertionError("Linux discovery must keep the configured shell")
    monkeypatch.setattr("scripts.test_shell_environment.shutil.which", unexpected)
    environment = {"PATH": "/usr/bin"}
    assert not configure_test_shell(environment, windows=False)
    assert environment == {"PATH": "/usr/bin"}
