import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import settings

_app: firebase_admin.App | None = None


def _get_app() -> firebase_admin.App:
    global _app
    if _app is not None:
        return _app

    cred_dict = {
        "type": "service_account",
        "project_id": settings.firebase_project_id,
        "client_email": settings.firebase_client_email,
        "private_key": settings.firebase_private_key,
        "token_uri": "https://oauth2.googleapis.com/token",
    }

    try:
        cred = credentials.Certificate(cred_dict)
        _app = firebase_admin.initialize_app(cred)
    except ValueError:
        _app = firebase_admin.get_app()

    return _app


def verify_token(id_token: str) -> dict:
    app = _get_app()
    decoded = auth.verify_id_token(id_token, app=app)
    return {
        "uid": decoded["uid"],
        "email": decoded.get("email", ""),
        "name": decoded.get("name", ""),
    }
