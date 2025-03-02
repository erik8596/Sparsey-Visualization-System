# model/wandb/__init__.py

from .wandb_facade import WandBFacade
from .model_config import ModelConfig

__all__ = ["WandBFacade", "ModelConfig"]