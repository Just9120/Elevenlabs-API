from __future__ import annotations

from typing import Any, TypedDict

from .job_processing_preflight import (
    QUEUED_JOB_STATUS,
    ProcessingPreflightSummary,
    build_processing_preflight,
)

CLAIM_CONTRACT_VERSION = "future-claim-readiness-v1"


class ClaimReadinessSummary(TypedDict):
    job_id: str
    project_id: str
    status: str
    claim_contract_version: str
    ready_for_future_claim: bool
    blocking_reasons: list[str]
    preflight_eligible: bool
    source_count: int
    ready_source_count: int
    provider_credential_present: bool
    output_folder_configured: bool


def build_claim_readiness(job: Any, *, now=None) -> ClaimReadinessSummary:
    """Build a non-mutating future claim-readiness plan from a job object.

    This helper is deliberately planning-only. It reuses the read-only
    processing preflight snapshot and does not claim, lease, mutate, decrypt,
    access source bytes, call providers, create output, or persist anything.
    """

    return build_claim_readiness_from_preflight(build_processing_preflight(job, now=now))


def build_claim_readiness_from_preflight(
    preflight: ProcessingPreflightSummary,
) -> ClaimReadinessSummary:
    """Convert a safe processing preflight snapshot into claim-readiness metadata."""

    blocking_reasons = list(preflight["blocking_reasons"])
    ready_source_count = sum(1 for source in preflight["sources"] if source["ready"])

    if preflight["status"] != QUEUED_JOB_STATUS and "job_status_not_queued" not in blocking_reasons:
        blocking_reasons.append("job_status_not_queued")
    if ready_source_count < 1 and "job_has_no_ready_sources" not in blocking_reasons:
        blocking_reasons.append("job_has_no_ready_sources")

    ready_for_future_claim = (
        preflight["eligible"]
        and preflight["status"] == QUEUED_JOB_STATUS
        and ready_source_count >= 1
        and not blocking_reasons
    )

    return {
        "job_id": preflight["job_id"],
        "project_id": preflight["project_id"],
        "status": preflight["status"],
        "claim_contract_version": CLAIM_CONTRACT_VERSION,
        "ready_for_future_claim": ready_for_future_claim,
        "blocking_reasons": blocking_reasons,
        "preflight_eligible": preflight["eligible"],
        "source_count": len(preflight["sources"]),
        "ready_source_count": ready_source_count,
        "provider_credential_present": preflight["provider_credential_present"],
        "output_folder_configured": preflight["output_folder_configured"],
    }
