from __future__ import annotations
from typing import List
from .base_component import VisualizationComponent
from .cm import CM

class MAC(VisualizationComponent):
    """Represents a MAC unit that can contain CMs"""
    def __init__(self, x: float, y: float, z: float, active: bool = False):
        self.x = x
        self.y = y
        self.z = z
        self.active = active
        self.cms: List[CM] = []

    def add_cm(self, cm: CM):
        self.cms.append(cm)

    def get_visualization_data(self):
        data = [{
            "type": "mac",
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "active": self.active
        }]
        for cm in self.cms:
            data.extend(cm.get_visualization_data())
        return data
