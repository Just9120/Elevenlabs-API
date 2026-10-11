"""Use the current retention default for future users; preserve all expiries."""

from alembic import op
import sqlalchemy as sa

revision = "0041_source_retention_default"
down_revision = "0040_text_lifecycle"
branch_labels = None
depends_on = None
release_safety = "additive"


def _set_default(seconds: int) -> None:
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "source_retention_ttl_seconds", existing_type=sa.Integer(),
            existing_nullable=False, server_default=sa.text(str(seconds)),
        )


def upgrade() -> None:
    _set_default(259200)


def downgrade() -> None:
    _set_default(86400)
