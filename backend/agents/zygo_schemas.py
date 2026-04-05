"""
Zygoflow Agent Platform — Pydantic Schemas
Request/response models for the API.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
from enum import Enum


class ZygoModelEnum(str, Enum):
    openai = "openai"
    claude = "claude"


class ZygoTriggerTypeEnum(str, Enum):
    interval = "interval"
    daily = "daily"
    folder_watch = "folder_watch"
    webhook = "webhook"


class ZygoRunStatusEnum(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


# ── ZygoUser ───────────────────────────────────────────────

class ZygoUserCreate(BaseModel):
    email: EmailStr
    openai_api_key: Optional[str] = None
    claude_api_key: Optional[str] = None
    ngrok_token: Optional[str] = None
    active_model: ZygoModelEnum = ZygoModelEnum.openai

class ZygoUserUpdate(BaseModel):
    openai_api_key: Optional[str] = None
    claude_api_key: Optional[str] = None
    ngrok_token: Optional[str] = None
    google_service_account: Optional[Dict] = None
    active_model: Optional[ZygoModelEnum] = None
    website_id: Optional[str] = None
    website_tables_data: Optional[Dict] = None

class ZygoUserOut(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    active_model: ZygoModelEnum
    created_at: datetime
    website_id: Optional[str] = None
    website_tables_data: Optional[Dict] = None

    class Config:
        from_attributes = True


# ── ZygoAgent ──────────────────────────────────────────────

class ZygoAgentCreate(BaseModel):
    name: str
    prompt: Optional[str] = None
    generated_code: Optional[str] = None
    model: ZygoModelEnum = ZygoModelEnum.openai
    order_index: int = 0

class ZygoAgentUpdate(BaseModel):
    name: Optional[str] = None
    prompt: Optional[str] = None
    generated_code: Optional[str] = None
    model: Optional[ZygoModelEnum] = None
    order_index: Optional[int] = None

class ZygoAgentOut(BaseModel):
    id: UUID
    pipeline_id: UUID
    name: str
    prompt: Optional[str]
    generated_code: Optional[str]
    model: ZygoModelEnum
    order_index: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── ZygoPipeline ───────────────────────────────────────────

class ZygoPipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    agent_names: List[str] = []
    max_rounds: int = 1
    auto_mode: bool = False
    is_xyz: bool = False

class ZygoPipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    agent_names: Optional[List[str]] = None
    max_rounds: Optional[int] = None
    auto_mode: Optional[bool] = None
    is_xyz: Optional[bool] = None  # 🔥 ADD THIS
    is_active: Optional[bool] = None

class ZygoPipelineOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    agent_names: List[str]
    max_rounds: int
    auto_mode: bool
    is_active: bool
    agents: List[ZygoAgentOut] = []
    created_at: datetime
    is_xyz: bool = False

    class Config:
        from_attributes = True


# ── ZygoTrigger ────────────────────────────────────────────

class ZygoTriggerCreate(BaseModel):
    name: str
    pipeline_id: Optional[UUID] = None
    trigger_type: ZygoTriggerTypeEnum
    interval_value: Optional[int] = None
    interval_unit: Optional[str] = None
    daily_time: Optional[str] = None
    folder_path: Optional[str] = None
    display: Optional[str] = None

class ZygoTriggerOut(BaseModel):
    id: UUID
    name: str
    pipeline_id: Optional[UUID]
    trigger_type: ZygoTriggerTypeEnum
    is_enabled: bool
    interval_value: Optional[int]
    interval_unit: Optional[str]
    daily_time: Optional[str]
    folder_path: Optional[str]
    webhook_path: Optional[str]
    webhook_public_url: Optional[str]
    display: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── ZygoCustomAPI ──────────────────────────────────────────

class ZygoCustomAPICreate(BaseModel):
    api_name: str
    key_variable: str
    api_key: str
    description: Optional[str] = None
    example_args: Optional[str] = None
    generated_function: Optional[str] = None
    function_name: Optional[str] = None
    model: ZygoModelEnum = ZygoModelEnum.openai

class ZygoCustomAPIOut(BaseModel):
    id: UUID
    api_name: str
    key_variable: str
    description: Optional[str]
    function_name: Optional[str]
    model: ZygoModelEnum
    created_at: datetime

    class Config:
        from_attributes = True


# ── ZygoGoogleResource ─────────────────────────────────────

class ZygoGoogleResourceCreate(BaseModel):
    resource_type: str  # "sheet" or "doc"
    nickname: str
    spreadsheet_id: Optional[str] = None
    sheet_name: Optional[str] = None
    document_id: Optional[str] = None

class ZygoGoogleResourceOut(BaseModel):
    id: UUID
    resource_type: str
    nickname: str
    spreadsheet_id: Optional[str]
    sheet_name: Optional[str]
    document_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── ZygoRun ────────────────────────────────────────────────

class ZygoRunOut(BaseModel):
    id: UUID
    pipeline_id: Optional[UUID]
    trigger_id: Optional[UUID]
    status: ZygoRunStatusEnum
    trigger_source: Optional[str]
    trigger_payload: Optional[Dict]
    logs: Optional[str]
    error: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Webhook Payload ────────────────────────────────────────

class ZygoWebhookPayload(BaseModel):
    data: Dict[str, Any] = {}
