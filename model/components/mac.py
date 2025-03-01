from __future__ import annotations
from typing import List
from dataclasses import dataclass, field
from model.components import BaseComponent
from model.components import CM

@dataclass
class MAC(BaseComponent):
    """Represents a MAC unit that can contain CMs"""
    x: float
    y: float
    z: float
    active: bool = False
    cms: List[CM] = field(default_factory=list)

    def add_subcomponent(self, subcomponent: BaseComponent) -> None:
        if isinstance(subcomponent, CM):
            self.cms.append(subcomponent)
        else:
            raise ValueError(f"Unsupported subcomponent type: {type(subcomponent)}.")

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
