import os
from pathlib import Path
from typing import Optional

class AppConfig:
    _instance: Optional['AppConfig'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.project_root = Path(__file__).parent.parent
        self.view_dir = os.path.join(self.project_root, 'view')
        self.template_dir = os.path.join(self.view_dir, 'templates')
        self.static_dir = os.path.join(self.view_dir, 'static')

        self._verify_directories()

    def _verify_directories(self):
        if not os.path.exists(self.template_dir):
            raise RuntimeError(f"Template directory not found: {self.template_dir}")
        if not os.path.exists(self.static_dir):
            raise RuntimeError(f"Static directory not found: {self.static_dir}")
