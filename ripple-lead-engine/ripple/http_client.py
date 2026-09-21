"""One HTTP client for every source: retries, rate limiting and a disk cache.

The cache matters more than it looks. A nightly run re-reads mostly unchanged
registers, so caching keeps us off other people's servers and makes reruns
during development free.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any

import requests

log = logging.getLogger(__name__)


class HttpClient:
    def __init__(
        self,
        user_agent: str,
        timeout: float = 20.0,
        rate_limit_seconds: float = 0.5,
        max_retries: int = 3,
        cache_dir: Path | None = None,
        cache_ttl_hours: float = 24.0,
    ) -> None:
        self.session = requests.Session()
        self.session.headers["User-Agent"] = user_agent
        self.timeout = timeout
        self.rate_limit_seconds = rate_limit_seconds
        self.max_retries = max_retries
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.cache_ttl_seconds = cache_ttl_hours * 3600
        self._last_request_at = 0.0
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    # -- cache ---------------------------------------------------------------

    def _cache_path(self, key: str) -> Path | None:
        if not self.cache_dir:
            return None
        digest = hashlib.sha1(key.encode()).hexdigest()
        return self.cache_dir / f"{digest}.json"

    def _cache_read(self, key: str) -> Any | None:
        path = self._cache_path(key)
        if not path or not path.exists():
            return None
        if time.time() - path.stat().st_mtime > self.cache_ttl_seconds:
            return None
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            return None

    def _cache_write(self, key: str, payload: Any) -> None:
        path = self._cache_path(key)
        if not path:
            return
        try:
            path.write_text(json.dumps(payload))
        except (OSError, TypeError):
            log.debug("could not cache %s", key)

    # -- requests ------------------------------------------------------------

    def _throttle(self) -> None:
        elapsed = time.time() - self._last_request_at
        if elapsed < self.rate_limit_seconds:
            time.sleep(self.rate_limit_seconds - elapsed)
        self._last_request_at = time.time()

    def get_json(
        self,
        url: str,
        params: dict | None = None,
        headers: dict | None = None,
        auth: tuple[str, str] | None = None,
        use_cache: bool = True,
    ) -> Any | None:
        """GET returning parsed JSON, or None if the call failed."""
        cache_key = f"{url}?{sorted((params or {}).items())}"
        if use_cache:
            cached = self._cache_read(cache_key)
            if cached is not None:
                log.debug("cache hit %s", url)
                return cached

        response = self._request("GET", url, params=params, headers=headers, auth=auth)
        if response is None:
            return None
        try:
            payload = response.json()
        except ValueError:
            log.warning("non-JSON response from %s", url)
            return None
        if use_cache:
            self._cache_write(cache_key, payload)
        return payload

    def post_json(
        self,
        url: str,
        body: dict,
        headers: dict | None = None,
        use_cache: bool = True,
    ) -> Any | None:
        """POST a JSON body, returning parsed JSON or None.

        Cached on the (url, body) pair. Every POST we make is a read-shaped
        query (bulk lookups, text search), so caching is safe here.
        """
        cache_key = f"POST {url} {json.dumps(body, sort_keys=True)}"
        if use_cache:
            cached = self._cache_read(cache_key)
            if cached is not None:
                log.debug("cache hit %s", url)
                return cached

        response = self._request("POST", url, json=body, headers=headers)
        if response is None:
            return None
        try:
            payload = response.json()
        except ValueError:
            log.warning("non-JSON response from %s", url)
            return None
        if use_cache:
            self._cache_write(cache_key, payload)
        return payload

    def send_json(
        self,
        method: str,
        url: str,
        body: dict,
        headers: dict | None = None,
    ) -> Any | None:
        """POST/PATCH a JSON body for a write. Never cached.

        Writes must not be served from cache, and must not populate it.
        """
        response = self._request(method, url, json=body, headers=headers)
        if response is None:
            return None
        try:
            return response.json()
        except ValueError:
            return {}

    def get_text(
        self,
        url: str,
        params: dict | None = None,
        headers: dict | None = None,
        max_bytes: int = 2_000_000,
    ) -> str | None:
        """GET returning decoded text, truncated to max_bytes."""
        response = self._request("GET", url, params=params, headers=headers, stream=True)
        if response is None:
            return None
        try:
            content = response.raw.read(max_bytes, decode_content=True)
        except Exception:  # noqa: BLE001 - any read failure is just a miss
            return None
        finally:
            response.close()
        encoding = response.encoding or "utf-8"
        return content.decode(encoding, errors="replace")

    def _request(self, method: str, url: str, **kwargs) -> requests.Response | None:
        """Retry on transport errors, 429 and 5xx with exponential backoff."""
        backoff = 1.0
        for attempt in range(1, self.max_retries + 1):
            self._throttle()
            try:
                response = self.session.request(
                    method, url, timeout=self.timeout, **kwargs
                )
            except requests.RequestException as exc:
                log.warning("%s %s failed (attempt %d): %s", method, url, attempt, exc)
            else:
                if response.status_code < 400:
                    return response
                if response.status_code in (429,) or response.status_code >= 500:
                    log.warning(
                        "%s %s returned %d (attempt %d)",
                        method, url, response.status_code, attempt,
                    )
                else:
                    # 4xx other than rate limiting will not improve on retry.
                    log.warning("%s %s returned %d, giving up", method, url, response.status_code)
                    return None
            if attempt < self.max_retries:
                time.sleep(backoff)
                backoff *= 2
        return None
