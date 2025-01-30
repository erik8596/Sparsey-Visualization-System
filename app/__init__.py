"""
Flask Initilization
"""

from dotenv import load_dotenv
from flask import Flask

load_dotenv()

def init_app():
    # init flask app
    app = Flask(__name__)

    # load main blueprint
    from app.main import main as main_bp
    app.register_blueprint(main_bp)

    return app


if __name__ == "__main__":
    app = init_app().run(debug=True)