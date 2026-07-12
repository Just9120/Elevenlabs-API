DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"


def parse_google_scopes(value: str | None) -> set[str]:
    if not value:
        return set()
    return {part.strip() for part in value.split() if part.strip()}


def has_drive_file_scope(value: str | None) -> bool:
    return DRIVE_FILE_SCOPE in parse_google_scopes(value)
