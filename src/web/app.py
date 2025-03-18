from flask import Flask
from os import environ as env
from src.web.config import config

def create_app(config_name: str = None) -> Flask:
    """Application factory function.

    Args:
        config_name: The name of the configuration to use. If None, uses environment variable.

    Returns:
        Flask application instance
    """
    app = Flask(
        __name__,
        template_folder='templates',
        static_folder='static'
    )

    # Use environment variable if config_name not provided
    if config_name is None:
        config_name = env.get('FLASK_ENV', 'default')

    # Load the config
    app.config.from_object(config[config_name])

    # Register blueprints
    from src.web.routes import api, views
    app.register_blueprint(api)
    app.register_blueprint(views)

    return app

def create_test_app() -> Flask:
    """Creates an application instance for testing."""
    return create_app('testing')

def create_dev_app() -> Flask:
    """Creates an application instance for development."""
    return create_app('development')

def create_prod_app() -> Flask:
    """Creates an application instance for production."""
    return create_app('production')

if __name__ == '__main__':
    app = create_app()
