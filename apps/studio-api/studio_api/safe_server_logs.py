import logging
import re


class QueryRedactionFilter(logging.Filter):
    """Uvicorn HTTP access and WS handshake logs must not expose URL credentials."""

    def filter(self, record):
        # Sanitize before formatting: WS paths may be passed as %r, which would
        # otherwise escape/quote credentials differently from HTTP %s paths.
        if isinstance(record.args, tuple):
            record.args = tuple(
                value.partition('?')[0] if isinstance(value, str) and '?' in value else value
                for value in record.args
            )
        elif isinstance(record.args, dict):
            record.args = {
                key: value.partition('?')[0] if isinstance(value, str) and '?' in value else value
                for key, value in record.args.items()
            }
        if isinstance(record.msg, str):
            record.msg = re.sub(r'(\S*/[^\s?]*)\?[^\s\"\']*', r'\1', record.msg)
        return True
