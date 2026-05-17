"""Drop hashed_password and remove UNIQUE constraints on email/username.

Revision ID: 001_initial_schema
Revises: 
Create Date: 2025-05-05 00:00:00.000000

This is the initial migration that establishes the base schema with Keycloak integration:
- Remove hashed_password column (Keycloak manages passwords)
- Drop UNIQUE constraints on email and username (Keycloak is source of truth)
- Add indices on email and username for searching without Keycloak API calls
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = '000_create_base_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply schema changes: drop hashed_password, remove UNIQUE constraints."""
    # Drop hashed_password column
    op.drop_column('users', 'hashed_password')
    
    # Drop UNIQUE constraints on email and username (if they exist)
    # These are replaced with simple indices since Keycloak is the auth source
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('users_email_key', type_='unique')
        batch_op.drop_constraint('users_username_key', type_='unique')
    
    # Ensure indices exist for search performance
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(op.f('ix_users_email'), ['email'], if_not_exists=True)
        batch_op.create_index(op.f('ix_users_username'), ['username'], if_not_exists=True)


def downgrade() -> None:
    """Rollback: restore hashed_password and UNIQUE constraints."""
    # Recreate hashed_password column
    op.add_column('users', sa.Column('hashed_password', sa.String(255), nullable=False, server_default=''))
    
    # Restore UNIQUE constraints
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_unique_constraint('users_email_key', ['email'])
        batch_op.create_unique_constraint('users_username_key', ['username'])
    
    # Drop indices (they are replaced by UNIQUE constraints)
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(op.f('ix_users_email'), if_exists=True)
        batch_op.drop_index(op.f('ix_users_username'), if_exists=True)
