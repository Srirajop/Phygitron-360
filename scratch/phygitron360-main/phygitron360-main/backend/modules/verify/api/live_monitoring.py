"""
Verify Module — Live Monitoring API
===================================
WebSocket Hub for tracking candidates currently taking assessments.
"""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/live-monitor", tags=["Verify - Live Monitor"])

class ConnectionManager:
    def __init__(self):
        # Maps asm_id to a list of connected WebSockets (Recruiters)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, asm_id: int):
        await websocket.accept()
        if asm_id not in self.active_connections:
            self.active_connections[asm_id] = []
        self.active_connections[asm_id].append(websocket)
        logger.info(f"Recruiter connected to monitor asm_id {asm_id}")

    def disconnect(self, websocket: WebSocket, asm_id: int):
        if asm_id in self.active_connections:
            self.active_connections[asm_id].remove(websocket)
            if not self.active_connections[asm_id]:
                del self.active_connections[asm_id]

    async def broadcast_event(self, asm_id: int, event: Dict[str, Any]):
        """Broadcast an event (like a strike or status change) to all connected recruiters for this assessment."""
        connections = self.active_connections.get(asm_id, [])
        dead_connections = []
        for connection in connections:
            try:
                await connection.send_json(event)
            except Exception as e:
                logger.warning(f"Error sending to WebSocket: {e}")
                dead_connections.append(connection)
        
        for dead in dead_connections:
            self.disconnect(dead, asm_id)

manager = ConnectionManager()

@router.websocket("/{asm_id}")
async def live_monitor_endpoint(websocket: WebSocket, asm_id: int):
    """
    WebSocket endpoint for HR/Recruiters to listen to live candidate events.
    In a real app, you would verify a token query parameter here.
    """
    await manager.connect(websocket, asm_id)
    try:
        while True:
            # Keep connection open, perhaps receive pings or commands from HR
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, asm_id)
        logger.info(f"Recruiter disconnected from asm_id {asm_id}")

async def notify_live_monitor(asm_id: int, event_type: str, user_id: int, details: dict = None):
    """Utility to trigger a broadcast. Should be called from assignments/submissions APIs."""
    event = {
        "event_type": event_type,
        "user_id": user_id,
        "details": details or {}
    }
    await manager.broadcast_event(asm_id, event)
