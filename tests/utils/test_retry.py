"""Tests for retry with backoff decorator."""

import pytest

from src.utils.retry import retry_with_backoff


class TestRetryWithBackoff:
    def test_succeeds_first_try(self):
        call_count = 0

        @retry_with_backoff(max_retries=3, base_delay=0.01)
        def succeed():
            nonlocal call_count
            call_count += 1
            return "ok"

        assert succeed() == "ok"
        assert call_count == 1

    def test_retries_on_connection_error(self):
        call_count = 0

        @retry_with_backoff(max_retries=2, base_delay=0.01)
        def fail_then_succeed():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("down")
            return "ok"

        assert fail_then_succeed() == "ok"
        assert call_count == 3

    def test_raises_after_max_retries(self):
        @retry_with_backoff(max_retries=2, base_delay=0.01)
        def always_fail():
            raise TimeoutError("timeout")

        with pytest.raises(TimeoutError):
            always_fail()

    def test_does_not_retry_non_retryable(self):
        call_count = 0

        @retry_with_backoff(max_retries=3, base_delay=0.01)
        def value_error():
            nonlocal call_count
            call_count += 1
            raise ValueError("bad input")

        with pytest.raises(ValueError):
            value_error()
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_async_succeeds(self):
        @retry_with_backoff(max_retries=2, base_delay=0.01)
        async def async_ok():
            return "async_ok"

        assert await async_ok() == "async_ok"

    @pytest.mark.asyncio
    async def test_async_retries(self):
        call_count = 0

        @retry_with_backoff(max_retries=2, base_delay=0.01)
        async def async_fail_once():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ConnectionError("down")
            return "recovered"

        assert await async_fail_once() == "recovered"
        assert call_count == 2
