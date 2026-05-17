"""Extend user_status enum with 'absent' and 'communication'.

Revision ID: 003_extend_user_status
Revises: 001_initial_schema
Create Date: 2026-05-16 00:00:00.000000

ALTER TYPE ... ADD VALUE is used because user_status is a native PostgreSQL enum.
op.alter_column cannot rename enum values; ADD VALUE is the correct approach.
Downgrade is intentionally left empty — PostgreSQL does not support removing
values from an enum without a full type recreation.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '003_extend_user_status'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add 'absent' and 'communication' to the user_status PostgreSQL enum."""
    op.execute("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'absent'")
    op.execute("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'communication'")


def downgrade() -> None:
    """No-op — removing enum values requires full type recreation (out of scope)."""
    pass
