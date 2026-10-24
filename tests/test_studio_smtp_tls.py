import os
import ssl
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.mark.parametrize("sender", ["security", "notification"])
@pytest.mark.parametrize("reject_certificate", [False, True])
def test_implicit_smtp_tls_verifies_peer_before_auth_and_send(sender, reject_certificate):
    from studio_api import security_email, job_notifications

    events = []
    settings = SimpleNamespace(job_smtp_from_email="security@example.test", security_email_sender_domain="example.test",
        job_smtp_host="smtp.example.test", job_smtp_port=465, job_smtp_timeout_seconds=5,
        job_smtp_use_ssl=True, job_smtp_starttls=False, job_smtp_username="synthetic",
        job_smtp_password=lambda: "synthetic-only", app_origin="https://studio.example.test")

    class SMTP:
        def __init__(self, host, port, *, timeout, context):
            assert context.verify_mode == ssl.CERT_REQUIRED
            assert context.check_hostname is True
            events.append("verified_tls")
            if reject_certificate:
                raise ssl.SSLCertVerificationError("synthetic untrusted certificate")
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def login(self, *_): events.append("auth")
        def send_message(self, _): events.append("send")

    if sender == "security":
        result = security_email._send({"subject": "Synthetic", "recipient": "owner@example.test", "body": "synthetic"},
                                     delivery_id="synthetic", settings=settings, smtp_factory=SMTP)
        assert result == ("transport_unavailable" if reject_certificate else None)
    else:
        claim = job_notifications.JobNotificationClaim(delivery_id="synthetic", claim_token="synthetic",
            owner_user_id="owner", job_id="job", terminal_status="completed", attempt_number=1,
            channel="email", destination_id="account", recipient_email="owner@example.test")
        result = job_notifications._send_email(claim, settings=settings, smtp_factory=SMTP)
        assert result == ((False, "transport_unavailable") if reject_certificate else (True, None))
    assert events == (["verified_tls"] if reject_certificate else ["verified_tls", "auth", "send"])
