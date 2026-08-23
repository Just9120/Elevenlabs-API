DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"
DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
DRIVE_METADATA_READONLY_SCOPE = (
    "https://www.googleapis.com/auth/drive.metadata.readonly"
)
DOCUMENTS_SCOPE = "https://www.googleapis.com/auth/documents"
GOOGLE_IDENTITY_SCOPES = {
    "openid",
    "email",
    "https://www.googleapis.com/auth/userinfo.email",
}
PICKER_BROWSER_ALLOWED_SCOPES = {
    *GOOGLE_IDENTITY_SCOPES,
    DRIVE_FILE_SCOPE,
    DRIVE_READONLY_SCOPE,
}
MAINTENANCE_SERVER_ALLOWED_SCOPES = {
    *GOOGLE_IDENTITY_SCOPES,
    DRIVE_METADATA_READONLY_SCOPE,
    DOCUMENTS_SCOPE,
}


def parse_google_scopes(value: str | None) -> set[str]:
    if not value:
        return set()
    return {part.strip() for part in value.split() if part.strip()}


def has_drive_file_scope(value: str | None) -> bool:
    return DRIVE_FILE_SCOPE in parse_google_scopes(value)


def has_drive_readonly_scope(value: str | None) -> bool:
    return DRIVE_READONLY_SCOPE in parse_google_scopes(value)


def has_picker_browser_scope_boundary(value: str | None) -> bool:
    scopes = parse_google_scopes(value)
    has_email_identity = bool(
        scopes
        & {
            "email",
            "https://www.googleapis.com/auth/userinfo.email",
        }
    )
    return (
        "openid" in scopes
        and has_email_identity
        and DRIVE_FILE_SCOPE in scopes
        and DRIVE_READONLY_SCOPE in scopes
        and scopes <= PICKER_BROWSER_ALLOWED_SCOPES
    )


def has_maintenance_server_scope_boundary(value: str | None) -> bool:
    scopes = parse_google_scopes(value)
    has_email_identity = bool(
        scopes
        & {
            "email",
            "https://www.googleapis.com/auth/userinfo.email",
        }
    )
    return (
        "openid" in scopes
        and has_email_identity
        and DRIVE_METADATA_READONLY_SCOPE in scopes
        and DOCUMENTS_SCOPE in scopes
        and scopes <= MAINTENANCE_SERVER_ALLOWED_SCOPES
    )
