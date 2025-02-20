from flask import Flask
from os import environ

def create_app():
    # flask init
    app = Flask(__name__,
                template_folder='templates',
                static_folder='static'
                )
    
    # secret key set
    app.secret_key = environ.get('SVS_FLASK_SECRET_KEY')

    # blueprint registration
    from src.sparseypy.web.routes import api_bp, views_bp
    app.register_blueprint(api_bp)
    app.register_blueprint(views_bp)

    return app

if __name__ == '__main__':
    app = create_app()