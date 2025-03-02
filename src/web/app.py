from flask import Flask
from os import environ as env

def create_app() -> Flask:
    app = Flask(
         __name__,
         template_folder='templates',
         static_folder='static'
        )
        
    # set secret key
    app.secret_key = env.get('FLASK_SECRET_KEY')

    # set debug
    app.debug = env.get('FLASK_DEBUG')

    # set testing
    app.testing = env.get('FLASK_TESTING')

    # register blueprints
    from src.web.routes import api, views
    app.register_blueprint(api)
    app.register_blueprint(views)

    return app

if __name__ == '__main__':
      app = create_app()