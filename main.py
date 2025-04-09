from src.web.app import create_app
from os import environ

def main():
    app = create_app(environ.get('FLASK_ENV'))

    app.run(
        port=int(environ.get('FLASK_PORT', 5000)),
        debug=environ.get('FLASK_DEBUG', True)
    )


if __name__ == "__main__":
    main()
