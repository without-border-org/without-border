"""Add agents table.

Revision ID: 002_add_agents_table
Revises: 001_initial_schema
Create Date: 2026-05-16 00:00:00.000000

Creates the agents table:
- id (UUID PK)
- name (String 100, non-null)
- description (String 500, nullable)
- agent_type (String 50, non-null)
- persona (Text, nullable)
- is_active (Boolean, non-null, default true)
- created_at (DateTime with timezone, server_default now())
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '002_add_agents_table'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create agents table."""
    op.create_table(
        'agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('persona', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    """Drop agents table."""
    op.drop_table('agents')
