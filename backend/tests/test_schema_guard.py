import logging
from unittest.mock import AsyncMock

import pytest

from app.database import verify_csv_uploads_storage_path


class _Result:
    def __init__(self, value: object | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object | None:
        return self._value


@pytest.mark.asyncio
async def test_verify_csv_uploads_storage_path_raises_when_missing(
    caplog: pytest.LogCaptureFixture,
) -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=_Result(None))

    with caplog.at_level(logging.ERROR):
        with pytest.raises(RuntimeError, match="csv_uploads.storage_path"):
            await verify_csv_uploads_storage_path(conn)

    assert "csv_uploads.storage_path" in caplog.text


@pytest.mark.asyncio
async def test_verify_csv_uploads_storage_path_noop_when_present() -> None:
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=_Result(1))

    await verify_csv_uploads_storage_path(conn)
