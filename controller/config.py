from pathlib import Path

class Config:
    """Base configuration"""
    PROJECT_ROOT = Path(__file__).parent.parent
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration"""
    pass

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
