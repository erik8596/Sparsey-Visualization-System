from src.web import create_app
from os import environ

app = create_app()

if __name__ == "__main__":
    app.run(port=int(environ.get("PORT", 5000)),
            debug=app.config.get("FLASK_DEBUG")
            )
