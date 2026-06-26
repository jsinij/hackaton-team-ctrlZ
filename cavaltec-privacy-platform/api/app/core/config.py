from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/cavaltec"
    jwt_secret: str = "changeme"
    environment: str = "development"

    firebase_project_id: str = ""
    firebase_client_email: str = ""
    firebase_private_key: str = ""

    azure_foundry_endpoint: str = ""
    azure_foundry_api_key: str = ""
    azure_foundry_model: str = "gpt-4o"
    azure_foundry_api_version: str = "2024-02-01"

    azure_ai_project_endpoint: str = ""
    azure_ai_agent_id: str = ""

    backend_cors_origins: List[str] = ["http://localhost:3000"]

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("firebase_private_key", mode="before")
    @classmethod
    def parse_private_key(cls, v):
        if isinstance(v, str):
            return v.replace("\\n", "\n")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": False}


settings = Settings()
