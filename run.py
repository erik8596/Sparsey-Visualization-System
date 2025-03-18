from src.web.app import create_app
from os import environ

app = create_app(environ.get('FLASK_ENV'))

if __name__ == "__main__":
    app.run(
        port=int(environ.get("PORT", 5000))
    )
