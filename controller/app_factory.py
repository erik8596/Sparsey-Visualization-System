from flask import Flask
from pathlib import Path
from typing import Optional

class FlaskAppFactory:
    """Factory for creating Flask application instances"""

    @staticmethod
    def create_app(config_object: Optional[object] = None) -> Flask:
        app = Flask(__name__)

        if config_object is not None:
            app.config.from_object(config_object)

        # Set up paths
        project_root = Path(__file__).parent.parent
        view_dir = project_root / 'view'

        app.template_folder = str(view_dir / 'templates')
        app.static_folder = str(view_dir / 'static')

        from controller.routes import api, views
        app.register_blueprint(api)
        app.register_blueprint(views)

        return app
