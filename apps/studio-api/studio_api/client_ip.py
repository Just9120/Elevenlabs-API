from ipaddress import ip_address

from fastapi import Request

from .config import Settings


def get_client_ip(request: Request, settings: Settings) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        direct = ip_address(peer)
    except ValueError:
        return peer
    if direct != settings.trusted_proxy_ip:
        return peer

    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not forwarded:
        return peer
    try:
        return str(ip_address(forwarded))
    except ValueError:
        return peer
