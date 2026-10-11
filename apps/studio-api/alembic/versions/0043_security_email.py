"""Transactional personal access/security email outbox."""
from alembic import op
import sqlalchemy as sa

revision = "0043_security_email"
down_revision = "0042_media_context"
branch_labels = None
depends_on = None
release_safety = "additive"


def upgrade():
    if "security_email_deliveries" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table("security_email_deliveries",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("dedup_key", sa.String(128), nullable=False, unique=True),
            sa.Column("kind", sa.String(64), nullable=False),
            sa.Column("payload_ciphertext", sa.LargeBinary()), sa.Column("payload_nonce", sa.LargeBinary()),
            sa.Column("state", sa.String(24), nullable=False), sa.Column("attempt_count", sa.Integer(), nullable=False),
            sa.Column("claim_token", sa.String(64)), sa.Column("claim_expires_at", sa.DateTime(timezone=True)),
            sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True)), sa.Column("error_code", sa.String(64)),
            sa.CheckConstraint("attempt_count >= 0 AND attempt_count <= 3", name="ck_security_email_attempts"))
        op.create_index("ix_security_email_dispatch", "security_email_deliveries", ["state", "next_attempt_at", "created_at"])


def downgrade():
    if "security_email_deliveries" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("security_email_deliveries")
