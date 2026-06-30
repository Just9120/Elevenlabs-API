"""platform core
Revision ID: 0001_platform_core
Revises:
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
revision='0001_platform_core'; down_revision=None; branch_labels=None; depends_on=None
def upgrade():
    from studio_api.db import Base
    from studio_api import models
    Base.metadata.create_all(op.get_bind())
def downgrade():
    bind=op.get_bind(); meta=sa.MetaData(); meta.reflect(bind=bind)
    for t in reversed(meta.sorted_tables):
        if t.name!='alembic_version': t.drop(bind)
