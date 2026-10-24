"""Persist atomically consumed TOTP time-step counters."""

from alembic import op
import sqlalchemy as sa

revision = "0042_totp_replay"
down_revision = "0041_source_retention_default"
branch_labels = None
depends_on = None
release_safety = "additive"


def upgrade() -> None:
    if "last_used_counter" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("user_totp_factors")}:
        op.add_column("user_totp_factors", sa.Column("last_used_counter", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_totp_factors", "last_used_counter")
