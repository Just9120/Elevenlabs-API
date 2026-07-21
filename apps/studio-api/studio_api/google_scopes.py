DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"
PICKER_BROWSER_ALLOWED_SCOPES = {
    "openid",
    "email",
    "https://www.googleapis.com/auth/userinfo.email",
    DRIVE_FILE_SCOPE,
}


def parse_google_scopes(value: str | None) -> set[str]:
    if not value:
        return set()
    return {part.strip() for part in value.split() if part.strip()}


def has_drive_file_scope(value: str | None) -> bool:
    return DRIVE_FILE_SCOPE in parse_google_scopes(value)


def has_picker_browser_scope_boundary(value: str | None) -> bool:
    scopes = parse_google_scopes(value)
    return DRIVE_FILE_SCOPE in scopes and scopes <= PICKER_BROWSER_ALLOWED_SCOPES
