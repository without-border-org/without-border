"""WebSocket Connection Manager — tracks active connections per channel."""
import json
import uuid
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[uuid.UUID, dict[uuid.UUID, WebSocket]] = defaultdict(dict)

    async def connect(self, ws: WebSocket, channel_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await ws.accept()
        self._connections[channel_id][user_id] = ws

    def disconnect(self, channel_id: uuid.UUID, user_id: uuid.UUID) -> None:
        self._connections.get(channel_id, {}).pop(user_id, None)

    def is_connected(self, channel_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return user_id in self._connections.get(channel_id, {})

    def get_online_users(self, channel_id: uuid.UUID) -> list[uuid.UUID]:
        return list(self._connections.get(channel_id, {}).keys())

    async def send_to_user(self, channel_id: uuid.UUID, user_id: uuid.UUID, payload: dict) -> None:
        ws = self._connections.get(channel_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                self.disconnect(channel_id, user_id)

    async def broadcast(self, channel_id: uuid.UUID, payload: dict) -> None:
        dead = []
        for uid, ws in list(self._connections.get(channel_id, {}).items()):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(channel_id, uid)

    async def broadcast_except(self, channel_id: uuid.UUID, exclude_user_id: uuid.UUID, payload: dict) -> None:
        dead = []
        for uid, ws in list(self._connections.get(channel_id, {}).items()):
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(channel_id, uid)


connection_manager = ConnectionManager()
