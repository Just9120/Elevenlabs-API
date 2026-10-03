from starlette.responses import JSONResponse


class RequestBodyLimitMiddleware:
    """Bound API bodies before JSON parsing, including requests without Content-Length."""

    def __init__(self, app, max_bytes=4 * 1024 * 1024, auth_max_bytes=16 * 1024):
        self.app = app
        self.max_bytes = max_bytes
        self.auth_max_bytes = auth_max_bytes

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not scope['path'].startswith('/api/'):
            return await self.app(scope, receive, send)
        limit = self.auth_max_bytes if scope['path'].startswith('/api/auth/') else self.max_bytes
        headers = dict(scope.get('headers', []))
        try:
            declared = int(headers.get(b'content-length', b'0'))
        except ValueError:
            declared = limit + 1
        if declared < 0 or declared > limit:
            return await self._reject(scope, receive, send)
        # Buffer a bounded body before calling the application. This avoids a
        # partial handler execution and guarantees one response even for chunked input.
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            if len(body) + len(chunk) > limit:
                return await self._reject(scope, receive, send)
            body.extend(chunk)
            if not message.get('more_body', False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()

        await self.app(scope, bounded_receive, send)

    @staticmethod
    async def _reject(scope, receive, send):
        response = JSONResponse(
            {'detail': 'Запрос превышает допустимый размер'}, status_code=413,
            headers={'Cache-Control': 'no-store'},
        )
        await response(scope, receive, send)
