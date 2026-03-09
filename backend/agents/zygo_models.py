"""
Zygoflow Agent Platform — SQLAlchemy Models
All tables prefixed with zygo_ to avoid conflicts with existing tables.
"""

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey,
    JSON, Integer, Enum as SAEnum,Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

# Import your existing Base from database.py
# from database import Base
# If your Base is defined differently, adjust this import.
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class ZygoModelEnum(str, enum.Enum):
    openai = "openai"
    claude = "claude"

class ZygoTriggerTypeEnum(str, enum.Enum):
    interval = "interval"
    daily = "daily"
    folder_watch = "folder_watch"
    webhook = "webhook"

class ZygoRunStatusEnum(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


# ── zygo_users ─────────────────────────────────────────────────────────────

class ZygoUser(Base):
    """
    Zygoflow platform users.
    Links to your existing auth (e.g. Supabase auth.users via user_id).
    """
    __tablename__ = "zygo_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, unique=True, nullable=False) # foreign key to auth.users
    api_token = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=False)
    openai_api_key = Column(String, nullable=True)
    claude_api_key = Column(String, nullable=True)
    ngrok_token = Column(String, nullable=True)
    google_service_account = Column(JSON, nullable=True)  # full JSON content
    active_model = Column(SAEnum(ZygoModelEnum), default=ZygoModelEnum.openai)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pipelines = relationship("ZygoPipeline", back_populates="owner", cascade="all, delete-orphan")
    triggers = relationship("ZygoTrigger", back_populates="owner", cascade="all, delete-orphan")
    custom_apis = relationship("ZygoCustomAPI", back_populates="owner", cascade="all, delete-orphan")
    google_resources = relationship("ZygoGoogleResource", back_populates="owner", cascade="all, delete-orphan")
    runs = relationship("ZygoRun", back_populates="owner", cascade="all, delete-orphan")
    e2b_api_key = Column(String, nullable=True)
    custom_apis_data = Column(JSON, nullable=True)
    google_resources_data = Column(JSON, nullable=True)

# ── zygo_pipelines ─────────────────────────────────────────────────────────

class ZygoPipeline(Base):
    """
    A saved pipeline (orchestrator) — collection of agents run in sequence.
    """
    __tablename__ = "zygo_pipelines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("zygo_users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    agent_names = Column(JSON, nullable=False, default=list)   # ["agent1", "agent2"]
    max_rounds = Column(Integer, default=1)
    auto_mode = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("ZygoUser", back_populates="pipelines")
    agents = relationship("ZygoAgent", back_populates="pipeline", cascade="all, delete-orphan")
    triggers = relationship("ZygoTrigger", back_populates="pipeline")
    runs = relationship("ZygoRun", back_populates="pipeline", cascade="all, delete-orphan")


# ── zygo_agents ────────────────────────────────────────────────────────────

class ZygoAgent(Base):
    """
    Individual sub-agent inside a pipeline.
    """
    __tablename__ = "zygo_agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("zygo_pipelines.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("zygo_users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    prompt = Column(Text, nullable=True)
    generated_code = Column(Text, nullable=True)
    model = Column(SAEnum(ZygoModelEnum), default=ZygoModelEnum.openai)
    order_index = Column(Integer, default=0)   # position in pipeline
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pipeline = relationship("ZygoPipeline", back_populates="agents")


# ── zygo_triggers ──────────────────────────────────────────────────────────

class ZygoTrigger(Base):
    """
    Trigger that fires a pipeline — interval, daily, folder watch, or webhook.
    """
    __tablename__ = "zygo_triggers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("zygo_users.id", ondelete="CASCADE"), nullable=False)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("zygo_pipelines.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    trigger_type = Column(SAEnum(ZygoTriggerTypeEnum), nullable=False)
    is_enabled = Column(Boolean, default=True)

    # Interval config
    interval_value = Column(Integer, nullable=True)
    interval_unit = Column(String, nullable=True)   # minutes, hours, days

    # Daily config
    daily_time = Column(String, nullable=True)       # "09:00"

    # Folder watch config
    folder_path = Column(String, nullable=True)

    # Webhook config
    webhook_path = Column(String, nullable=True, unique=True)   # /webhook/my-pipeline
    webhook_public_url = Column(String, nullable=True)

    display = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("ZygoUser", back_populates="triggers")
    pipeline = relationship("ZygoPipeline", back_populates="triggers")


# ── zygo_custom_apis ───────────────────────────────────────────────────────

class ZygoCustomAPI(Base):
    """
    User-defined custom API integrations (SendGrid, Stripe, Twilio, etc).
    """
    __tablename__ = "zygo_custom_apis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("zygo_users.id", ondelete="CASCADE"), nullable=False)
    api_name = Column(String, nullable=False)           # "SendGrid"
    key_variable = Column(String, nullable=False)       # "sendgrid_api_key"
    api_key = Column(String, nullable=False)            # encrypted ideally
    description = Column(Text, nullable=True)
    example_args = Column(String, nullable=True)
    generated_function = Column(Text, nullable=True)    # the Python function code
    function_name = Column(String, nullable=True)       # "send_email_via_sendgrid"
    model = Column(SAEnum(ZygoModelEnum), default=ZygoModelEnum.openai)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("ZygoUser", back_populates="custom_apis")


# ── zygo_google_resources ──────────────────────────────────────────────────

class ZygoGoogleResource(Base):
    """
    Named shortcuts to Google Sheets/Docs so agents can reference by nickname.
    e.g. "sales_sheet" → spreadsheet_id + sheet_name
    """
    __tablename__ = "zygo_google_resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("zygo_users.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String, nullable=False)      # "sheet" or "doc"
    nickname = Column(String, nullable=False)           # "sales_sheet"
    spreadsheet_id = Column(String, nullable=True)      # for sheets
    sheet_name = Column(String, nullable=True)          # for sheets
    document_id = Column(String, nullable=True)         # for docs
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owner = relationship("ZygoUser", back_populates="google_resources")


# ── zygo_runs ──────────────────────────────────────────────────────────────

class ZygoRun(Base):
    """
    Execution history for every pipeline run — triggered by user, scheduler, or webhook.
    """
    __tablename__ = "zygo_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("zygo_users.id", ondelete="CASCADE"), nullable=False)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("zygo_pipelines.id", ondelete="SET NULL"), nullable=True)
    trigger_id = Column(UUID(as_uuid=True), ForeignKey("zygo_triggers.id", ondelete="SET NULL"), nullable=True)
    status = Column(SAEnum(ZygoRunStatusEnum), default=ZygoRunStatusEnum.pending)
    trigger_source = Column(String, nullable=True)      # "manual", "scheduler", "webhook"
    trigger_payload = Column(JSON, nullable=True)       # webhook payload if applicable
    logs = Column(Text, nullable=True)                  # full execution log
    error = Column(Text, nullable=True)                 # error message if failed
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    logs = Column(Text, nullable=True)

    # Relationships
    owner = relationship("ZygoUser", back_populates="runs")
    pipeline = relationship("ZygoPipeline", back_populates="runs")
