from controller.app_factory import FlaskAppFactory
from os import environ

if __name__ == "__main__":
    app = FlaskAppFactory.create_app()
    app.run(port=int(environ.get("PORT", 5000)),
            debug=True
        )
