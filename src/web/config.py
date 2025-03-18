from os import environ as env
from typing import Dict, Any

class Config:
    """Base configuration."""
    SECRET_KEY = env.get('FLASK_SECRET_KEY', 'dev')
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration."""
    pass

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
