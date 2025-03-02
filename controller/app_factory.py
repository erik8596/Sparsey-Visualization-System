from flask import Flask
from pathlib import Path
from typing import Optional
from controller.routes.api import api  # Import the blueprint instance, not the module
from controller.routes.views import views

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

        # set up template and static folders
        app.template_folder = str(view_dir / 'templates')
        app.static_folder = str(view_dir / 'static')

        # Register blueprints
        app.register_blueprint(api)
        app.register_blueprint(views)

        return app
