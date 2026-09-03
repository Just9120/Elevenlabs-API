from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from enum import Enum
from typing import Callable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx


class RealtimeConsumerKind(str, Enum):
    youtube_live = "youtube_live"
    webhook = "webhook"


class RealtimeConsumerError(ValueError):
    pass


@dataclass(frozen=True)
class RealtimeConsumerTarget:
    kind: RealtimeConsumerKind
    url: str


def _public_addresses(hostname: str) -> bool:
    try:
        addresses = {
            address[4][0]
            for address in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        }
    except OSError:
        return False
    if not addresses:
        return False
    return all(ipaddress.ip_address(address).is_global for address in addresses)


def validate_realtime_consumer_target(
    kind: str | RealtimeConsumerKind,
    endpoint: str,
    *,
    webhook_allowed_hosts: str = "",
    resolve_public_addresses: Callable[[str], bool] = _public_addresses,
) -> RealtimeConsumerTarget:
    try:
        selected_kind = RealtimeConsumerKind(kind)
    except ValueError as exc:
        raise RealtimeConsumerError("unsupported_consumer") from exc
    try:
        parsed = urlsplit(endpoint.strip())
        port = parsed.port
    except ValueError as exc:
        raise RealtimeConsumerError("invalid_consumer_endpoint") from exc
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.fragment
        or port not in (None, 443)
    ):
        raise RealtimeConsumerError("invalid_consumer_endpoint")
    hostname = parsed.hostname.lower().rstrip(".")
    if selected_kind == RealtimeConsumerKind.youtube_live:
        if hostname != "upload.youtube.com" or not parsed.path.startswith("/closedcaption"):
            raise RealtimeConsumerError("invalid_youtube_endpoint")
    else:
        allowed = {
            item.strip().lower().rstrip(".")
            for item in webhook_allowed_hosts.split(",")
            if item.strip()
        }
        if hostname not in allowed:
            raise RealtimeConsumerError("webhook_host_not_allowed")
    if not resolve_public_addresses(hostname):
        raise RealtimeConsumerError("consumer_endpoint_not_public")
    return RealtimeConsumerTarget(selected_kind, urlunsplit(parsed))


def deliver_realtime_caption(
    target: RealtimeConsumerTarget,
    *,
    text: str,
    sequence: int,
    post: Callable[..., httpx.Response] = httpx.post,
) -> None:
    normalized_text = " ".join(text.split()) if isinstance(text, str) else ""
    if not normalized_text or len(normalized_text) > 2000:
        raise RealtimeConsumerError("invalid_caption_text")
    if isinstance(sequence, bool) or not isinstance(sequence, int) or not 0 <= sequence <= 2147483647:
        raise RealtimeConsumerError("invalid_caption_sequence")
    try:
        if target.kind == RealtimeConsumerKind.youtube_live:
            parsed = urlsplit(target.url)
            query = dict(parse_qsl(parsed.query, keep_blank_values=True))
            query["seq"] = str(sequence)
            response = post(
                urlunsplit(parsed._replace(query=urlencode(query))),
                content=f"{normalized_text}\n".encode("utf-8"),
                headers={"Content-Type": "text/plain; charset=utf-8"},
                timeout=5.0,
                follow_redirects=False,
            )
        else:
            response = post(
                target.url,
                json={"text": normalized_text, "sequence": sequence},
                timeout=5.0,
                follow_redirects=False,
            )
    except (httpx.HTTPError, OSError) as exc:
        raise RealtimeConsumerError("consumer_delivery_failed") from exc
    if not 200 <= response.status_code < 300:
        raise RealtimeConsumerError("consumer_delivery_rejected")
