"""Create initial base tables.

Revision ID: 000_create_base_tables
Revises:
Create Date: 2025-05-05 00:00:00.000000

Creates all tables from scratch so that alembic upgrade head works on a fresh
database:
- users
- channels
- channel_members
- messages
- message_translations
- message_reactions
- notifications
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '000_create_base_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create all base tables."""

    # Enums
    user_status = postgresql.ENUM('active', 'agentic', 'inactive', name='user_status', create_type=False)
    user_status.create(op.get_bind(), checkfirst=True)

    channel_type = postgresql.ENUM('team', 'pair', name='channel_type', create_type=False)
    channel_type.create(op.get_bind(), checkfirst=True)

    member_role = postgresql.ENUM('admin', 'member', name='member_role', create_type=False)
    member_role.create(op.get_bind(), checkfirst=True)

    notif_type = postgresql.ENUM(
        'mention', 'reply', 'agentic_reply', 'summary_ready', 'new_member',
        name='notif_type', create_type=False,
    )
    notif_type.create(op.get_bind(), checkfirst=True)

    # users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('preferred_language', sa.String(10), nullable=False, server_default='fr'),
        sa.Column('status', sa.Enum('active', 'agentic', 'inactive', name='user_status'), server_default='active'),
        sa.Column('agentic_enabled', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('agentic_persona', sa.Text, nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_username', 'users', ['username'])

    # channels
    op.create_table(
        'channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('type', sa.Enum('team', 'pair', name='channel_type'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_archived', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # channel_members
    op.create_table(
        'channel_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('channels.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.Enum('admin', 'member', name='member_role'), server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('channel_id', 'user_id'),
    )
    op.create_index('ix_channel_members_channel_id', 'channel_members', ['channel_id'])

    # messages
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('channels.id'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('original_content', sa.Text, nullable=False),
        sa.Column('original_language', sa.String(10), nullable=False),
        sa.Column('is_agentic', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('messages.id'), nullable=True),
        sa.Column('is_pinned', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_messages_channel_id', 'messages', ['channel_id'])
    op.create_index('ix_messages_created_at', 'messages', ['created_at'])

    # message_translations
    op.create_table(
        'message_translations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('messages.id'), nullable=False),
        sa.Column('target_language', sa.String(10), nullable=False),
        sa.Column('translated_content', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'target_language'),
    )
    op.create_index('ix_message_translations_message_id', 'message_translations', ['message_id'])

    # message_reactions
    op.create_table(
        'message_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('messages.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('emoji', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'user_id', 'emoji'),
    )
    op.create_index('ix_message_reactions_message_id', 'message_reactions', ['message_id'])

    # notifications
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.Enum(
            'mention', 'reply', 'agentic_reply', 'summary_ready', 'new_member',
            name='notif_type',
        ), nullable=False),
        sa.Column('channel_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('is_read', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])


def downgrade() -> None:
    """Drop all base tables."""
    op.drop_table('notifications')
    op.drop_table('message_reactions')
    op.drop_table('message_translations')
    op.drop_table('messages')
    op.drop_table('channel_members')
    op.drop_table('channels')
    op.drop_table('users')

    op.execute('DROP TYPE IF EXISTS notif_type')
    op.execute('DROP TYPE IF EXISTS member_role')
    op.execute('DROP TYPE IF EXISTS channel_type')
    op.execute('DROP TYPE IF EXISTS user_status')
