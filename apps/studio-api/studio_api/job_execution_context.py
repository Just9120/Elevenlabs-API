from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable, Iterator

from sqlalchemy.orm import Session

from .job_output_destination import OutputDestinationError, ProcessingJobOutputDestination, verify_processing_job_output_destination
from .provider_credential_access import ProviderCredentialAccessError, ProcessingJobProviderCredential, open_processing_job_provider_credential
from .security import utcnow


class JobExecutionContextReason(str, Enum):
    credential_unavailable = "credential_unavailable"
    output_destination_unavailable = "output_destination_unavailable"


class JobExecutionContextError(RuntimeError):
    def __init__(self, reason: JobExecutionContextReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class ProcessingJobExecutionPrerequisites:
    job_id: str
    provider: str
    credential_version_id: str
    verification_timestamp: datetime
    lease_generation: int
    raw_credential_secret: str = field(repr=False)
    output_drive_folder_id: str = field(repr=False)

    def __repr__(self) -> str:
        return (
            "ProcessingJobExecutionPrerequisites("
            f"job_id={self.job_id!r}, provider={self.provider!r}, credential_version_id={self.credential_version_id!r}, "
            f"verification_timestamp={self.verification_timestamp!r}, lease_generation={self.lease_generation!r}, "
            "raw_credential_secret=<redacted>, output_drive_folder_id=<redacted>)"
        )


@contextmanager
def open_processing_job_execution_prerequisites(
    db: Session,
    *,
    job_id: str,
    lease_owner_id: str,
    lease_generation: int,
    settings,
    now: datetime | None = None,
    clock: Callable[[], datetime] | None = None,
    credential_opener: Callable | None = None,
    output_verifier: Callable | None = None,
    **kwargs,
) -> Iterator[ProcessingJobExecutionPrerequisites]:
    clock = clock or (lambda: utcnow().replace(tzinfo=None))
    credential_opener = credential_opener or open_processing_job_provider_credential
    output_verifier = output_verifier or verify_processing_job_output_destination
    credential_kwargs = {key: value for key, value in kwargs.items() if key in {"master_key_resolver", "decryptor"}}
    output_kwargs = {key: value for key, value in kwargs.items() if key in {"token_resolver", "metadata_fetcher"}}
    try:
        credential_cm = credential_opener(
            db,
            job_id=job_id,
            lease_owner_id=lease_owner_id,
            lease_generation=lease_generation,
            settings=settings,
            now=now,
            clock=clock,
            **credential_kwargs,
        )
    except ProviderCredentialAccessError as exc:
        raise JobExecutionContextError(JobExecutionContextReason.credential_unavailable) from exc

    try:
        with credential_cm as cred:
            try:
                output: ProcessingJobOutputDestination = output_verifier(
                    db,
                    job_id=job_id,
                    lease_owner_id=lease_owner_id,
                    lease_generation=lease_generation,
                    settings=settings,
                    now=now,
                    clock=clock,
                    **output_kwargs,
                )
            except OutputDestinationError as exc:
                raise JobExecutionContextError(JobExecutionContextReason.output_destination_unavailable) from exc
            yield _handle(job_id, lease_generation, cred, output, clock())
    except ProviderCredentialAccessError as exc:
        raise JobExecutionContextError(JobExecutionContextReason.credential_unavailable) from exc


def _handle(job_id: str, lease_generation: int, cred: ProcessingJobProviderCredential, output: ProcessingJobOutputDestination, verified_at: datetime) -> ProcessingJobExecutionPrerequisites:
    return ProcessingJobExecutionPrerequisites(job_id=job_id, provider=cred.provider, credential_version_id=cred.credential_version_id, raw_credential_secret=cred.raw_secret, output_drive_folder_id=output.drive_folder_id, verification_timestamp=verified_at, lease_generation=lease_generation)
