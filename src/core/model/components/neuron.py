from dataclasses import dataclass
from src.core.model.components import BaseComponent

@dataclass
class Neuron(BaseComponent):
    """Represents a neuron (leaf node in composite)"""
    x: float
    y: float
    z: float
    active: bool = False
    raw_activation: float = 0.0
    avg_activation: float = 0.0

    def add_subcomponent(self, subcomponent: BaseComponent) -> None:
        raise ValueError("Neuron is a leaf node and cannot have subcomponents.")

    def get_visualization_data(self):
        return [{
            "type": "neuron",
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "active": self.active,
            "raw_activation": self.raw_activation,
            "avg_activation": self.avg_activation
        }]
